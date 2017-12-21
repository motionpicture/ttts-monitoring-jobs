"use strict";
/**
 * 注文シナリオをランダムに実行し続ける
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
const ttts = require("@motionpicture/ttts-domain");
const createDebug = require("debug");
const processPlaceOrder = require("../../../../controller/scenarios/processPlaceOrder");
const mongooseConnectionOptions_1 = require("../../../../mongooseConnectionOptions");
const debug = createDebug('ttts-monitoring-jobs');
if (process.env.CONTINUOUS_SCENARIOS_STOPPED === '1') {
    process.exit(0);
}
debug('start executing scenarios...');
const INTERVAL = 300000;
ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
setInterval(() => {
    // 0-{INTERVAL}の間でランダムにインターバルを置いてシナリオを実行する
    // tslint:disable-next-line:insecure-random no-magic-numbers
    const executesAfter = Math.floor(INTERVAL * Math.random());
    const organizationIdentifier = 'TokyoTower';
    setTimeout(() => __awaiter(this, void 0, void 0, function* () {
        try {
            // tslint:disable-next-line:insecure-random no-magic-numbers
            // const duration = Math.floor(500000 * Math.random() + 300000);
            yield processPlaceOrder.main(organizationIdentifier);
        }
        catch (error) {
            console.error(error, 'organizationIdentifier:', organizationIdentifier);
        }
    }), executesAfter);
}, INTERVAL);
