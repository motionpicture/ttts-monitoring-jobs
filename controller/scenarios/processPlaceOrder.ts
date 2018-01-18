/**
 * 注文取引シナリオ
 * @module
 */

import * as tttsapi from '@motionpicture/ttts-api-nodejs-client';
import * as createDebug from 'debug';
import { CREATED } from 'http-status';
import * as moment from 'moment';
import * as request from 'request-promise-native';
import * as util from 'util';

const debug = createDebug('ttts-monitoring-jobs');

const auth = new tttsapi.auth.ClientCredentials({
    domain: <string>process.env.TTTS_API_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.TTTS_API_CLIENT_ID,
    clientSecret: <string>process.env.TTTS_API_CLIENT_SECRET,
    scopes: [
        `${<string>process.env.TTTS_API_RESOURECE_SERVER_IDENTIFIER}/performances.read-only`,
        `${<string>process.env.TTTS_API_RESOURECE_SERVER_IDENTIFIER}/transactions`
    ],
    state: 'teststate'
});

const events = new tttsapi.service.Event({
    endpoint: <string>process.env.TTTS_API_ENDPOINT,
    auth: auth
});

const placeOrderTransactions = new tttsapi.service.transaction.PlaceOrder({
    endpoint: <string>process.env.TTTS_API_ENDPOINT,
    auth: auth
});

// tslint:disable-next-line:max-func-body-length
export async function main(organizationIdentifier: string, durationInMilliseconds: number) {
    // パフォーマンス検索
    debug('パフォーマンスを検索しています...');
    // tslint:disable-next-line:insecure-random no-magic-numbers
    const daysAfter = Math.floor(Math.random() * 90);
    const searchPerformancesResult = await events.searchPerformances({
        startFrom: moment().add(daysAfter - 1, 'days').toDate(),
        // tslint:disable-next-line:no-magic-numbers
        startThrough: moment().add(daysAfter, 'days').toDate()
    });
    debug(`${searchPerformancesResult.data.length}件のパフォーマンスが見つかりました。`);
    let performances = searchPerformancesResult.data;
    // 空席ありのイベントに絞る(販売情報がないことがあるので、あるものだけに絞る)
    performances = performances.filter((p) => p.remainingAttendeeCapacity > 0 && p.ticketTypes.length > 0);

    if (performances.length === 0) {
        throw new Error('パフォーマンスがありません。');
    }

    // waiter許可証を取得
    const passportToken = await request.post({
        resolveWithFullResponse: true,
        simple: false,
        url: `${process.env.WAITER_ENDPOINT}/passports`,
        json: true,
        body: {
            scope: `placeOrderTransaction.${organizationIdentifier}`
        }
    }).then((res) => {
        debug('WAITERから応答がありました。', res.statusCode);
        if (res.statusCode !== CREATED) {
            const error = new tttsapi.transporters.RequestError('filtered by WAITER.');
            error.code = res.statusCode;
            error.errors = [
                new tttsapi.factory.errors.RateLimitExceeded()
            ];

            throw error;
        }

        return res.body.token;
    });

    // 取引開始
    const transaction = await placeOrderTransactions.start({
        // tslint:disable-next-line:no-magic-numbers
        expires: moment().add(15, 'minutes').toDate(),
        sellerIdentifier: organizationIdentifier,
        purchaserGroup: <any>'Customer',
        passportToken: passportToken
    });
    debug('取引が開始されました。取引ID:', transaction.id);

    // イベント選択時間
    debug('パフォーマンスを決めています...');
    // tslint:disable-next-line:no-magic-numbers
    await wait(durationInMilliseconds / 6);

    // tslint:disable-next-line:insecure-random
    const performance = performances[Math.floor(performances.length * Math.random())];
    debug('パフォーマンスを決めました。', performance.id);

    // 仮予約
    debug('券種を選択しています...');
    // tslint:disable-next-line:no-magic-numbers
    await wait(durationInMilliseconds / 6);
    let ticketType = performance.ticketTypes[0];
    let seatReservationAuthorizeAction = await placeOrderTransactions.createSeatReservationAuthorization({
        transactionId: transaction.id,
        performanceId: performance.id,
        offers: [{
            ticket_type: ticketType.id,
            watcher_name: ''
        }]
    });
    if (seatReservationAuthorizeAction.result === undefined) {
        throw new Error('seatReservationAuthorizeAction.result undefined.');
    }
    debug('仮予約が作成されました。購入番号:', seatReservationAuthorizeAction.result.tmpReservations[0].payment_no);

    debug('券種を変更しています...');
    // tslint:disable-next-line:no-magic-numbers
    await wait(durationInMilliseconds / 6);
    // 仮予約削除
    await placeOrderTransactions.cancelSeatReservationAuthorization({
        transactionId: transaction.id,
        actionId: seatReservationAuthorizeAction.id
    });
    debug('仮予約が削除されました。');

    // 再仮予約
    ticketType = performance.ticketTypes[0];
    seatReservationAuthorizeAction = await placeOrderTransactions.createSeatReservationAuthorization({
        transactionId: transaction.id,
        performanceId: performance.id,
        offers: [{
            ticket_type: ticketType.id,
            watcher_name: ''
        }]
    });
    if (seatReservationAuthorizeAction.result === undefined) {
        throw new Error('seatReservationAuthorizeAction.result undefined.');
    }
    debug('仮予約が作成されました。購入番号:', seatReservationAuthorizeAction.result.tmpReservations[0].payment_no);

    const amount = seatReservationAuthorizeAction.result.price;
    const orderIdPrefix = util.format(
        '%s%s%s',
        moment().format('YYYYMMDD'),
        moment(performance.startDate).format('YYYYMMDD'),
        // tslint:disable-next-line:no-magic-numbers
        `00000000${seatReservationAuthorizeAction.result.tmpReservations[0].payment_no}`.slice(-8)
    );
    debug('クレジットカードのオーソリをとります...', orderIdPrefix);
    // tslint:disable-next-line:max-line-length
    const { creditCardAuthorizeAction, numberOfTryAuthorizeCreditCard } = await authorieCreditCardUntilSuccess(
        transaction.id, orderIdPrefix, amount
    );
    debug(`${numberOfTryAuthorizeCreditCard}回目でオーソリがとれました。アクションID:`, creditCardAuthorizeAction.id);

    // 購入者情報登録
    debug('購入者情報を入力しています...');
    // tslint:disable-next-line:no-magic-numbers
    await wait(durationInMilliseconds / 6);
    let customerContact = {
        last_name: 'せい',
        first_name: 'めい',
        email: <string>process.env.TTTS_DEVELOPER_EMAIL,
        tel: '09012345678',
        gender: '0',
        age: '',
        address: ''
    };
    customerContact = await placeOrderTransactions.setCustomerContact({
        transactionId: transaction.id,
        contact: customerContact
    });
    debug('購入者情報が登録されました。tel:', customerContact.tel);

    // 確定
    debug('最終確認しています...');
    // tslint:disable-next-line:no-magic-numbers
    await wait(durationInMilliseconds / 6);
    const transactionResult = await placeOrderTransactions.confirm({
        transactionId: transaction.id,
        paymentMethod: <any>'CreditCard'
    });
    debug('取引確定です。購入番号:', transactionResult.eventReservations[0].payment_no);

    // send an email
    debug('メールを送信しています...');
    const content = `Dear ${customerContact.last_name} ${customerContact.first_name}
-------------------
Thank you for the order below.
-------------------
paymentNo: ${ transactionResult.order.orderInquiryKey.paymentNo}
telephone: ${ transactionResult.order.orderInquiryKey.telephone}
amount: ${ transactionResult.order.price} ${transactionResult.order.priceCurrency}
-------------------
        `;
    await placeOrderTransactions.sendEmailNotification({
        transactionId: transaction.id,
        emailMessageAttributes: {
            sender: {
                name: transaction.seller.name,
                email: 'noreply@example.com'
            },
            toRecipient: {
                name: `${customerContact.last_name} ${customerContact.first_name} `,
                email: customerContact.email
            },
            about: `${transaction.seller.name} ツアー[${moment(performance.startDate).format('YYYYMMDD')} -${performance.tourNumber}]`,
            text: content
        }
    });
    debug('メールを送信しました。');

    return { transactionResult, numberOfTryAuthorizeCreditCard };
}

