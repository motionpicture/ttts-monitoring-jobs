<img src="https://motionpicture.jp/images/common/logo_01.svg" alt="motionpicture" title="motionpicture" align="right" height="56" width="98"/>

# 東京タワーチケット予約システム監視ジョブアプリケーション

[![CircleCI](https://circleci.com/gh/motionpicture/ttts-monitoring-jobs.svg?style=svg&circle-token=3f19d3ae6b688567589a4d877acc4a45cc6cc737)](https://circleci.com/gh/motionpicture/ttts-monitoring-jobs)


## Table of contents

* [Usage](#usage)
* [Code Samples](#code-samples)
* [Jsdoc](#jsdoc)
* [License](#license)

## Usage

### Environment variables

| Name                                      | Required | Value                  | Purpose                      |
| ----------------------------------------- | -------- | ---------------------- | ---------------------------- |
| `DEBUG`                                   | false    | ttts-monitoring-jobs:* | Debug                        |
| `NPM_TOKEN`                               | true     |                        | NPM auth token               |
| `NODE_ENV`                                | true     |                        | environment name             |
| `MONGOLAB_URI`                            | true     |                        | MongoDB connection URI       |
| `SENDGRID_API_KEY`                        | true     |                        | SendGrid API Key             |
| `GMO_ENDPOINT`                            | true     |                        | GMO API endpoint             |
| `TTTS_DEVELOPER_EMAIL`                    | true     |                        | 開発者通知用メールアドレス          |
| `TTTS_DEVELOPER_LINE_NOTIFY_ACCESS_TOKEN` | true     |                        | LINE Notifyでのレポート通知        |
| `AZURE_STORAGE_CONNECTION_STRING`         | true     |                        | Save charts on azure storage |
| `CHART_EXPIRES_IN_MONTH`                  | true     |                        | チャート表示有効期間(ヵ月)        |
| `TTTS_API_CLIENT_ID`                      | true     |                        | TTTS APIクライアントID             |
| `TTTS_API_CLIENT_SECRET`                  | true     |                        | TTTS APIクライアントシークレット         |
| `TTTS_API_AUTHORIZE_SERVER_DOMAIN`        | true     |                        | TTTS API認可サーバードメイン         |
| `TTTS_API_RESOURCE_SERVER_IDENTIFIER`     | true     |                        | TTTS APIリソースサーバー識別子       |
| `TTTS_API_ENDPOINT`                       | true     |                        | TTTS APIエンドポイント              |
| `BACKLOG_API_KEY`                         | true     |                        | バックログAPI key                 |
| `CONTINUOUS_SCENARIOS_STOPPED`            | true     | 1 or 0                 | 継続的なシナリオを止めるかどうか         |

## Code Samples

Code sample are [here](https://github.com/motionpicture/ttts-api/tree/master/example).

## Jsdoc

`npm run doc` emits jsdoc to ./doc.

## License

UNLICENSED
