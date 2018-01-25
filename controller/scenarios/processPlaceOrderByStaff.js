"use strict";
/**
 * スタッフによる注文取引シナリオ
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
const tttsapi = require("@motionpicture/ttts-api-nodejs-client");
const createDebug = require("debug");
const moment = require("moment");
const request = require("request-promise-native");
const debug = createDebug('ttts-monitoring-jobs');
const auth = new tttsapi.auth.OAuth2({
    domain: process.env.TTTS_ADMIN_API_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.TTTS_ADMIN_API_CLIENT_ID,
    clientSecret: process.env.TTTS_ADMIN_API_CLIENT_SECRET,
    scopes: [
        `${process.env.TTTS_API_RESOURECE_SERVER_IDENTIFIER}/performances.read-only`,
        `${process.env.TTTS_API_RESOURECE_SERVER_IDENTIFIER}/transactions`
    ],
    state: 'teststate'
});
const events = new tttsapi.service.Event({
    endpoint: process.env.TTTS_API_ENDPOINT,
    auth: auth
});
const placeOrderTransactions = new tttsapi.service.transaction.PlaceOrder({
    endpoint: process.env.TTTS_API_ENDPOINT,
    auth: auth
});
const adminService = new tttsapi.service.Admin({
    endpoint: process.env.TTTS_API_ENDPOINT,
    auth: auth
});
// tslint:disable-next-line:max-func-body-length
function main(organizationIdentifier, durationInMilliseconds, username, password) {
    return __awaiter(this, void 0, void 0, function* () {
        // ログイン
        const cognitoCredentials = yield request.post(`${process.env.TTTS_API_ENDPOINT}/oauth/token`, {
            auth: {
                user: process.env.TTTS_ADMIN_API_CLIENT_ID,
                pass: process.env.TTTS_ADMIN_API_CLIENT_SECRET
            },
            json: true,
            body: {
                username: username,
                password: password
            }
        }).then((body) => body);
        debug('cognito credentials published.', cognitoCredentials.tokenType);
        // 認証情報をクライアントにセット
        auth.setCredentials({
            refresh_token: cognitoCredentials.refreshToken,
            // expiry_date: number;
            access_token: cognitoCredentials.accessToken,
            token_type: cognitoCredentials.tokenType
        });
        const customer = yield adminService.getProfile();
        debug(customer.username, 'による注文取引を開始しようとしています...');
        // パフォーマンス検索
        debug('パフォーマンスを検索しています...');
        const searchPerformancesResult = yield events.searchPerformances({
            startFrom: moment(process.env.CONTINUOUS_SCENARIOS_BY_STAFF_EVENTS_SEARCH_FROM).toDate(),
            startThrough: moment(process.env.CONTINUOUS_SCENARIOS_BY_STAFF_EVENTS_SEARCH_THROUGH).toDate()
        });
        debug(`${searchPerformancesResult.data.length}件のパフォーマンスが見つかりました。`);
        let performances = searchPerformancesResult.data;
        // 空席ありのイベントに絞る(販売情報がないことがあるので、あるものだけに絞る)
        performances = performances.filter((p) => p.remainingAttendeeCapacity > 0 && p.ticketTypes.length > 0);
        if (performances.length === 0) {
            throw new Error('パフォーマンスがありません。');
        }
        // スタッフはwaiter許可証不要
        const passportToken = undefined;
        // 取引開始
        const transaction = yield placeOrderTransactions.start({
            // tslint:disable-next-line:no-magic-numbers
            expires: moment().add(15, 'minutes').toDate(),
            sellerIdentifier: organizationIdentifier,
            purchaserGroup: tttsapi.factory.person.Group.Staff,
            passportToken: passportToken
        });
        debug('取引が開始されました。取引ID:', transaction.id);
        // イベント選択時間
        debug('パフォーマンスを決めています...');
        // tslint:disable-next-line:no-magic-numbers
        yield wait(durationInMilliseconds / 6);
        // tslint:disable-next-line:insecure-random
        const performance = performances[Math.floor(performances.length * Math.random())];
        debug('パフォーマンスを決めました。', performance.id);
        // 仮予約
        debug('券種を選択しています...');
        // tslint:disable-next-line:no-magic-numbers
        yield wait(durationInMilliseconds / 6);
        const ticketType = performance.ticketTypes.find((t) => t.id === '001');
        if (ticketType === undefined) {
            throw new Error('TicketType 001 not found.');
        }
        const seatReservationAuthorizeAction = yield placeOrderTransactions.createSeatReservationAuthorization({
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
        // 購入者情報登録
        debug('購入者情報を入力しています...');
        // tslint:disable-next-line:no-magic-numbers
        yield wait(durationInMilliseconds / 6);
        let customerContact = {
            last_name: customer.familyName,
            first_name: customer.givenName,
            email: customer.email,
            tel: customer.telephone,
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
            paymentMethod: tttsapi.factory.paymentMethodType.Invitation
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
        return { transactionResult };
    });
}
exports.main = main;
function wait(waitInMilliseconds) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => setTimeout(resolve, waitInMilliseconds));
    });
}
