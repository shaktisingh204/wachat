## 08. Billing & Monetization

1. Build a unified usage-metering pipeline that ingests events from Wachat messages, SabFlow runs, AI tokens, storage GB, and ad-spend across every workspace.
2. Extend the existing credit-usage tracker to emit metered records into a Mongo time-series collection partitioned by workspace and SKU for fast aggregation.
3. Persist metered events to Redis streams first, then flush to Mongo via PM2 worker batches to absorb spikes without losing usage signals.
4. Add a per-SKU rate card config in admin so finance can edit unit prices without redeploying billing services.
5. Track AI-token usage by upstream provider (Anthropic, OpenAI, Gemini) with markup multipliers and pass-through cost reconciliation.
6. Enforce monthly storage GB caps on Firebase and S3 buckets via nightly reconciliation jobs that compare actual usage to plan entitlements.
7. Cap ad-spend per workspace at the value gated by their plan, blocking outbound ad API calls once the threshold is reached.
8. Add a workflow-runs meter on every SabFlow execution that records nodes-executed, runtime-ms, and credit cost into the meter pipeline.
9. Surface multi-currency support across `/dashboard/billing` and `/dashboard/plans` using a daily FX-rate cache pulled from a trusted FX provider.
10. Compute prorated upgrade and downgrade amounts using anchor-day billing math compatible with both Stripe and Razorpay subscription models.
11. Implement self-serve plan changes that preview proration, taxes, and effective dates before the workspace owner confirms the switch.
12. Add an immediate upgrade path that charges the proration delta on the existing payment method without resetting the billing cycle.
13. Allow scheduled downgrades that retain current entitlements until period end, then downgrade automatically via a cron worker.
14. Introduce grandfathering rules that pin legacy workspaces to historical pricing while allowing opt-in upgrades to new plans.
15. Build a partner program that issues referral codes and tracks attributed signups through a partner_attribution model on the user document.
16. Calculate partner commissions monthly using configurable percentage tiers, with carve-outs for refunds, chargebacks, and free-trial conversions.
17. Pay partner commissions via Stripe Connect Express accounts and Razorpay Route linked accounts based on partner currency preference.
18. Add a marketplace billing collector that charges end customers for third-party app installs and splits revenue with the developer.
19. Route marketplace payouts through Stripe Connect destination charges or Razorpay Route transfers with automatic developer KYC verification.
20. Hold marketplace funds in a clearing account for a configurable T+N window before releasing payouts to absorb refund risk.
21. Implement a dunning state machine with smart retry windows that adapts cadence based on decline-code categories from Stripe and Razorpay.
22. Send dunning emails through the existing notifications module with branded templates that include a one-click update-payment-method link.
23. Throttle workspace features progressively during dunning: warn day 1, soft-limit day 3, suspend day 7, downgrade-to-free day 14.
24. Generate invoices as PDFs with workspace-level custom branding (logo, colors, footer text) stored in Firebase and signed for download.
25. Make invoices ASC 606-compliant by recognizing revenue across the service period instead of at-cash, with deferred revenue ledgers.
26. Integrate Stripe Tax for US, EU, UK, and APAC tax computation, falling back to Avalara for jurisdictions Stripe Tax does not support.
27. Persist tax calculation snapshots on every invoice for audit replay and accountant export to QuickBooks and Xero.
28. Add usage-cap alerts at 50%, 80%, and 100% of plan entitlements via email, in-app banner, and webhook to admin Slack.
29. Build per-workspace cost dashboards that break down spend by module (Wachat, SabFlow, CRM, SEO, SabChat) and by metered SKU.
30. Show projected end-of-month spend on the cost dashboard using a 7-day moving average of recent usage trends.
31. Run pricing experiments through an A/B framework that randomizes new signups into pricing cohorts and measures conversion and LTV.
32. Gate experiment exposure with a feature flag service so finance can pause an experiment instantly if conversion craters.
33. Currency-aware billing periods anchor invoice cycles to the workspace's local timezone and FX-locked rate at period start.
34. Lock the FX rate for an annual prepayment at checkout time and preserve it across renewals unless the customer opts to refresh.
35. Expose a billing webhook endpoint that downstream modules subscribe to for plan changes, suspensions, and credit top-ups.
36. Add a credit top-up flow on `/dashboard/billing` that lets workspaces purchase one-time credit bundles using their stored payment method.
37. Implement chargeback handling that auto-suspends the workspace, opens a CRM dispute case, and notifies the admin team via email.
38. Build a refund workflow with reason codes, partial-refund support, and automatic revenue-recognition reversal entries.
39. Generate monthly revenue recognition reports per entity, currency, and SKU exportable as CSV and signed PDF for the finance team.
40. Wire the billing module into the existing admin RBAC so only finance-role admins can edit rate cards, issue refunds, or override invoices.
41. Add an audit log for every billing mutation (price change, refund, comp, plan grandfather) keyed by admin user, IP, and timestamp.
42. Cache plan entitlements in Redis with a 5-minute TTL and bust on plan changes so feature gates respond in single-digit milliseconds.
43. Provide a billing portal embed that customers can launch from any module to update payment methods without leaving context.
44. Detect failed-card patterns and suggest alternative payment methods (UPI, ACH, bank debit) based on workspace country and currency.
45. Stream invoice events to a finance data warehouse (BigQuery or Snowflake) for cohort analysis, churn modeling, and MRR reporting.
46. Add MRR, ARR, churn, and expansion metrics to an admin-only finance dashboard with daily snapshots and CSV export.
47. Implement a comp/discount engine that supports percentage-off, fixed-amount, free-months, and credits coupons with stacking rules.
48. Allow enterprise contracts with custom MSAs to override usage caps and rate cards via a per-workspace contract overlay document.
49. Provide quote-to-cash flow for sales: generate quote, send for e-signature, convert to subscription, then pull into the billing engine.
50. Reconcile Stripe and Razorpay payouts daily against expected revenue, raising finance alerts when variance exceeds a configurable threshold.
