/**
 * GMO実売上状況を報告する
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

export async function main() {
    ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

    await reportGMOSalesAggregations();
    await reportScatterChartInAmountAndTranDate();

    ttts.mongoose.disconnect();
}

/**
 * 時間帯ごとの実売上をプロットしてみる
 */
async function reportScatterChartInAmountAndTranDate() {
    // ここ24時間の実売上をプロットする
    const madeThrough = moment();
    // tslint:disable-next-line:no-magic-numbers
    const madeFrom = moment(madeThrough).add(-3, 'days');
    const gmoNotificationRepo = new ttts.repository.GMONotification(ttts.mongoose.connection);
    const gmoNotifications = await gmoNotificationRepo.searchSales({
        tranDateFrom: madeFrom.toDate(),
        tranDateThrough: madeThrough.toDate()
    });
    debug('gmoNotifications:', gmoNotifications.length);
    // tslint:disable-next-line:no-magic-numbers
    const maxAmount = gmoNotifications.reduce((a, b) => Math.max(a, b.amount), 0);
    debug('maxAmount:', maxAmount);

    // 時間帯x金額帯ごとに集計
    const AMOUNT_UNIT = 1000;
    const prots: {
        [key: string]: {
            x: number;
            y: number;
            size: number;
        };
    } = {};
    gmoNotifications.forEach((gmoNotification) => {
        // tslint:disable-next-line:no-magic-numbers
        const x = Number(gmoNotification.tranDate.slice(8, 10));
        const y = Math.floor(gmoNotification.amount / AMOUNT_UNIT);
        if (prots[`${x}x${y}`] === undefined) {
            prots[`${x}x${y}`] = {
                x: x,
                y: y,
                size: 0
            };
        }

        prots[`${x}x${y}`].size += 1;
    });
    debug('prots:', prots);
    const sizeMax = Object.keys(prots).reduce((a, b) => Math.max(a, prots[b].size), 0);
    debug('sizeMax:', sizeMax);

    const params = {
        ...defaultParams, ...{
            cht: 's',
            chco: '3399FF',
            chxt: 'x,x,y,y',
            chds: `0,24,0,${Math.floor(maxAmount / AMOUNT_UNIT) + 1}`,
            chd: 't:',
            chxl: '1:|時台|3:|千円台',
            chxr: `0,0,24,1|2,0,${Math.floor(maxAmount / AMOUNT_UNIT) + 1}`,
            chg: '100,100',
            chs: '800x300'
        }
    };
    params.chd += Object.keys(prots).map((key) => prots[key].x).join(',');
    params.chd += `|${Object.keys(prots).map((key) => prots[key].y).join(',')}`;
    // tslint:disable-next-line:no-magic-numbers
    params.chd += `|${Object.keys(prots).map((key) => Math.floor(prots[key].size / sizeMax * 50)).join(',')}`;
    // params.chd += gmoNotifications.map((gmoNotification) => Number(gmoNotification.tran_date.slice(8, 10))).join(',');
    // params.chd += '|' + gmoNotifications.map((gmoNotification) => Math.floor(gmoNotification.amount / 100)).join(',');
    const imageFullsize = await GoogleChart.publishUrl(params);

    await ttts.service.notification.report2developers(
        `GMO売上散布図
${madeFrom.format('MM/DD HH:mm:ss')}-${madeThrough.format('MM/DD HH:mm:ss')}`,
        `サンプル数:${gmoNotifications.length}`,
        imageFullsize,
        imageFullsize
    )();
}

async function reportGMOSalesAggregations() {
    // todo パラメータで期間設定できるようにする？
    // tslint:disable-next-line:no-magic-numbers
    const aggregationUnitTimeInSeconds = 900; // 集計単位時間(秒)
    const numberOfAggregationUnit = 96; // 集計単位数
    const dateNow = moment();
    const dateNowByUnitTime = moment.unix((dateNow.unix() - (dateNow.unix() % aggregationUnitTimeInSeconds)));

    // 集計単位数分の集計を行う
    let aggregations = await Promise.all(Array.from(Array(numberOfAggregationUnit)).map(async (__, index) => {
        debug(index);
        const madeThrough = moment.unix((dateNowByUnitTime.unix() - (dateNowByUnitTime.unix() % aggregationUnitTimeInSeconds)))
            // tslint:disable-next-line:no-magic-numbers
            .add(index * -aggregationUnitTimeInSeconds, 'seconds').toDate();
        // tslint:disable-next-line:no-magic-numbers
        const madeFrom = moment(madeThrough).add(-aggregationUnitTimeInSeconds, 'seconds').toDate();
        debug(madeFrom.toISOString(), madeThrough.toISOString());

        const gmoNotificationRepo = new ttts.repository.GMONotification(ttts.mongoose.connection);
        const gmoSales = await gmoNotificationRepo.searchSales({
            tranDateFrom: madeFrom,
            tranDateThrough: madeThrough
        });

        return {
            madeFrom: madeFrom,
            madeThrough: madeThrough,
            gmoSales: gmoSales,
            totalAmount: gmoSales.reduce((a, b) => a + b.amount, 0) // 合計金額を算出
        };
    }));
    aggregations = aggregations.reverse();
    debug('aggregations:', aggregations);

    const AMOUNT_UNIT = 100;
    const params = {
        ...defaultParams, ...{
            cht: 'ls',
            chco: '3399FF',
            chxt: 'x,y,y',
            chds: 'a',
            chd: 't:',
            chxl: '0:|24時間前|18時間前|12時間前|6時間前|0時間前|2:|百円',
            chg: '25,10',
            chs: '750x250'
        }
    };
    params.chd += aggregations.map((agrgegation) => Math.floor(agrgegation.totalAmount / AMOUNT_UNIT)).join(',');
    const imageFullsize = await GoogleChart.publishUrl(params);

    const lastAggregation = aggregations[aggregations.length - 1];

    await ttts.service.notification.report2developers(
        `GMO売上金額遷移(15分単位)
${moment(aggregations[0].madeFrom).format('MM/DD HH:mm:ss')}-${moment(lastAggregation.madeThrough).format('MM/DD HH:mm:ss')}`,
        '',
        imageFullsize,
        imageFullsize
    )();
}
