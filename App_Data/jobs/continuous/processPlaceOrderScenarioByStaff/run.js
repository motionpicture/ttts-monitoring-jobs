"use strict";
/**
 * スタッフによる注文シナリオをランダムに実行し続ける
 * @ignore
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
const createDebug = require("debug");
const Scenario = require("../../../../controller/scenarios/processPlaceOrderByStaff");
const debug = createDebug('ttts-monitoring-jobs');
if (process.env.CONTINUOUS_SCENARIOS_BY_STAFF_STOPPED === '1') {
    process.exit(0);
}
if (process.env.NODE_ENV === 'production') {
    process.exit(0);
}
debug('start executing scenarios...');
// tslint:disable-next-line:no-magic-numbers
const INTERVAL = parseInt(process.env.CONTINUOUS_SCENARIOS_BY_STAFF_INTERVAL_IN_SECONDS, 10) * 1000;
const USERNAME = process.env.CONTINUOUS_SCENARIOS_BY_STAFF_USERNAME;
const PASSWORD = process.env.CONTINUOUS_SCENARIOS_BY_STAFF_PASSWORD;
setInterval(() => {
    // 0-{INTERVAL}の間でランダムにインターバルを置いてシナリオを実行する
    // tslint:disable-next-line:insecure-random no-magic-numbers
    const executesAfter = Math.floor(INTERVAL * Math.random());
    const organizationIdentifier = 'TokyoTower';
    setTimeout(() => __awaiter(this, void 0, void 0, function* () {
        try {
            // tslint:disable-next-line:insecure-random no-magic-numbers
            const duration = 300000;
            yield Scenario.main(organizationIdentifier, duration, USERNAME, PASSWORD);
        }
        catch (error) {
            console.error(error, 'organizationIdentifier:', organizationIdentifier);
        }
    }), executesAfter);
}, INTERVAL);
