"use strict";
/**
 * グローバル測定データを作成する
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
const moment = require("moment");
const mongooseConnectionOptions_1 = require("../../../../mongooseConnectionOptions");
const debug = createDebug('ttts-monitoring-jobs');
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        debug('connecting mongodb...');
        ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        const organizationRepo = new ttts.repository.Organization(ttts.mongoose.connection);
        const taskRepo = new ttts.repository.Task(ttts.mongoose.connection);
        const telemetryRepo = new ttts.repository.Telemetry(ttts.mongoose.connection);
        const transactionRepo = new ttts.repository.Transaction(ttts.mongoose.connection);
        const authorizeActionRepo = new ttts.repository.action.Authorize(ttts.mongoose.connection);
        debug('creating telemetry...');
        const dateNow = moment();
        // tslint:disable-next-line:no-magic-numbers
        const measuredAt = moment.unix((dateNow.unix() - (dateNow.unix() % 60)));
        // 劇場組織ごとに販売者向け測定データを作成する
        const corporations = [yield organizationRepo.findCorporationByIdentifier('TokyoTower')];
        yield Promise.all(corporations.map((corporation) => __awaiter(this, void 0, void 0, function* () {
            yield ttts.service.report.telemetry.createStock({
                measuredAt: measuredAt.toDate(),
                sellerId: corporation.id
            })(taskRepo, telemetryRepo, transactionRepo, authorizeActionRepo);
        })));
        yield ttts.service.report.telemetry.createStock({
            measuredAt: measuredAt.toDate()
        })(taskRepo, telemetryRepo, transactionRepo, authorizeActionRepo);
        ttts.mongoose.disconnect();
    });
}
exports.main = main;
main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
