# Cron Worker

After deploying, start with:
    pm2 start ecosystem.config.js --only sabnode-cron

Verify:
    pm2 logs sabnode-cron

Test a single job manually:
    curl "http://localhost:3000/api/cron/recurring-invoices?token=$CRON_SECRET"

Stop:
    pm2 stop sabnode-cron

Restart after schedule changes:
    pm2 restart sabnode-cron
