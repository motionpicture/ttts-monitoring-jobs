/**
 * 注文シナリオをランダムに実行し続ける
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';

import * as processPlaceOrder from '../../../../controller/scenarios/processPlaceOrder';
import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

const debug = createDebug('ttts-monitoring-jobs');

if (process.env.CONTINUOUS_SCENARIOS_STOPPED === '1') {
    process.exit(0);
}

debug('start executing scenarios...');

const INTERVAL = 300000;
ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);
setInterval(
    () => {
        // 0-{INTERVAL}の間でランダムにインターバルを置いてシナリオを実行する
        // tslint:disable-next-line:insecure-random no-magic-numbers
        const executesAfter = Math.floor(INTERVAL * Math.random());
        const organizationIdentifier = 'TokyoTower';

        setTimeout(
            async () => {
                try {
                    // tslint:disable-next-line:insecure-random no-magic-numbers
                    // const duration = Math.floor(500000 * Math.random() + 300000);
                    await processPlaceOrder.main(organizationIdentifier);
                } catch (error) {
                    console.error(error, 'organizationIdentifier:', organizationIdentifier);
                }
            },
            executesAfter
        );
    },
    INTERVAL
);