const RETRY_INTERVAL_IN_MILLISECONDS = 5000;
const MAX_NUMBER_OF_RETRY = 10;
async function authorieCreditCardUntilSuccess(transactionId: string, orderIdPrefix: string, amount: number) {
    let creditCardAuthorizeAction = null;
    let numberOfTryAuthorizeCreditCard = 0;

    while (creditCardAuthorizeAction === null) {
        numberOfTryAuthorizeCreditCard += 1;

        await wait(RETRY_INTERVAL_IN_MILLISECONDS);

        try {
            creditCardAuthorizeAction = await placeOrderTransactions.createCreditCardAuthorization({
                transactionId: transactionId,
                // tslint:disable-next-line:no-magic-numbers
                orderId: `${orderIdPrefix}${`00${numberOfTryAuthorizeCreditCard.toString()}`.slice(-2)}`,
                amount: amount,
                method: '1',
                creditCard: {
                    cardNo: '4111111111111111',
                    expire: '2020',
                    holderName: 'TARO MOTIONPICTURE'
                }
            });
        } catch (error) {
            if (numberOfTryAuthorizeCreditCard >= MAX_NUMBER_OF_RETRY) {
                throw error;
            }
        }
    }

    return {
        creditCardAuthorizeAction,
        numberOfTryAuthorizeCreditCard
    };
}

async function wait(waitInMilliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, waitInMilliseconds));
}
