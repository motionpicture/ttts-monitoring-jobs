"use strict";
/**
 * 注文取引シナリオ
 * @module
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ttts = require("@motionpicture/ttts-domain");
const createDebug = require("debug");
const moment = require("moment");
const request = require("request-promise-native");
const util = require("util");
const debug = createDebug('ttts-monitoring-jobs');
const API_ENDPOINT = process.env.TTTS_API_ENDPOINT;
// tslint:disable-next-line:max-func-body-length
function main(organizationIdentifier, durationInMilliseconds) {
    return __awaiter(this, void 0, void 0, function* () {
        // get token
        const scopes = [
            'https://ttts-api-development.azurewebsites.net/performances.read-only',
            'https://ttts-api-development.azurewebsites.net/transactions'
        ];
        const credentials = yield request.post(`https://${process.env.TTTS_API_AUTHORIZE_SERVER_DOMAIN}/token`, {
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
        });
        debug('認証情報を取得できました。', credentials.access_token);
        // パフォーマンス検索
        debug('パフォーマンスを検索しています...');
        const performances = yield request.get(`${API_ENDPOINT}/performances`, {
            auth: { bearer: credentials.access_token },
            json: true,
            qs: {
                start_from: moment().toDate(),
                // tslint:disable-next-line:no-magic-numbers
                start_through: moment().add(1, 'month').toDate(),
                limit: 50
            }
        }).catch(handleError).then((body) => body.data);
        debug('パフォーマンスが見つかりました。', performances.length);
        if (performances.length === 0) {
            throw new Error('パフォーマンスがありません。');
        }
        // イベント選択時間
        debug('パフォーマンスを決めています...');
        // tslint:disable-next-line:no-magic-numbers
        yield wait(durationInMilliseconds / 6);
        // tslint:disable-next-line:insecure-random
        const performance = performances[Math.floor(performances.length * Math.random())];
        // 取引開始
        const transaction = yield request.post(`${API_ENDPOINT}/transactions/placeOrder/start`, {
            auth: { bearer: credentials.access_token },
            json: true,
            body: {
                // tslint:disable-next-line:no-magic-numbers
                expires: moment().add(15, 'minutes').toISOString(),
                seller_identifier: organizationIdentifier,
                purchaser_group: ttts.factory.person.Group.Customer
            }
        }).catch(handleError).then((body) => body);
        debug('取引が開始されました。', transaction.id);
        // 仮予約
        debug('券種を選択しています...');
        // tslint:disable-next-line:no-magic-numbers
        yield wait(durationInMilliseconds / 6);
        let ticketType = performance.attributes.ticket_types[0];
        let seatReservationAuthorizeAction = yield request.post(`${API_ENDPOINT}/transactions/placeOrder/${transaction.id}/actions/authorize/seatReservation`, {
            auth: { bearer: credentials.access_token },
            json: true,
            body: {
                perfomance_id: performance.id,
                offers: [{
                        ticket_type: ticketType.id,
                        watcher_name: ''
                    }]
            }
        }).catch(handleError).then((body) => body);
        debug('仮予約が作成されました。', seatReservationAuthorizeAction.result.tmpReservations[0].payment_no);
        debug('券種を変更しています...');
        // tslint:disable-next-line:no-magic-numbers
        yield wait(durationInMilliseconds / 6);
        // 仮予約削除
        yield request.delete(`${API_ENDPOINT}/transactions/placeOrder/${transaction.id}/actions/authorize/seatReservation/${seatReservationAuthorizeAction.id}`, {
            auth: { bearer: credentials.access_token },
            json: true
        }).catch(handleError).then((body) => body);
        debug('仮予約が削除されました。');
        // 再仮予約
        ticketType = performance.attributes.ticket_types[0];
        seatReservationAuthorizeAction = yield request.post(`${API_ENDPOINT}/transactions/placeOrder/${transaction.id}/actions/authorize/seatReservation`, {
            auth: { bearer: credentials.access_token },
            json: true,
            body: {
                perfomance_id: performance.id,
                offers: [{
                        ticket_type: ticketType.id,
                        watcher_name: ''
                    }]
            }
        }).catch(handleError).then((body) => body);
        debug('仮予約が作成されました。', seatReservationAuthorizeAction.result.tmpReservations[0].payment_no);
        const amount = seatReservationAuthorizeAction.result.price;
        const orderIdPrefix = util.format('%s%s%s', moment().format('YYYYMMDD'), performance.attributes.day, 
        // tslint:disable-next-line:no-magic-numbers
        `00000000${seatReservationAuthorizeAction.result.tmpReservations[0].payment_no}`.slice(-8));
        debug('クレジットカードのオーソリをとります...', orderIdPrefix);
        // tslint:disable-next-line:max-line-length
        const { creditCardAuthorizeAction, numberOfTryAuthorizeCreditCard } = yield authorieCreditCardUntilSuccess(transaction.agent.id, transaction.id, orderIdPrefix, amount);
        debug('オーソリがとれました。', creditCardAuthorizeAction.result.execTranResult.tranId);
        // 購入者情報登録
        debug('購入者情報を入力しています...');
        // tslint:disable-next-line:no-magic-numbers
        yield wait(durationInMilliseconds / 6);
        let customerContact = {
            last_name: 'せい',
            first_name: 'めい',
            email: process.env.TTTS_DEVELOPER_EMAIL,
            tel: '09012345678',
            gender: '0'
        };
        customerContact = yield request.put(`${API_ENDPOINT}/transactions/placeOrder/${transaction.id}/customerContact`, {
            auth: { bearer: credentials.access_token },
            json: true,
            body: customerContact
        }).catch(handleError).then((body) => body);
        debug('購入者情報が登録されました。', customerContact.tel);
        // 確定
        debug('最終確認しています...');
        // tslint:disable-next-line:no-magic-numbers
        yield wait(durationInMilliseconds / 6);
        const transactionResult = yield request.post(`${API_ENDPOINT}/transactions/placeOrder/${transaction.id}/confirm`, {
            auth: { bearer: credentials.access_token },
            json: true,
            body: {
                payment_method: ttts.factory.paymentMethodType.CreditCard
            }
        }).catch(handleError).then((body) => body);
        debug('取引確定です。', transactionResult.eventReservations[0].payment_no);
        // send an email
        const content = `Dear ${customerContact.last_name} ${customerContact.first_name}
-------------------
Thank you for the order below.
-------------------
paymentNo: ${transactionResult.order.orderInquiryKey.paymentNo}
telephone: ${transactionResult.order.orderInquiryKey.telephone}
amount: ${transactionResult.order.price} ${transactionResult.order.priceCurrency}
-------------------
        `;
        yield ttts.Models.EmailQueue.create({
            // tslint:disable-next-line:no-reserved-keywords
            from: {
                address: 'noreply@example.com',
                name: transaction.seller.name
            },
            to: {
                name: `${customerContact.last_name} ${customerContact.first_name} `,
                address: customerContact.email
            },
            subject: `${transaction.seller.name} ツアー[${performance.attributes.day} -${performance.attributes.tour_number}]`,
            content: {
                mimetype: 'text/plain',
                text: content
            },
            status: ttts.EmailQueueUtil.STATUS_UNSENT
        });
        debug('メールを送信しました。');
        return { transactionResult, numberOfTryAuthorizeCreditCard };
    });
}
exports.main = main;
const RETRY_INTERVAL_IN_MILLISECONDS = 5000;
const MAX_NUMBER_OF_RETRY = 10;
function authorieCreditCardUntilSuccess(agentId, transactionId, orderIdPrefix, amount) {
    return __awaiter(this, void 0, void 0, function* () {
        let creditCardAuthorizeAction = null;
        let numberOfTryAuthorizeCreditCard = 0;
        while (creditCardAuthorizeAction === null) {
            numberOfTryAuthorizeCreditCard += 1;
            yield wait(RETRY_INTERVAL_IN_MILLISECONDS);
            try {
                creditCardAuthorizeAction = yield ttts.service.transaction.placeOrderInProgress.action.authorize.creditCard.create(agentId, transactionId, 
                // 試行毎にオーダーIDを変更
                // tslint:disable-next-line:no-magic-numbers
                `${orderIdPrefix}${`00${numberOfTryAuthorizeCreditCard.toString()}`.slice(-2)}`, amount, ttts.GMO.utils.util.Method.Lump, {
                    cardNo: '4111111111111111',
                    expire: '2020',
                    holderName: 'TARO MOTIONPICTURE'
                })(new ttts.repository.action.authorize.CreditCard(ttts.mongoose.connection), new ttts.repository.Organization(ttts.mongoose.connection), new ttts.repository.Transaction(ttts.mongoose.connection));
            }
            catch (error) {
                if (numberOfTryAuthorizeCreditCard >= MAX_NUMBER_OF_RETRY) {
                    throw error;
                }
            }
        }
        return {
            creditCardAuthorizeAction,
            numberOfTryAuthorizeCreditCard
        };
    });
}
function wait(waitInMilliseconds) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => setTimeout(resolve, waitInMilliseconds));
    });
}
function handleError(response) {
    let error;
    if (response.error !== undefined && response.error.error !== undefined) {
        error = new Error(response.error.error.message);
        error.code = response.error.error.code;
        error.name = response.error.error.name;
    }
    else {
        error = new Error(response.message);
        error.code = response.statusCode;
        error.name = 'APIError';
    }
    throw error;
}
