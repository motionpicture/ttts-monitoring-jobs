/**
 * 販売者向け測定データを作成する
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

const debug = createDebug('ttts-monitoring-jobs');

export async function main() {
    debug('connecting mongodb...');
    ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

    const organizationRepo = new ttts.repository.Organization(ttts.mongoose.connection);
    const taskRepo = new ttts.repository.Task(ttts.mongoose.connection);
    const telemetryRepo = new ttts.repository.Telemetry(ttts.mongoose.connection);
    const transactionRepo = new ttts.repository.Transaction(ttts.mongoose.connection);
    const authorizeActionRepo = new ttts.repository.action.Authorize(ttts.mongoose.connection);
    debug('creating telemetry...');

    // 取引セッション時間に対して十分に時間を置いて計測する
    // tslint:disable-next-line:no-magic-numbers
    const dateNow = moment().add(-30, 'minutes');
    // tslint:disable-next-line:no-magic-numbers
    const measuredAt = moment.unix((dateNow.unix() - (dateNow.unix() % 60)));

    // 劇場組織ごとに販売者向け測定データを作成する
    const corporations = [await organizationRepo.findCorporationByIdentifier('TokyoTower')];
    await Promise.all(corporations.map(async (corporation) => {
        await ttts.service.report.telemetry.createFlow({
            measuredAt: measuredAt.toDate(),
            sellerId: corporation.id
        })(taskRepo, telemetryRepo, transactionRepo, authorizeActionRepo);
    }));

    await ttts.service.report.telemetry.createFlow({
        measuredAt: measuredAt.toDate()
    })(taskRepo, telemetryRepo, transactionRepo, authorizeActionRepo);

    ttts.mongoose.disconnect();
}

main().then(() => {
    debug('success!');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
