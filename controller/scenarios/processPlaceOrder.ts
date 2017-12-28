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
const TTTS_API_RESOURECE_SERVER_IDENTIFIER = <string>process.env.TTTS_API_RESOURECE_SERVER_IDENTIFIER;

// tslint:disable-next-line:max-func-body-length
export async function main(organizationIdentifier: string, durationInMilliseconds: number) {
    // get token
    const scopes = [
        `${TTTS_API_RESOURECE_SERVER_IDENTIFIER}/performances.read-only`,
        `${TTTS_API_RESOURECE_SERVER_IDENTIFIER}/transactions`
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
    debug('認証情報を取得できました。expires_in:', credentials.expires_in);

    // パフォーマンス検索
    debug('パフォーマンスを検索しています...');
    const performances = await request.get(
        `${API_ENDPOINT}/performances`,
        {
            auth: { bearer: credentials.access_token },
            json: true,
            qs: {
                start_from: moment().toDate(),
                // tslint:disable-next-line:no-magic-numbers
                start_through: moment().add(1, 'month').toDate(),
                limit: 200
            }
        }
    ).catch(handleError).then((body) => <any[]>body.data);
    debug(`${performances.length}件のパフォーマンスが見つかりました。`);

    if (performances.length === 0) {
        throw new Error('パフォーマンスがありません。');
    }

    // イベント選択時間
    debug('パフォーマンスを決めています...');
    // tslint:disable-next-line:no-magic-numbers
    await wait(durationInMilliseconds / 6);

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
    ).catch(handleError).then((body) => body);
    debug('取引が開始されました。取引ID:', transaction.id);

    // 仮予約
    debug('券種を選択しています...');
    // tslint:disable-next-line:no-magic-numbers
    await wait(durationInMilliseconds / 6);
    let ticketType = performance.attributes.ticket_types[0];
    let seatReservationAuthorizeAction = await request.post(
        `${API_ENDPOINT}/transactions/placeOrder/${transaction.id}/actions/authorize/seatReservation`,
        {
            auth: { bearer: credentials.access_token },
            json: true,
            body: {
                performance_id: performance.id,
                offers: [{
                    ticket_type: ticketType.id,
                    watcher_name: ''
                }]
            }
        }
    ).catch(handleError).then((body) => body);
    debug('仮予約が作成されました。購入番号:', seatReservationAuthorizeAction.result.tmpReservations[0].payment_no);

    debug('券種を変更しています...');
    // tslint:disable-next-line:no-magic-numbers
    await wait(durationInMilliseconds / 6);
    // 仮予約削除
    await request.delete(
        `${API_ENDPOINT}/transactions/placeOrder/${transaction.id}/actions/authorize/seatReservation/${seatReservationAuthorizeAction.id}`,
        {
            auth: { bearer: credentials.access_token },
            json: true
        }
    ).catch(handleError).then((body) => body);
    debug('仮予約が削除されました。');

    // 再仮予約
    ticketType = performance.attributes.ticket_types[0];
    seatReservationAuthorizeAction = await request.post(
        `${API_ENDPOINT}/transactions/placeOrder/${transaction.id}/actions/authorize/seatReservation`,
        {
            auth: { bearer: credentials.access_token },
            json: true,
            body: {
                performance_id: performance.id,
                offers: [{
                    ticket_type: ticketType.id,
                    watcher_name: ''
                }]
            }
        }
    ).catch(handleError).then((body) => body);
    debug('仮予約が作成されました。購入番号:', seatReservationAuthorizeAction.result.tmpReservations[0].payment_no);

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
        credentials.access_token, transaction.id, orderIdPrefix, amount
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
        gender: '0'
    };
    customerContact = await request.put(
        `${API_ENDPOINT}/transactions/placeOrder/${transaction.id}/customerContact`,
        {
            auth: { bearer: credentials.access_token },
            json: true,
            body: customerContact
        }
    ).catch(handleError).then((body) => body);
    debug('購入者情報が登録されました。tel:', customerContact.tel);

    // 確定
    debug('最終確認しています...');
    // tslint:disable-next-line:no-magic-numbers
    await wait(durationInMilliseconds / 6);
    const transactionResult = await request.post(
        `${API_ENDPOINT}/transactions/placeOrder/${transaction.id}/confirm`,
        {
            auth: { bearer: credentials.access_token },
            json: true,
            body: {
                payment_method: ttts.factory.paymentMethodType.CreditCard
            }
        }
    ).catch(handleError).then((body) => <ttts.factory.transaction.placeOrder.IResult>body);
    debug('取引確定です。購入番号:', transactionResult.eventReservations[0].payment_no);

    // send an email
    debug('メールを送信`しています...`');
    const content = `Dear ${customerContact.last_name} ${customerContact.first_name}
-------------------
Thank you for the order below.
-------------------
paymentNo: ${ transactionResult.order.orderInquiryKey.paymentNo}
telephone: ${ transactionResult.order.orderInquiryKey.telephone}
amount: ${ transactionResult.order.price} ${transactionResult.order.priceCurrency}
-------------------
        `;

    await ttts.service.transaction.placeOrder.sendEmail(
        transaction.id,
        {
            sender: {
                name: transaction.seller.name,
                email: 'noreply@example.com'
            },
            toRecipient: {
                name: `${customerContact.last_name} ${customerContact.first_name} `,
                email: customerContact.email
            },
            about: `${transaction.seller.name} ツアー[${performance.attributes.day} -${performance.attributes.tour_number}]`,
            text: content
        }
    )(
        new ttts.repository.Task(ttts.mongoose.connection),
        new ttts.repository.Transaction(ttts.mongoose.connection)
        );
    debug('メールを送信しました。');

    return { transactionResult, numberOfTryAuthorizeCreditCard };
}

const RETRY_INTERVAL_IN_MILLISECONDS = 5000;
const MAX_NUMBER_OF_RETRY = 10;
async function authorieCreditCardUntilSuccess(accessToken: string, transactionId: string, orderIdPrefix: string, amount: number) {
    let creditCardAuthorizeAction = null;
    let numberOfTryAuthorizeCreditCard = 0;

    while (creditCardAuthorizeAction === null) {
        numberOfTryAuthorizeCreditCard += 1;

        await wait(RETRY_INTERVAL_IN_MILLISECONDS);

        try {
            creditCardAuthorizeAction = await request.post(
                `${API_ENDPOINT}/transactions/placeOrder/${transactionId}/actions/authorize/creditCard`,
                {
                    auth: { bearer: accessToken },
                    json: true,
                    body: {
                        // tslint:disable-next-line:no-magic-numbers
                        orderId: `${orderIdPrefix}${`00${numberOfTryAuthorizeCreditCard.toString()}`.slice(-2)}`,
                        amount: amount,
                        method: ttts.GMO.utils.util.Method.Lump,
                        creditCard: {
                            cardNo: '4111111111111111',
                            expire: '2020',
                            holderName: 'TARO MOTIONPICTURE'
                        }
                    }
                }
            ).catch(handleError).then((body) => <ttts.factory.action.authorize.creditCard.IAction>body);
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

function handleError(response: any) {
    let error: any;
    if (response.error !== undefined && response.error.error !== undefined) {
        error = new Error(response.error.error.message);
        error.code = response.error.error.code;
        error.name = response.error.error.name;
    } else {
        error = new Error(response.message);
        (<any>error).code = response.statusCode;
        error.name = 'APIError';
    }

    throw error;
}
