/**
 * 注文取引シナリオ
 * @module
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as request from 'request-promise-native';
import * as util from 'util';

const debug = createDebug('ttts-monitoring-jobs');
const API_ENDPOINT = <string>process.env.TTTS_API_ENDPOINT;

// tslint:disable-next-line:max-func-body-length
export async function main(organizationIdentifier: string) {
    // get token
    const scopes = [
        'https://ttts-api-development.azurewebsites.net/performances.read-only',
        'https://ttts-api-development.azurewebsites.net/transactions'
    ];
    const credentials = await request.post(
        `https://${<string>process.env.TTTS_API_AUTHORIZE_SERVER_DOMAIN}/token`,
        {
            auth: {
                user: process.env.TTTS_API_CLIENT_ID,
                password: process.env.TTTS_API_CLIENT_SECRET
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            form: {
                scope: scopes.join(' '),
                state: 'state',
                grant_type: 'client_credentials'
            },
            json: true
        }
    );
    debug('認証情報を取得できました。', credentials.expires_in);

    // パフォーマンス検索
    const performances = await request.get(
        `${API_ENDPOINT}/performances`,
        {
            auth: { bearer: credentials.access_token },
            json: true,
            qs: {
                start_from: moment().toDate(),
                // tslint:disable-next-line:no-magic-numbers
                start_through: moment().add(1, 'months').toDate()
            }
        }
    ).then((body) => <any[]>body.data);
    debug('パフォーマンスが見つかりました。', performances.length);

    if (performances.length === 0) {
        throw new Error('パフォーマンスがありません。');
    }

    // イベント選択時間
    debug('パフォーマンスを決めています...');
    // tslint:disable-next-line:no-magic-numbers
    await wait(5000);

    // tslint:disable-next-line:insecure-random
    const performance = performances[Math.floor(performances.length * Math.random())];

    // 取引開始
    const transaction = await request.post(
        `${API_ENDPOINT}/transactions/placeOrder/start`,
        {
            auth: { bearer: credentials.access_token },
            json: true,
            body: {
                // tslint:disable-next-line:no-magic-numbers
                expires: moment().add(15, 'minutes').toISOString(),
                seller_identifier: organizationIdentifier,
                purchaser_group: ttts.factory.person.Group.Customer
            }
        }
    ).then((body) => body);
    debug('取引が開始されました。', transaction.id);

    // 仮予約
    debug('券種を選択しています...');
    // tslint:disable-next-line:no-magic-numbers
    await wait(5000);
    let ticketType = performance.attributes.ticket_types[0];
    let seatReservationAuthorizeAction = await request.post(
        `${API_ENDPOINT}/transactions/placeOrder/${transaction.id}/actions/authorize/seatReservation`,
        {
            auth: { bearer: credentials.access_token },
            json: true,
            body: {
                perfomance_id: performance.id,
                offers: [{
                    ticket_type: ticketType.id,
                    watcher_name: ''
                }]
            }
        }
    ).then((body) => body);
    debug('仮予約が作成されました。', seatReservationAuthorizeAction.result.tmpReservations[0].payment_no);

    debug('券種を変更しています...');
    // tslint:disable-next-line:no-magic-numbers
    await wait(5000);
    // 仮予約削除
    await request.delete(
        `${API_ENDPOINT}/transactions/placeOrder/${transaction.id}/actions/authorize/seatReservation/${seatReservationAuthorizeAction.id}`,
        {
            auth: { bearer: credentials.access_token },
            json: true
        }
    ).then((body) => body);
    debug('仮予約が削除されました。');

    // 再仮予約
    ticketType = performance.attributes.ticket_types[0];
    seatReservationAuthorizeAction = await request.post(
        `${API_ENDPOINT}/transactions/placeOrder/${transaction.id}/actions/authorize/seatReservation`,
        {
            auth: { bearer: credentials.access_token },
            json: true,
            body: {
                perfomance_id: performance.id,
                offers: [{
                    ticket_type: ticketType.id,
                    watcher_name: ''
                }]
            }
        }
    ).then((body) => body);
    debug('仮予約が作成されました。', seatReservationAuthorizeAction.result.tmpReservations[0].payment_no);

    const amount = seatReservationAuthorizeAction.result.price;
    const orderIdPrefix = util.format(
        '%s%s%s',
        moment().format('YYYYMMDD'),
        performance.attributes.day,
        // tslint:disable-next-line:no-magic-numbers
        `00000000${seatReservationAuthorizeAction.result.tmpReservations[0].payment_no}`.slice(-8)
    );
    debug('クレジットカードのオーソリをとります...', orderIdPrefix);
    // tslint:disable-next-line:max-line-length
    const { creditCardAuthorizeAction, numberOfTryAuthorizeCreditCard } = await authorieCreditCardUntilSuccess(
        transaction.agent.id, transaction.id, orderIdPrefix, amount
    );
    debug('オーソリがとれました。', (<ttts.factory.action.authorize.creditCard.IResult>creditCardAuthorizeAction.result).execTranResult.tranId);

    // 購入者情報登録
    debug('購入者情報を入力しています...');
    // tslint:disable-next-line:no-magic-numbers
    await wait(5000);
    let customerContact = {
        last_name: 'せい',
        first_name: 'めい',
        email: <string>process.env.TTTS_DEVELOPER_EMAIL,
        tel: '09012345678',
        gender: '0'
    };
    customerContact = await request.put(
        `${API_ENDPOINT}/transactions/placeOrder/${transaction.id}/customerContact`,
        {
            auth: { bearer: credentials.access_token },
            json: true,
            body: customerContact
        }
    ).then((body) => body);
    debug('購入者情報が登録されました。', customerContact.tel);

    // 確定
    debug('最終確認しています...');
    // tslint:disable-next-line:no-magic-numbers
    await wait(5000);
    const transactionResult = await request.post(
        `${API_ENDPOINT}/transactions/placeOrder/${transaction.id}/confirm`,
        {
            auth: { bearer: credentials.access_token },
            json: true,
            body: {
                payment_method: ttts.factory.paymentMethodType.CreditCard
            }
        }
    ).then((body) => <ttts.factory.transaction.placeOrder.IResult>body);
    debug('取引確定です。', transactionResult.eventReservations[0].payment_no);

    // send an email
    const content = `Dear ${customerContact.last_name} ${customerContact.first_name}
-------------------
Thank you for the order below.
-------------------
paymentNo: ${ transactionResult.order.orderInquiryKey.paymentNo}
telephone: ${ transactionResult.order.orderInquiryKey.telephone}
amount: ${ transactionResult.order.price} ${transactionResult.order.priceCurrency}
-------------------
        `;
    await ttts.Models.EmailQueue.create({
        // tslint:disable-next-line:no-reserved-keywords
        from: { // 送信者
            address: 'noreply@example.com',
            name: transaction.seller.name
        },
        to: { // 送信先
            name: `${customerContact.last_name} ${customerContact.first_name} `,
            address: customerContact.email
        },
        subject: `${transaction.seller.name} ツアー[${performance.attributes.day} -${performance.attributes.tour_number}]`,
        content: { // 本文
            mimetype: 'text/plain',
            text: content
        },
        status: ttts.EmailQueueUtil.STATUS_UNSENT
    });
    debug('メールを送信しました。');

    return { transactionResult, numberOfTryAuthorizeCreditCard };
}

const RETRY_INTERVAL_IN_MILLISECONDS = 5000;
const MAX_NUMBER_OF_RETRY = 10;
async function authorieCreditCardUntilSuccess(agentId: string, transactionId: string, orderIdPrefix: string, amount: number) {
    let creditCardAuthorizeAction = null;
    let numberOfTryAuthorizeCreditCard = 0;

    while (creditCardAuthorizeAction === null) {
        numberOfTryAuthorizeCreditCard += 1;

        await wait(RETRY_INTERVAL_IN_MILLISECONDS);

        try {
            creditCardAuthorizeAction = await ttts.service.transaction.placeOrderInProgress.action.authorize.creditCard.create(
                agentId,
                transactionId,
                // 試行毎にオーダーIDを変更
                // tslint:disable-next-line:no-magic-numbers
                `${orderIdPrefix}${`00${numberOfTryAuthorizeCreditCard.toString()}`.slice(-2)}`,
                amount,
                ttts.GMO.utils.util.Method.Lump,
                {
                    cardNo: '4111111111111111',
                    expire: '2020',
                    holderName: 'TARO MOTIONPICTURE'
                }
            )(
                new ttts.repository.action.authorize.CreditCard(ttts.mongoose.connection),
                new ttts.repository.Organization(ttts.mongoose.connection),
                new ttts.repository.Transaction(ttts.mongoose.connection)
                );
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
