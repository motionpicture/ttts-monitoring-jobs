/**
 * ストック測定データを報告する
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';

import mongooseConnectionOptions from '../mongooseConnectionOptions';
import * as GoogleChart from './googleChart';

const debug = createDebug('ttts-monitoring-jobs');
const defaultParams = {
    chco: 'DAA8F5',
    chf: 'bg,s,283037',
    chof: 'png',
    cht: 'ls',
    chds: 'a',
    chdls: 'a1a6a9,12',
    chls: '1,0,0|1,0,0|1,0,0',
    chxs: '0,a1a6a9,12|1,a1a6a9,12|2,a1a6a9,12'
};

type IGlobalStockTelemetry = ttts.service.report.telemetry.IGlobalStockTelemetry;
type ISellerStockTelemetry = ttts.service.report.telemetry.ISellerStockTelemetry;

// tslint:disable-next-line:max-func-body-length
export async function main() {
    debug('connecting mongodb...');
    ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

    // 集計単位数分の集計を行う
    const telemetryUnitTimeInSeconds = 60; // 集計単位時間(秒)
    const numberOfAggregationUnit = 720; // 集計単位数
    // tslint:disable-next-line:no-magic-numbers
    const dateNow = moment();
    const dateNowByUnitTime = moment.unix(dateNow.unix() - (dateNow.unix() % telemetryUnitTimeInSeconds));

    // 基本的に、集計は別のジョブでやっておいて、この報告ジョブでは取得して表示するだけのイメージ
    // tslint:disable-next-line:no-magic-numbers
    const measuredFrom = moment(dateNowByUnitTime).add(numberOfAggregationUnit * -telemetryUnitTimeInSeconds, 'seconds');

    debug('reporting telemetries measuredFrom - dateTo...', measuredFrom, dateNowByUnitTime);
    const organizationRepo = new ttts.repository.Organization(ttts.mongoose.connection);
    const telemetryRepo = new ttts.repository.Telemetry(ttts.mongoose.connection);

    const corporations = [await organizationRepo.findCorporationByIdentifier('TokyoTower')];

    const globalTelemetries = await ttts.service.report.telemetry.searchGlobalStock({
        measuredFrom: measuredFrom.toDate(),
        measuredThrough: dateNowByUnitTime.toDate()
    })(telemetryRepo);
    debug('globalTelemetries length:', globalTelemetries.length);

    const sellerTelemetries = await ttts.service.report.telemetry.searchSellerStock({
        measuredFrom: measuredFrom.toDate(),
        measuredThrough: dateNowByUnitTime.toDate()
    })(telemetryRepo);
    debug('sellerTelemetries length:', sellerTelemetries.length);

    ttts.mongoose.disconnect();

    await reportNumberOfTasksUnexecuted(globalTelemetries);

    // 販売者ごとにレポート送信
    await Promise.all(corporations.map(async (corporation) => {
        debug('reporting...seller:', corporation.id);
        const telemetriesBySellerId = sellerTelemetries.filter((telemetry) => telemetry.object.sellerId === corporation.id);
        await reportNumberOfTransactionsUnderway(corporation.name.ja, telemetriesBySellerId);
    }));
}

/**
 * 進行中取引数を報告する
 */
async function reportNumberOfTransactionsUnderway(sellerName: string, telemetries: ISellerStockTelemetry[]) {
    const params = {
        ...defaultParams, ...{
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前',
            chdl: '進行取引',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map((telemetry) => telemetry.result.transactions.numberOfUnderway).join(',');
    const imageFullsize = await GoogleChart.publishUrl(params);

    await ttts.service.notification.report2developers(
        `${sellerName}\n時点での進行中取引数`,
        '',
        imageFullsize,
        imageFullsize
    )();
}

/**
 * 未実行タスク数を報告する
 */
async function reportNumberOfTasksUnexecuted(telemetries: IGlobalStockTelemetry[]) {
    const params = {
        ...defaultParams, ...{
            chco: 'DAA8F5',
            chxt: 'x,y',
            chd: 't:',
            chxl: '0:|12時間前|9時間前|6時間前|3時間前|0時間前',
            chdl: 'タスク',
            chs: '750x250'
        }
    };
    params.chd += telemetries.map(
        (telemetry) => (telemetry.result.tasks !== undefined) ? telemetry.result.tasks.numberOfUnexecuted : 0
    ).join(',');
    const imageFullsize = await GoogleChart.publishUrl(params);

    await ttts.service.notification.report2developers(
        '時点でのタスク数',
        '',
        imageFullsize,
        imageFullsize
    )();
}
