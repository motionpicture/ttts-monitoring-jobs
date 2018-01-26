/**
 * スタッフによる注文シナリオをランダムに実行し続ける
 * @ignore
 */

import * as createDebug from 'debug';

import * as Scenario from '../../../../controller/scenarios/processPlaceOrderByStaff';

const debug = createDebug('ttts-monitoring-jobs');

if (process.env.CONTINUOUS_SCENARIOS_BY_STAFF_STOPPED === '1') {
    process.exit(0);
}

if (process.env.NODE_ENV === 'production') {
    process.exit(0);
}

debug('start executing scenarios...');

// tslint:disable-next-line:no-magic-numbers
const INTERVAL = parseInt(<string>process.env.CONTINUOUS_SCENARIOS_BY_STAFF_INTERVAL_IN_SECONDS, 10) * 1000;
const USERNAME = <string>process.env.CONTINUOUS_SCENARIOS_BY_STAFF_USERNAME;
const PASSWORD = <string>process.env.CONTINUOUS_SCENARIOS_BY_STAFF_PASSWORD;
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
                    const duration = 300000;
                    await Scenario.main(organizationIdentifier, duration, USERNAME, PASSWORD);
                } catch (error) {
                    console.error(error, 'organizationIdentifier:', organizationIdentifier);
                }
            },
            executesAfter
        );
    },
    INTERVAL
);
