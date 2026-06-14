# SabNode Cron Schedule

All jobs are invoked via `GET /api/cron/[job]?token=$CRON_SECRET`
(`Authorization: Bearer $CRON_SECRET` also accepted). PM2 worker is the
intended caller — see `services/cron-worker/` or whichever PM2 app owns
the schedule.

Each handler logs start/end, returns `{ processed, errors, durationMs, details }`,
and never throws — failures bubble back through the JSON response.

## Recommended schedule

```
# m h dom mon dow   job (path = /api/cron/<job>)

*/15 *  *  *  *     recurring-invoices            # every 15 min
*/15 *  *  *  *     recurring-events              # every 15 min
*/15 *  *  *  *     recurring-tasks               # every 15 min
0    0  *  *  *     recurring-expenses            # daily at 00:00
0    1  *  *  *     shift-rotation                # daily at 01:00
*/30 *  *  *  *     auto-clock-out                # every 30 min
0    9  *  *  *     follow-up-reminders           # daily at 09:00
0    9  *  *  *     visa-passport-expiry-alerts   # daily at 09:00
0    9  *  *  *     estimate-contract-expiry      # daily at 09:00
0    6  *  *  *     exchange-rate-update          # daily at 06:00
*/10 *  *  *  *     sla-computation               # every 10 min
```

## Example PM2 worker tick (node-cron)

```js
// services/cron-worker/index.js
const cron = require('node-cron');

const ORIGIN = process.env.SABNODE_ORIGIN ?? 'http://127.0.0.1:3000';
const TOKEN = process.env.CRON_SECRET;

const hit = (job) =>
  fetch(`${ORIGIN}/api/cron/${job}?token=${TOKEN}`)
    .then((r) => r.json())
    .then((j) => console.log(`[cron-worker] ${job}`, j))
    .catch((e) => console.error(`[cron-worker] ${job} failed`, e));

cron.schedule('*/15 * * * *', () => hit('recurring-invoices'));
cron.schedule('*/15 * * * *', () => hit('recurring-events'));
cron.schedule('*/15 * * * *', () => hit('recurring-tasks'));
cron.schedule('0 0 * * *',    () => hit('recurring-expenses'));
cron.schedule('0 1 * * *',    () => hit('shift-rotation'));
cron.schedule('*/30 * * * *', () => hit('auto-clock-out'));
cron.schedule('0 9 * * *',    () => hit('follow-up-reminders'));
cron.schedule('0 9 * * *',    () => hit('visa-passport-expiry-alerts'));
cron.schedule('0 9 * * *',    () => hit('estimate-contract-expiry'));
cron.schedule('0 6 * * *',    () => hit('exchange-rate-update'));
cron.schedule('*/10 * * * *', () => hit('sla-computation'));
```

Register in `ecosystem.config.js` alongside the other PM2 apps:

```js
{
  name: 'cron-worker',
  script: 'services/cron-worker/index.js',
  env: {
    SABNODE_ORIGIN: 'http://127.0.0.1:3000',
    CRON_SECRET: process.env.CRON_SECRET,
  },
}
```

## Env vars

- `CRON_SECRET` — shared secret required on every `/api/cron/[job]` call.
- `MONGODB_URI`, `MONGODB_DB` — read by `connectToDatabase()`.

## Job catalogue

| Job                           | Reads                          | Writes                                | Notes                                    |
| ----------------------------- | ------------------------------ | ------------------------------------- | ---------------------------------------- |
| `recurring-invoices`          | `crm_recurring_invoices`       | `crm_invoices`, source row            | Marks status `completed` on last cycle.  |
| `recurring-events`            | `crm_events` (parents)         | `crm_events` (children w/ `parent_id`) | 90-day generation horizon.               |
| `recurring-tasks`             | `crm_tasks` (parents)          | `crm_tasks` (children w/ `recurring_task_id`) | Bumps `repeat_count`.            |
| `recurring-expenses`          | `crm_expense_recurrings`       | `crm_expenses`, source row            | Mirrors invoices flow.                   |
| `shift-rotation`              | `automate_shifts`, `shift_rotation_sequences` | `automate_shifts`     | Wraps around to index 0.                 |
| `auto-clock-out`              | `crm_attendances`, `shifts`    | `crm_attendances`                     | Tags `clock_out_type: 'auto'`.           |
| `follow-up-reminders`         | `crm_deal_follow_ups`          | `crm_deal_follow_ups` (`reminder_sent`) | Logs TODO notification payload.        |
| `visa-passport-expiry-alerts` | `visa_details`, `passports`    | source rows (`alert_sent`)            | Per-doc `alert_before_months`.           |
| `estimate-contract-expiry`    | `crm_estimates`, `crm_contracts` | source rows (`expiry_alert_sent`)   | 7-day / 30-day horizons.                 |
| `exchange-rate-update`        | `currencies`                   | `currencies.exchange_rate`            | Uses keyless open.er-api (base USD).     |
| `sla-computation`             | `crm_tickets`                  | `crm_tickets` (`slaBreachNotified`)   | Flags SLA breaches.                      |
