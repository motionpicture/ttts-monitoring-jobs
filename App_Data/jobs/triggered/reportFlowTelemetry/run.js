"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 測定データ報告
 * @ignore
 */
const createDebug = require("debug");
const Controller = require("../../../../controller/reportFlowTelemetry");
const debug = createDebug('ttts-monitoring-jobs');
Controller.main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
