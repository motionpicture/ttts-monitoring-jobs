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
const tower = require("@motionpicture/ttts-api-nodejs-client");
const createDebug = require("debug");
const moment = require("moment");
const util = require("util");
const debug = createDebug('ttts-monitoring-jobs');
const auth = new tower.auth.ClientCredentials({
    domain: process.env.TTTS_API_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.TTTS_API_CLIENT_ID,
    clientSecret: process.env.TTTS_API_CLIENT_SECRET,
    scopes: [
        `${process.env.TTTS_API_RESOURECE_SERVER_IDENTIFIER}/performances.read-only`,
        `${process.env.TTTS_API_RESOURECE_SERVER_IDENTIFIER}/transactions`
    ],
    state: 'teststate'
});
const events = new tower.service.Event({
    endpoint: process.env.TTTS_API_ENDPOINT,
    auth: auth
});
const placeOrderTransactions = new tower.service.transaction.PlaceOrder({
    endpoint: process.env.TTTS_API_ENDPOINT,
    auth: auth
});
// tslint:disable-next-line:max-func-body-length
function main(organizationIdentifier, durationInMilliseconds) {
    return __awaiter(this, void 0, void 0, function* () {
        // パフォーマンス検索
        debug('パフォーマンスを検索しています...');
        const searchPerformancesResult = yield events.searchPerformances({
            startFrom: moment().toDate(),
            // tslint:disable-next-line:no-magic-numbers
            startThrough: moment().add(1, 'month').toDate()
        });
        debug(`${searchPerformancesResult.data.length}件のパフォーマンスが見つかりました。`);
        const performances = searchPerformancesResult.data;
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
        const transaction = yield placeOrderTransactions.start({
            // tslint:disable-next-line:no-magic-numbers
            expires: moment().add(15, 'minutes').toDate(),
            sellerIdentifier: organizationIdentifier,
            purchaserGroup: 'Customer'
        });
        debug('取引が開始されました。取引ID:', transaction.id);
        // 仮予約
        debug('券種を選択しています...');
        // tslint:disable-next-line:no-magic-numbers
        yield wait(durationInMilliseconds / 6);
        let ticketType = performance.ticketTypes[0];
        let seatReservationAuthorizeAction = yield placeOrderTransactions.createSeatReservationAuthorization({
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
        yield wait(durationInMilliseconds / 6);
        // 仮予約削除
        yield placeOrderTransactions.cancelSeatReservationAuthorization({
            transactionId: transaction.id,
            actionId: seatReservationAuthorizeAction.id
        });
        debug('仮予約が削除されました。');
        // 再仮予約
        ticketType = performance.ticketTypes[0];
        seatReservationAuthorizeAction = yield placeOrderTransactions.createSeatReservationAuthorization({
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
        const orderIdPrefix = util.format('%s%s%s', moment().format('YYYYMMDD'), moment(performance.startDate).format('YYYYMMDD'), 
        // tslint:disable-next-line:no-magic-numbers
        `00000000${seatReservationAuthorizeAction.result.tmpReservations[0].payment_no}`.slice(-8));
        debug('クレジットカードのオーソリをとります...', orderIdPrefix);
        // tslint:disable-next-line:max-line-length
        const { creditCardAuthorizeAction, numberOfTryAuthorizeCreditCard } = yield authorieCreditCardUntilSuccess(transaction.id, orderIdPrefix, amount);
        debug(`${numberOfTryAuthorizeCreditCard}回目でオーソリがとれました。アクションID:`, creditCardAuthorizeAction.id);
        // 購入者情報登録
        debug('購入者情報を入力しています...');
        // tslint:disable-next-line:no-magic-numbers
        yield wait(durationInMilliseconds / 6);
        let customerContact = {
            last_name: 'せい',
            first_name: 'めい',
            email: process.env.TTTS_DEVELOPER_EMAIL,
            tel: '09012345678',
            gender: '0',
            age: '',
            address: ''
        };
        customerContact = yield placeOrderTransactions.setCustomerContact({
            transactionId: transaction.id,
            contact: customerContact
        });
        debug('購入者情報が登録されました。tel:', customerContact.tel);
        // 確定
        debug('最終確認しています...');
        // tslint:disable-next-line:no-magic-numbers
        yield wait(durationInMilliseconds / 6);
        const transactionResult = yield placeOrderTransactions.confirm({
            transactionId: transaction.id,
            paymentMethod: 'CreditCard'
        });
        debug('取引確定です。購入番号:', transactionResult.eventReservations[0].payment_no);
        // send an email
        debug('メールを送信しています...');
        const content = `Dear ${customerContact.last_name} ${customerContact.first_name}
-------------------
Thank you for the order below.
-------------------
paymentNo: ${transactionResult.order.orderInquiryKey.paymentNo}
telephone: ${transactionResult.order.orderInquiryKey.telephone}
amount: ${transactionResult.order.price} ${transactionResult.order.priceCurrency}
-------------------
        `;
        yield placeOrderTransactions.sendEmailNotification({
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
    });
}
exports.main = main;
const RETRY_INTERVAL_IN_MILLISECONDS = 5000;
const MAX_NUMBER_OF_RETRY = 10;
function authorieCreditCardUntilSuccess(transactionId, orderIdPrefix, amount) {
    return __awaiter(this, void 0, void 0, function* () {
        let creditCardAuthorizeAction = null;
        let numberOfTryAuthorizeCreditCard = 0;
        while (creditCardAuthorizeAction === null) {
            numberOfTryAuthorizeCreditCard += 1;
            yield wait(RETRY_INTERVAL_IN_MILLISECONDS);
            try {
                creditCardAuthorizeAction = yield placeOrderTransactions.createCreditCardAuthorization({
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
