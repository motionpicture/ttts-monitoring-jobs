# 東京タワーチケット予約システム監視ジョブアプリケーション

[![CircleCI](https://circleci.com/gh/motionpicture/ttts-monitoring-jobs.svg?style=svg)](https://circleci.com/gh/motionpicture/ttts-monitoring-jobs)

## Table of contents

* [Usage](#usage)
* [License](#license)

## Usage

### Environment variables

| Name                                                  | Required | Value                  | Purpose                                              |
| ----------------------------------------------------- | -------- | ---------------------- | ---------------------------------------------------- |
| `DEBUG`                                               | false    | ttts-monitoring-jobs:* | Debug                                                |
| `NPM_TOKEN`                                           | true     |                        | NPM auth token                                       |
| `NODE_ENV`                                            | true     |                        | environment name                                     |
| `MONGOLAB_URI`                                        | true     |                        | MongoDB connection URI                               |
| `SENDGRID_API_KEY`                                    | true     |                        | SendGrid API Key                                     |
| `GMO_ENDPOINT`                                        | true     |                        | GMO API endpoint                                     |
| `TTTS_DEVELOPER_EMAIL`                                | true     |                        | 開発者通知用メールアドレス                           |
| `TTTS_DEVELOPER_LINE_NOTIFY_ACCESS_TOKEN`             | true     |                        | LINE Notifyでのレポート通知                          |
| `AZURE_STORAGE_CONNECTION_STRING`                     | true     |                        | Save charts on azure storage                         |
| `CHART_EXPIRES_IN_MONTH`                              | true     |                        | チャート表示有効期間(ヵ月)                           |
| `TTTS_API_CLIENT_ID`                                  | true     |                        | TTTS APIクライアントID                               |
| `TTTS_API_CLIENT_SECRET`                              | true     |                        | TTTS APIクライアントシークレット                     |
| `TTTS_API_AUTHORIZE_SERVER_DOMAIN`                    | true     |                        | TTTS API認可サーバードメイン                         |
| `TTTS_API_RESOURCE_SERVER_IDENTIFIER`                 | true     |                        | TTTS APIリソースサーバー識別子                       |
| `TTTS_API_ENDPOINT`                                   | true     |                        | TTTS APIエンドポイント                               |
| `BACKLOG_API_KEY`                                     | true     |                        | バックログAPI key                                    |
| `WAITER_ENDPOINT`                                     | true     |                        | シナリオで使用するWAITERエンドポイント               |
| `CONTINUOUS_SCENARIOS_STOPPED`                        | true     | 1 or 0                 | 継続的なシナリオを止めるかどうか                     |
| `CONTINUOUS_SCENARIOS_INTERVAL_IN_SECONDS`            | true     |                        | 継続的な注文シナリオ間隔                             |
| `CONTINUOUS_SCENARIOS_BY_STAFF_STOPPED`               | true     | 1 or 0                 | スタッフによる継続的な注文シナリオを止めるかどうか   |
| `CONTINUOUS_SCENARIOS_BY_STAFF_INTERVAL_IN_SECONDS`   | true     |                        | スタッフによる継続的な注文シナリオ間隔               |
| `CONTINUOUS_SCENARIOS_BY_STAFF_USERNAME`              | true     |                        | 継続的な注文シナリオを実行するスタッフユーザーネーム |
| `CONTINUOUS_SCENARIOS_BY_STAFF_PASSWORD`              | true     |                        | 継続的な注文シナリオを実行するスタッフパスワード     |
| `CONTINUOUS_SCENARIOS_BY_STAFF_EVENTS_SEARCH_FROM`    | true     |                        | スタッフによる注文シナリオのイベント検索期間from     |
| `CONTINUOUS_SCENARIOS_BY_STAFF_EVENTS_SEARCH_THROUGH` | true     |                        | スタッフによる注文シナリオのイベント検索期間through  |
| `TTTS_ADMIN_API_CLIENT_ID`                            | true     |                        | 管理者APIクライアントID                              |
| `TTTS_ADMIN_API_CLIENT_SECRET`                        | true     |                        | 管理者APIクライアントシークレット                    |
| `TTTS_ADMIN_API_AUTHORIZE_SERVER_DOMAIN`              | true     |                        | 管理者API認可サーバードメイン                        |
| `CHECK_GMO_SALES_HEALTH_DISABLED`                     | false    | 1 or 0                 | GMO売上健康診断無効化フラグ                          |

## License

ISC
