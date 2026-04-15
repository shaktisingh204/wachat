'use client';

// Comprehensive brand icon registry using react-icons/si (Simple Icons) + Lucide fallbacks
// Covers all 1098+ action files with real brand logos where available

import {
  SiAirtable, SiAlgolia, SiAnthropic, SiAsana, SiAtlassian,
  SiAuth0, SiBitbucket, SiBraintree, SiBrevo, SiCalendly,
  SiCircleci, SiClickup, SiCloudflare, SiCloudinary, SiCodecov,
  SiConfluence, SiContentful, SiDatadog, SiDeepgram,
  SiDigitalocean, SiDiscord, SiDatabricks, SiDropbox, SiDrupal,
  SiElastic, SiElasticsearch, SiFacebook, SiFigma, SiFirebase,
  SiGhost, SiGiphy, SiGitea, SiGithub, SiGitlab,
  SiGmail, SiGoogleanalytics, SiGooglecalendar, SiGooglecloud,
  SiGoogledocs, SiGoogledrive, SiGooglemaps, SiGooglesheets,
  SiGoogletagmanager, SiGrafana, SiGumroad, SiGusto,
  SiHubspot, SiHuggingface, SiInfluxdb, SiInstagram, SiIntercom,
  SiJira, SiKeycloak, SiKlarna, SiKubernetes,
  SiLine, SiLinear, SiMailchimp, SiMailgun, SiMake,
  SiMeta, SiMixpanel, SiMongodb, SiMysql, SiN8N,
  SiNetlify, SiNewrelic, SiNotion, SiOkta, SiOpenai,
  SiOpentelemetry, SiPagerduty, SiPaypal, SiPinterest,
  SiPlanetscale, SiPostgresql, SiPrismic, SiPrometheus,
  SiQuickbooks, SiRabbitmq, SiReddit, SiRedis, SiReplicate,
  SiResend, SiSalesforce, SiSendgrid, SiSentry, SiShopify,
  SiSinglestore, SiSlack, SiSnowflake, SiSpotify, SiSquare,
  SiStrapi, SiStripe, SiSupabase, SiTelegram, SiTodoist,
  SiToggl, SiTrello, SiTwilio, SiTwitch, SiX,
  SiTypeform, SiVercel, SiViber, SiVimeo, SiWechat,
  SiWhatsapp, SiWix, SiWordpress, SiXero, SiYoutube,
  SiZapier, SiZendesk, SiZoho, SiZoom, SiZulip,
  SiClickhouse, SiApachecassandra, SiApachekafka, SiApachepulsar,
  SiSnyk, SiMixcloud, SiSoundcloud, SiClaude,
} from 'react-icons/si';

import {
  Zap, Mail, MessageSquare, Phone, Database, Cloud, Globe,
  CreditCard, Users, Users2, Bot, Mic, BarChart2, Activity,
  Shield, FileText, Calendar, Webhook, GitBranch, Code2,
  Search, ShoppingCart, Headphones, Kanban, Table2, Server,
  Radio, Link, QrCode, Video, Music, Image, Braces,
  Receipt, HardDrive, Package, Network, Box,
  Bug, Send, Share2, Map,
} from 'lucide-react';

export type IconEntry = { icon: any; iconColor: string };

function group(ids: string[], icon: any, iconColor: string): Record<string, IconEntry> {
  return Object.fromEntries(ids.map(id => [id, { icon, iconColor }]));
}

export const iconRegistry: Record<string, IconEntry> = {
  // ─── Own platform apps ────────────────────────────────────────────────────────
  ...group(['wachat', 'whatsapp-business', 'whatsapp-cloud'], SiWhatsapp, 'text-green-500'),
  ...group(['instagram', 'instagram-enhanced', 'instagram-graph'], SiInstagram, 'text-pink-500'),
  ...group(['meta', 'metaads', 'facebook-ads', 'facebook-pages'], SiMeta, 'text-blue-600'),
  ...group(['sabchat'], MessageSquare, 'text-indigo-500'),
  ...group(['crm'], Users, 'text-blue-500'),
  ...group(['team'], Users, 'text-teal-500'),
  ...group(['seo-suite'], Search, 'text-orange-500'),
  ...group(['api', 'api-file-processor', 'postgres-api', 'mysql-api', 'woocommerce-api', 'n8n-api', 'wordpress-api', 'opencart-api', 'adp-api', 'apitemio'], Server, 'text-zinc-500'),
  ...group(['array-function'], Braces, 'text-zinc-500'),
  ...group(['iterator'], GitBranch, 'text-zinc-500'),
  ...group(['lookup-table'], Table2, 'text-zinc-500'),
  ...group(['connect-manager'], Link, 'text-zinc-500'),
  ...group(['select-transform-json'], Table2, 'text-zinc-500'),
  ...group(['dynamic-web-page'], Globe, 'text-zinc-500'),
  ...group(['file-uploader'], FileText, 'text-zinc-500'),
  ...group(['hook'], Webhook, 'text-zinc-500'),
  ...group(['subscription-billing'], Receipt, 'text-emerald-500'),
  ...group(['url-shortener', 'url-guard', 'yourls', 'bitly', 'dub'], Link, 'text-blue-400'),
  ...group(['qr-code', 'qr-code-maker'], QrCode, 'text-zinc-500'),
  ...group(['email'], Mail, 'text-blue-500'),
  ...group(['sms'], MessageSquare, 'text-green-500'),

  // ─── Communication platforms ──────────────────────────────────────────────────
  ...group(['slack', 'slack-enhanced'], SiSlack, 'text-purple-700'),
  ...group(['discord', 'discord-enhanced', 'discord-v2', 'discord-webhook'], SiDiscord, 'text-indigo-500'),
  ...group(['telegram', 'telegram-bot', 'telegram-enhanced', 'telegram-v2'], SiTelegram, 'text-sky-500'),
  ...group(['whatsapp-business', 'whatsapp-cloud'], SiWhatsapp, 'text-green-500'),
  ...group(['line', 'line-messaging'], SiLine, 'text-green-500'),
  ...group(['viber'], SiViber, 'text-violet-500'),
  ...group(['wechat', 'wechat-work'], SiWechat, 'text-green-500'),
  ...group(['zulip'], SiZulip, 'text-green-500'),
  ...group(['mattermost', 'rocket-chat', 'rocketchat'], MessageSquare, 'text-red-500'),
  ...group(['chanty', 'pumble', 'flock', 'soketi', 'matrix', 'bluesky', 'mastodon'], MessageSquare, 'text-purple-500'),
  ...group(['dingtalk', 'lark', 'lark-feishu', 'feishu', 'signl4'], MessageSquare, 'text-blue-500'),
  ...group(['interakt', 'wa-gateway', 'wablas', 'respondio', 'chat-api', 'ultramsg', 'fonnte', 'zenvia', 'messagebird', 'messagebird-enhanced', 'messagemedia'], MessageSquare, 'text-green-500'),
  ...group(['msteams', 'teams-enhanced', 'teams-webhook'], MessageSquare, 'text-blue-600'),

  // ─── Payments ─────────────────────────────────────────────────────────────────
  ...group(['stripe', 'stripe-billing', 'stripe-connect', 'stripe-enhanced'], SiStripe, 'text-violet-500'),
  ...group(['paypal', 'paypal-enhanced'], SiPaypal, 'text-blue-600'),
  ...group(['braintree', 'braintree-enhanced'], SiBraintree, 'text-purple-500'),
  ...group(['square', 'square-enhanced', 'square-pos'], SiSquare, 'text-zinc-700'),
  ...group(['klarna'], SiKlarna, 'text-pink-500'),
  ...group(['xero', 'xero-enhanced'], SiXero, 'text-blue-500'),
  ...group(['quickbooks', 'quickbooks-enhanced', 'quickbooks-payments'], SiQuickbooks, 'text-green-600'),
  ...group([
    'razorpay-enhanced', 'cashfree', 'paytm', 'payu', 'paystack',
    'flutterwave', 'mollie', 'adyen', 'adyen-enhanced', 'chargebee',
    'chargebee-enhanced', 'chargify', 'recurly', 'paddle', 'paddle-enhanced',
    'gocardless', 'worldpay', 'xendit', 'yodlee', 'midtrans', 'mangopay',
    'revolut', 'brex', 'ramp', 'wise', 'coinbase-commerce', 'zuora',
    'lemonsqueezy', 'xoxoday', 'mercury',
  ], CreditCard, 'text-emerald-500'),

  // ─── Ecommerce ────────────────────────────────────────────────────────────────
  ...group(['shopify', 'shopify-admin', 'shopify-enhanced', 'shopify-graphql', 'shopify-partner', 'shopify-storefront', 'shopify-webhooks'], SiShopify, 'text-green-600'),
  ...group(['woocommerce', 'woocommerce-enhanced', 'woocommerce-graphql', 'woocommerce-v3'], ShoppingCart, 'text-purple-500'),
  ...group(['magento', 'magento-enhanced'], ShoppingCart, 'text-orange-500'),
  ...group(['bigcommerce', 'bigcommerce-enhanced'], ShoppingCart, 'text-blue-500'),
  ...group(['ecwid', 'ecwid-enhanced'], ShoppingCart, 'text-blue-500'),
  ...group(['saleor', 'saleor-enhanced', 'saleor-storefront'], ShoppingCart, 'text-violet-500'),
  ...group(['wix-api'], SiWix, 'text-zinc-700'),
  ...group(['squarespace', 'squarespace-commerce'], Globe, 'text-zinc-700'),
  ...group(['prestashop', 'prestashop-enhanced'], ShoppingCart, 'text-green-500'),
  ...group(['opencart', 'opencart-api', 'opencart-enhanced'], ShoppingCart, 'text-blue-400'),
  ...group(['ebay'], ShoppingCart, 'text-blue-500'),
  ...group(['etsy'], ShoppingCart, 'text-orange-500'),
  ...group(['medusa', 'medusa-enhanced', 'medusa-v2', 'vendure'], ShoppingCart, 'text-violet-500'),
  ...group(['walmart', 'amazon-sp-api'], ShoppingCart, 'text-blue-500'),
  ...group(['lightspeed'], ShoppingCart, 'text-red-500'),
  ...group(['volusion', 'cs-cart', 'shift4shop', 'shoplazza', 'shopware', 'nopcommerce'], ShoppingCart, 'text-blue-500'),

  // ─── CRM / Sales ──────────────────────────────────────────────────────────────
  ...group(['hubspot', 'hubspot-cms', 'hubspot-crm', 'hubspot-enhanced', 'hubspot-meetings'], SiHubspot, 'text-orange-500'),
  ...group(['salesforce', 'salesforce-crm', 'salesforce-enhanced', 'salesforce-marketing-cloud', 'salesforce-mc'], SiSalesforce, 'text-sky-500'),
  ...group(['pipedrive', 'pipedrive-enhanced'], Users, 'text-orange-500'),
  ...group(['zoho-crm', 'zoho-crm-enhanced', 'zohocrm-enhanced', 'zoho', 'zoho-books', 'zohobooks', 'zohodesk', 'zohoinventory', 'zohomail', 'zohoprojects'], SiZoho, 'text-blue-500'),
  ...group(['activecampaign', 'activecampaign-enhanced'], Mail, 'text-blue-500'),
  ...group(['keap'], Users, 'text-green-500'),
  ...group([
    'copper', 'copper-crm', 'close-crm', 'closecrm', 'nutshell', 'monicacrm',
    'folk-crm', 'affinity', 'affinity-crm', 'agilecrm', 'less-annoying-crm',
    'streak-crm', 'twenty-crm', 'attio', 'insightly', 'salesflare',
    'salesmate', 'sharpspring', 'snovio', 'clay', 'moxie', 'vcita', 'vendasta',
  ], Users, 'text-blue-500'),
  ...group(['gong', 'chorus'], BarChart2, 'text-blue-500'),

  // ─── Marketing / Email ────────────────────────────────────────────────────────
  ...group(['mailchimp', 'mailchimp-enhanced'], SiMailchimp, 'text-yellow-500'),
  ...group(['mailgun', 'mailgun-enhanced'], SiMailgun, 'text-red-500'),
  ...group(['sendgrid', 'sendgrid-enhanced'], SiSendgrid, 'text-blue-500'),
  ...group(['brevo', 'brevo-enhanced', 'sendinblue'], SiBrevo, 'text-blue-500'),
  ...group(['resend'], SiResend, 'text-zinc-800'),
  ...group(['mailerlite', 'mailerlite-enhanced'], Mail, 'text-green-500'),
  ...group(['mailjet', 'mailjet-enhanced'], Mail, 'text-blue-500'),
  ...group(['klaviyo', 'klaviyo-enhanced', 'klaviyo-v2'], Mail, 'text-green-600'),
  ...group(['convertkit', 'convertkit-enhanced'], Mail, 'text-blue-500'),
  ...group(['getresponse', 'constant-contact', 'aweber', 'benchmark-email', 'emma', 'moosend', 'drip', 'drip-enhanced', 'omnisend', 'egoi', 'campaign-monitor', 'campaignmonitor', 'sendfox', 'sendpulse', 'sendy', 'mailup', 'sparkpost'], Mail, 'text-blue-500'),
  ...group(['postmark', 'postmark-enhanced'], Mail, 'text-yellow-500'),
  ...group(['mandrill'], Mail, 'text-blue-600'),
  ...group(['lemlist', 'lemlist-enhanced'], Mail, 'text-orange-500'),
  ...group(['reply-io'], Mail, 'text-blue-500'),
  ...group(['moengage', 'customerio', 'customerio-enhanced', 'braze', 'braze-enhanced', 'iterable', 'clevertap', 'onesignal'], Send, 'text-orange-500'),
  ...group(['tapfiliate'], BarChart2, 'text-blue-500'),

  // ─── Project Management ───────────────────────────────────────────────────────
  ...group(['notion', 'notion-ai', 'notion-enhanced', 'notion-v2'], SiNotion, 'text-zinc-700'),
  ...group(['asana', 'asana-enhanced'], SiAsana, 'text-pink-500'),
  ...group(['clickup', 'clickup-enhanced'], SiClickup, 'text-violet-500'),
  ...group(['linear', 'linear-enhanced', 'linear-v2'], SiLinear, 'text-violet-600'),
  ...group(['trello', 'trello-enhanced'], SiTrello, 'text-blue-600'),
  ...group(['jira', 'jira-enhanced'], SiJira, 'text-blue-500'),
  ...group(['monday', 'monday-board', 'monday-enhanced'], Kanban, 'text-red-500'),
  ...group(['todoist', 'todoist-enhanced'], SiTodoist, 'text-red-500'),
  ...group(['toggl', 'toggl-enhanced'], SiToggl, 'text-red-400'),
  ...group(['airtable', 'airtable-enhanced'], SiAirtable, 'text-teal-500'),
  ...group(['smartsheet', 'smartsheet-enhanced', 'seatable', 'stackby', 'coda', 'coda-enhanced', 'nocodb', 'nocodb-v2'], Table2, 'text-blue-500'),
  ...group(['wrike', 'wrike-enhanced'], Kanban, 'text-blue-500'),
  ...group(['basecamp', 'basecamp-enhanced'], Kanban, 'text-green-600'),
  ...group(['shortcut'], Kanban, 'text-purple-500'),
  ...group(['height', 'nifty', 'teamgantt', 'teamwork', 'proofhub', 'meistertask', 'taiga', 'plane'], Kanban, 'text-blue-500'),
  ...group(['harvest', 'harvest-enhanced', 'everhour', 'clockify', 'clockify-enhanced', 'clockodo', 'timely'], Calendar, 'text-orange-500'),
  ...group(['doodle', 'setmore', 'simplybook', 'bookafy', 'acuity', 'acuity-enhanced', 'acuity-scheduling', 'appointy', 'youcanbook', 'youcanbook-me', 'cal-com', 'calcom'], Calendar, 'text-teal-500'),
  ...group(['calendly', 'calendly-enhanced'], SiCalendly, 'text-blue-500'),
  ...group(['productboard', 'flowdash', 'pabbly-connect'], Kanban, 'text-blue-500'),
  ...group(['outline'], FileText, 'text-cyan-500'),
  ...group(['obsidian-sync'], FileText, 'text-violet-600'),

  // ─── Collaboration / Docs ─────────────────────────────────────────────────────
  ...group(['confluence', 'confluence-enhanced'], SiConfluence, 'text-blue-600'),
  ...group(['bitbucket', 'bitbucket-enhanced'], SiBitbucket, 'text-blue-500'),
  ...group(['github', 'github-actions', 'github-enhanced'], SiGithub, 'text-zinc-800'),
  ...group(['gitlab', 'gitlab-enhanced'], SiGitlab, 'text-orange-500'),

  // ─── Google Suite ─────────────────────────────────────────────────────────────
  ...group(['gmail', 'gmail-enhanced', 'google-gmail-enhanced'], SiGmail, 'text-red-500'),
  ...group(['google-sheets', 'google-sheets-enhanced', 'googlesheets'], SiGooglesheets, 'text-green-600'),
  ...group(['google-drive', 'google-drive-enhanced'], SiGoogledrive, 'text-yellow-500'),
  ...group(['google-docs'], SiGoogledocs, 'text-blue-500'),
  ...group(['google-calendar', 'google-calendar-enhanced'], SiGooglecalendar, 'text-blue-500'),
  ...group(['google-analytics-enhanced', 'google-analytics4', 'googleanalytics'], SiGoogleanalytics, 'text-orange-500'),
  ...group(['google-maps', 'here-maps'], SiGooglemaps, 'text-red-500'),
  ...group(['google-tag-manager'], SiGoogletagmanager, 'text-blue-400'),
  ...group([
    'google-ads', 'google-ads-enhanced', 'google-bigquery', 'google-chat',
    'google-classroom', 'google-cloud-dataflow', 'google-cloud-functions',
    'google-cloud-storage', 'google-meet', 'google-merchant', 'google-pubsub',
    'google-search-console', 'google-secret-manager', 'google-tasks',
    'google-workspace-admin', 'googleads', 'googlecontacts', 'googleforms',
    'googleforms-enhanced', 'googletasks', 'google-gemini', 'vertex-ai',
  ], SiGooglecloud, 'text-blue-500'),

  // ─── AWS ──────────────────────────────────────────────────────────────────────
  ...group([
    'aws-s3', 'aws-s3-enhanced', 'aws-amplify', 'aws-appsync', 'aws-bedrock',
    'aws-cloudformation', 'aws-cloudwatch', 'aws-codepipeline', 'aws-cognito',
    'aws-comprehend', 'aws-dynamodb', 'aws-ec2', 'aws-ecs', 'aws-eks',
    'aws-elb', 'aws-eventbridge', 'aws-glue', 'aws-iam', 'aws-iot',
    'aws-kms', 'aws-lambda-enhanced', 'aws-lightsail', 'aws-polly',
    'aws-rds', 'aws-rekognition', 'aws-route53', 'aws-sagemaker',
    'aws-ses-enhanced', 'aws-sns-enhanced', 'aws-sqs-enhanced',
    'aws-step-functions', 'aws-textract', 'aws-transcribe',
    'awscloudwatch', 'awsdynamodb', 'awslambda', 'awsses', 'awssns', 'awssqs',
    'amazon-connect', 'amazon-ses-v2',
  ], Cloud, 'text-orange-500'),

  // ─── Azure / Microsoft ────────────────────────────────────────────────────────
  ...group([
    'azure-active-directory', 'azure-ad', 'azure-blob', 'azure-cognitive',
    'azure-data-factory', 'azure-devops', 'azure-devops-enhanced',
    'azure-functions', 'azure-iot', 'azure-openai', 'azure-service-bus', 'azuredevops',
    'microsoft-dynamics', 'microsoft-ads', 'microsoft-bookings',
    'microsoft-calendar', 'microsoft-mail', 'microsoft-sharepoint',
    'microsoft-teams-enhanced', 'microsoft', 'dynamics365',
    'outlook-enhanced', 'onedrive', 'onedrive-enhanced',
  ], Cloud, 'text-blue-600'),

  // ─── Auth / Security ──────────────────────────────────────────────────────────
  ...group(['auth0', 'auth0-enhanced', 'auth0-management'], SiAuth0, 'text-orange-500'),
  ...group(['okta', 'okta-enhanced'], SiOkta, 'text-blue-500'),
  ...group(['keycloak'], SiKeycloak, 'text-blue-600'),
  ...group(['snyk'], SiSnyk, 'text-purple-500'),
  ...group([
    'clerk', 'fusionauth', 'frontegg', 'descope', 'stytch', 'supertokens',
    'ping-identity', 'jumpcloud', 'onelogin', 'vault', 'zscaler', 'shodan',
  ], Shield, 'text-blue-500'),

  // ─── DevOps / CI-CD ───────────────────────────────────────────────────────────
  ...group(['kubernetes'], SiKubernetes, 'text-blue-500'),
  ...group(['circleci', 'circleci-enhanced'], SiCircleci, 'text-green-500'),
  ...group(['gitea'], SiGitea, 'text-teal-500'),
  ...group(['docker-hub'], Package, 'text-blue-500'),
  ...group(['argocd', 'harness', 'conductor'], GitBranch, 'text-orange-500'),
  ...group(['jenkins'], Server, 'text-red-500'),
  ...group(['travis-ci', 'bamboo-ci', 'drone-ci', 'buildkite', 'buddy-ci', 'woodpecker-ci', 'woodpecker-email', 'spacelift', 'sonarqube'], GitBranch, 'text-green-500'),
  ...group(['fly-io', 'render', 'render-enhanced', 'railway', 'railway-enhanced'], Cloud, 'text-blue-500'),
  ...group(['digitalocean-enhanced'], SiDigitalocean, 'text-blue-500'),
  ...group(['harbor', 'nomad', 'consul'], Server, 'text-teal-500'),
  ...group(['mage-ai', 'prefect-enhanced', 'dagster', 'airflow-enhanced'], Code2, 'text-orange-500'),
  ...group(['dbt-cloud'], Database, 'text-orange-500'),
  ...group(['fivetran-enhanced'], Database, 'text-blue-600'),
  ...group(['terraform-cloud', 'ansible-awx'], Code2, 'text-violet-500'),
  ...group(['temporal'], Code2, 'text-blue-500'),
  ...group(['octopus-deploy', 'rundeck'], Server, 'text-teal-500'),
  ...group(['n8n', 'n8n-webhook'], SiN8N, 'text-red-500'),
  ...group(['zapier', 'zapier-webhooks'], SiZapier, 'text-orange-500'),
  ...group(['make', 'make-enhanced'], SiMake, 'text-violet-500'),
  ...group(['activepieces'], Zap, 'text-blue-500'),
  ...group(['pipedream'], Webhook, 'text-green-500'),

  // ─── Low-code / No-code ───────────────────────────────────────────────────────
  ...group(['retool', 'tooljet', 'budibase', 'adalo', 'bubble', 'glide', 'appsmith'], Code2, 'text-purple-500'),
  ...group(['webflow', 'webflow-cms', 'webflow-enhanced', 'framer'], Globe, 'text-blue-500'),

  // ─── Databases ────────────────────────────────────────────────────────────────
  ...group(['mongodb', 'mongodb-atlas'], SiMongodb, 'text-green-600'),
  ...group(['postgresql'], SiPostgresql, 'text-blue-600'),
  ...group(['mysql', 'mysql-api'], SiMysql, 'text-blue-500'),
  ...group(['redis', 'redis-enhanced', 'upstash-redis'], SiRedis, 'text-red-500'),
  ...group(['supabase', 'supabase-enhanced'], SiSupabase, 'text-emerald-500'),
  ...group(['firebase', 'firebase-enhanced'], SiFirebase, 'text-amber-500'),
  ...group(['snowflake', 'snowflake-enhanced'], SiSnowflake, 'text-blue-400'),
  ...group(['databricks', 'databricks-enhanced'], SiDatabricks, 'text-orange-500'),
  ...group(['clickhouse'], SiClickhouse, 'text-yellow-500'),
  ...group(['singlestore'], SiSinglestore, 'text-violet-500'),
  ...group(['planetscale'], SiPlanetscale, 'text-zinc-700'),
  ...group(['apache-cassandra'], SiApachecassandra, 'text-blue-500'),
  ...group(['confluent-kafka', 'upstash-kafka'], SiApachekafka, 'text-zinc-700'),
  ...group(['apache-pulsar'], SiApachepulsar, 'text-blue-500'),
  ...group(['rabbitmq'], SiRabbitmq, 'text-orange-500'),
  ...group(['influxdb'], SiInfluxdb, 'text-blue-500'),
  ...group(['milvus', 'pinecone', 'pinecone-enhanced', 'qdrant', 'weaviate', 'chroma'], Database, 'text-purple-500'),
  ...group(['neon', 'neon-db'], Database, 'text-emerald-400'),
  ...group(['cockroachdb'], Database, 'text-violet-500'),
  ...group(['timescaledb', 'tidb', 'tidb-cloud'], Database, 'text-blue-500'),
  ...group(['turso'], Database, 'text-teal-500'),
  ...group(['xata'], Database, 'text-pink-500'),
  ...group(['fauna'], Database, 'text-purple-400'),
  ...group(['pocketbase'], Database, 'text-orange-400'),
  ...group(['convex'], Database, 'text-blue-500'),
  ...group(['questdb'], Database, 'text-orange-500'),
  ...group(['redshift-api'], Database, 'text-red-400'),
  ...group(['stitch-data'], Database, 'text-teal-500'),
  ...group(['apache-superset'], BarChart2, 'text-blue-500'),

  // ─── Observability / Monitoring ──────────────────────────────────────────────
  ...group(['datadog', 'datadog-enhanced'], SiDatadog, 'text-purple-500'),
  ...group(['newrelic', 'newrelic-enhanced', 'newrelicenhanced'], SiNewrelic, 'text-teal-500'),
  ...group(['grafana', 'grafana-enhanced', 'grafanaenhanced'], SiGrafana, 'text-orange-500'),
  ...group(['sentry-enhanced', 'sentryenhanced', 'sentryio'], SiSentry, 'text-violet-500'),
  ...group(['pagerduty', 'pagerduty-enhanced'], SiPagerduty, 'text-green-500'),
  ...group(['prometheus'], SiPrometheus, 'text-orange-500'),
  ...group(['opentelemetry'], SiOpentelemetry, 'text-blue-400'),
  ...group(['sumologic'], Activity, 'text-blue-500'),
  ...group(['splunk'], Activity, 'text-orange-500'),
  ...group(['dynatrace'], Activity, 'text-green-500'),
  ...group(['appdynamics'], Activity, 'text-blue-600'),
  ...group(['raygun', 'rollbar', 'bugsnag'], Bug, 'text-purple-500'),
  ...group(['uptimerobot', 'uptimekuma', 'betterstack', 'betteruptime', 'statuspage', 'freshping', 'incident-io', 'squadcast', 'victorops', 'opsgenie-enhanced'], Activity, 'text-green-500'),
  ...group(['logdna', 'loggly', 'papertrail'], FileText, 'text-blue-400'),

  // ─── Analytics ────────────────────────────────────────────────────────────────
  ...group(['segment', 'segment-enhanced', 'rudderstack'], BarChart2, 'text-green-500'),
  ...group(['mixpanel', 'mixpanel-enhanced', 'mixpanel-v2'], SiMixpanel, 'text-purple-500'),
  ...group(['posthog', 'posthog-enhanced', 'posthog-v2'], BarChart2, 'text-orange-500'),
  ...group(['amplitude', 'amplitude-enhanced'], BarChart2, 'text-blue-500'),
  ...group(['plausible'], BarChart2, 'text-purple-400'),
  ...group(['umami'], BarChart2, 'text-orange-400'),
  ...group(['hotjar', 'fullstory', 'heap-analytics', 'countly', 'crazy-egg', 'logrocket'], BarChart2, 'text-purple-500'),
  ...group(['mode-analytics', 'looker-enhanced', 'looker-studio', 'sisense', 'metabase', 'redash', 'domo', 'qlik-sense', 'tableau'], BarChart2, 'text-blue-600'),
  ...group(['google-analytics-enhanced', 'googleanalytics', 'google-analytics4'], SiGoogleanalytics, 'text-orange-500'),
  ...group(['appsflyer', 'criteo', 'trade-desk'], BarChart2, 'text-blue-500'),
  ...group(['coingecko', 'coinmarketcap'], BarChart2, 'text-yellow-500'),

  // ─── Cloud Storage / CDN ──────────────────────────────────────────────────────
  ...group(['cloudflare', 'cloudflare-api', 'cloudflare-enhanced'], SiCloudflare, 'text-orange-500'),
  ...group(['cloudinary', 'cloudinary-enhanced', 'cloudinary-video'], SiCloudinary, 'text-blue-500'),
  ...group(['netlify', 'netlify-enhanced'], SiNetlify, 'text-teal-500'),
  ...group(['vercel-api'], SiVercel, 'text-zinc-800'),
  ...group(['dropbox', 'dropbox-enhanced', 'dropbox-sign'], SiDropbox, 'text-blue-500'),
  ...group(['box', 'box-enhanced'], Box, 'text-blue-500'),
  ...group(['sftp'], HardDrive, 'text-zinc-500'),
  ...group(['sharepoint', 'sharepoint-enhanced', 'microsoft-sharepoint'], HardDrive, 'text-blue-600'),
  ...group(['nextcloud'], HardDrive, 'text-blue-500'),
  ...group(['akamai', 'fastly', 'bunnycdn'], Network, 'text-blue-500'),
  ...group(['imagekit', 'imgix'], Image, 'text-blue-500'),

  // ─── AI / LLM ─────────────────────────────────────────────────────────────────
  ...group(['openai', 'openai-assistants', 'openai-enhanced'], SiOpenai, 'text-emerald-600'),
  ...group(['anthropic', 'anthropic-claude', 'anthropic-enhanced'], SiAnthropic, 'text-amber-600'),
  ...group(['huggingface', 'huggingface-enhanced'], SiHuggingface, 'text-yellow-500'),
  ...group(['replicate', 'replicate-enhanced'], SiReplicate, 'text-zinc-700'),
  ...group(['gemini', 'google-gemini'], Bot, 'text-blue-500'),
  ...group(['cohere', 'cohere-enhanced'], Bot, 'text-teal-500'),
  ...group(['mistral-ai', 'mistral-enhanced', 'mistralai'], Bot, 'text-orange-400'),
  ...group(['groq'], Bot, 'text-gray-600'),
  ...group(['deepseek'], Bot, 'text-blue-500'),
  ...group(['xai'], Bot, 'text-zinc-700'),
  ...group(['together-ai', 'togetherai', 'openrouter', 'fireworks-ai'], Bot, 'text-violet-500'),
  ...group(['ollama', 'perplexity', 'perplexity-ai'], Bot, 'text-blue-500'),
  ...group(['flowise', 'langchain-api', 'langflow'], Bot, 'text-teal-500'),
  ...group(['assemblyai', 'assemblyai-enhanced', 'deepgram'], SiDeepgram, 'text-green-500'),
  ...group(['elevenlabs', 'elevenlabs-enhanced', 'descript'], Mic, 'text-yellow-500'),
  ...group(['stability', 'stability-ai', 'stability-ai-enhanced', 'leonardo-ai'], Image, 'text-purple-500'),
  ...group(['heygen', 'tavus', 'd-id', 'synthesia', 'runway-ml', 'runwayml'], Video, 'text-violet-500'),
  ...group(['jasper'], FileText, 'text-violet-500'),
  ...group(['vapi'], Phone, 'text-indigo-500'),

  // ─── Telephony / VoIP ─────────────────────────────────────────────────────────
  ...group(['twilio', 'twilio-enhanced', 'twilio-verify', 'twilio-video', 'twilioenhanced'], SiTwilio, 'text-red-500'),
  ...group(['ringcentral', 'aircall', 'telnyx', 'plivo', 'plivo-enhanced', 'signalwire', 'sinch', 'sinch-enhanced', 'exotel', 'kaleyra', 'bandwidth', 'dialpad', 'talkdesk', 'five9', 'genesys-cloud', 'vonage', 'vonage-contact-center', 'vonage-enhanced', 'vonage-messages', 'vonage-video', 'eightx8', 'clicksend', 'clicksend-enhanced', 'd7networks', 'textmagic', 'msg91', 'infobip'], Phone, 'text-blue-500'),

  // ─── Customer Support ─────────────────────────────────────────────────────────
  ...group(['intercom', 'intercom-enhanced', 'intercom-v3'], SiIntercom, 'text-blue-500'),
  ...group(['zendesk', 'zendesk-enhanced', 'zendesk-guide', 'zendesk-sell', 'zendeskticket'], SiZendesk, 'text-green-600'),
  ...group(['freshdesk', 'freshdesk-enhanced', 'freshservice', 'freshchat', 'freshsales', 'freshping', 'freshworks'], Headphones, 'text-teal-500'),
  ...group(['helpscout', 'helpscout-enhanced', 'helpwise'], Headphones, 'text-blue-500'),
  ...group(['crisp', 'olark', 'dixa', 'trengo', 'kayako', 'groove', 'gorgias', 'halopsa', 'gladly', 'tawkto', 'livechat'], Headphones, 'text-blue-500'),
  ...group(['chatwoot', 'chatwoot-v2'], Headphones, 'text-indigo-500'),
  ...group(['front'], MessageSquare, 'text-red-500'),
  ...group(['zammad'], Headphones, 'text-orange-500'),
  ...group(['kustomer'], Headphones, 'text-blue-500'),

  // ─── HR / Recruiting ──────────────────────────────────────────────────────────
  ...group(['gusto', 'gusto-enhanced'], SiGusto, 'text-green-500'),
  ...group([
    'bamboohr', 'bamboohr-enhanced', 'workday', 'adp', 'adp-api',
    'rippling', 'personio', 'breezy-hr', 'recruitee', 'greenhouse',
    'greenhouse-enhanced', 'lever', 'jazzhr', 'workable', 'remote-com',
    'trinet', 'paychex', 'factorial', 'icims', 'oyster-hr', 'smartrecruiters',
    'namely',
  ], Users2, 'text-teal-500'),

  // ─── Finance / Accounting ─────────────────────────────────────────────────────
  ...group(['sage', 'sage-accounting', 'sage-intacct'], Receipt, 'text-green-600'),
  ...group(['netsuite', 'oracle', 'sap', 'sap-concur', 'erpnext', 'odoo', 'acumatica'], Server, 'text-red-500'),
  ...group(['coupa', 'expensify-enhanced', 'freshbooks', 'freshbooks-enhanced'], Receipt, 'text-blue-500'),
  ...group(['wave-accounting', 'waveaccounting', 'stitch-finance', 'avalara', 'taxjar', 'taxcloud', 'quaderno', 'finicity', 'mono-africa', 'qonto'], Receipt, 'text-emerald-500'),

  // ─── Video / Media ────────────────────────────────────────────────────────────
  ...group(['zoom', 'zoom-enhanced', 'zoom-webinar'], SiZoom, 'text-blue-500'),
  ...group(['vimeo', 'vimeo-enhanced'], SiVimeo, 'text-blue-400'),
  ...group(['youtube', 'youtube-analytics', 'youtube-enhanced'], SiYoutube, 'text-red-500'),
  ...group(['twitch', 'twitch-enhanced'], SiTwitch, 'text-purple-600'),
  ...group(['loom', 'loom-enhanced', 'wistia', 'vidyard', 'brightcove', 'dailymotion', 'mux'], Video, 'text-purple-500'),
  ...group(['webex', 'webex-enhanced', 'livekit'], Video, 'text-blue-500'),
  ...group(['kaltura', 'heygen'], Video, 'text-blue-500'),
  ...group(['tiktok', 'tiktok-ads', 'tiktok-analytics', 'tiktok-business', 'tiktokads'], Video, 'text-pink-500'),
  ...group(['demio', 'livestorm', 'gotowebinar', 'goto-meeting', 'goto', 'daily-co', 'whereby', 'bluejeans', 'jitsi', 'chime', 'bluejeans'], Video, 'text-blue-500'),

  // ─── Social / Advertising ─────────────────────────────────────────────────────
  ...group(['twitter', 'twitter-enhanced', 'twitter-ads-enhanced'], SiX, 'text-zinc-800'),
  ...group(['reddit', 'reddit-enhanced'], SiReddit, 'text-orange-500'),
  ...group(['pinterest', 'pinterest-ads', 'pinterest-analytics', 'pinterest-enhanced', 'pinterestads'], SiPinterest, 'text-red-500'),
  ...group(['linkedin', 'linkedin-ads', 'linkedin-analytics', 'linkedin-enhanced', 'linkedinads'], Users, 'text-blue-600'),
  ...group(['snapchat-ads', 'snapchat-marketing'], Share2, 'text-yellow-500'),
  ...group(['workplace-meta'], SiMeta, 'text-blue-600'),

  // ─── Music ────────────────────────────────────────────────────────────────────
  ...group(['spotify', 'spotify-enhanced'], SiSpotify, 'text-green-500'),
  ...group(['mixcloud'], SiMixcloud, 'text-blue-600'),
  ...group(['soundcloud'], SiSoundcloud, 'text-orange-500'),
  ...group(['deezer', 'lastfm', 'musixmatch'], Music, 'text-red-500'),

  // ─── CMS ──────────────────────────────────────────────────────────────────────
  ...group(['ghost', 'ghost-admin', 'ghost-cms', 'ghost-enhanced'], SiGhost, 'text-yellow-500'),
  ...group(['wordpress', 'wordpress-api', 'wordpress-enhanced'], SiWordpress, 'text-blue-600'),
  ...group(['strapi', 'strapi-enhanced'], SiStrapi, 'text-indigo-500'),
  ...group(['contentful', 'contentful-enhanced'], SiContentful, 'text-blue-500'),
  ...group(['prismic', 'prismic-enhanced'], SiPrismic, 'text-violet-500'),
  ...group(['drupal'], SiDrupal, 'text-blue-600'),
  ...group(['algolia', 'algolia-enhanced'], SiAlgolia, 'text-blue-500'),
  ...group(['storyblok', 'storyblok-enhanced', 'sanity', 'sanity-enhanced', 'datocms', 'directus', 'directus-enhanced', 'hygraph', 'akeneo', 'magnolia-cms', 'contentstack', 'payload-cms', 'payloadcms', 'pimcore', 'craft-cms', 'umbraco'], FileText, 'text-blue-500'),
  ...group(['canva', 'canva-enhanced'], Image, 'text-blue-500'),
  ...group(['miro', 'miro-enhanced', 'whimsical', 'mural', 'invision', 'framer', 'zeplin'], Image, 'text-yellow-500'),
  ...group(['figma', 'figma-enhanced'], SiFigma, 'text-purple-500'),
  ...group(['giphy'], SiGiphy, 'text-pink-500'),
  ...group(['pexels', 'pixabay', 'unsplash-enhanced'], Image, 'text-zinc-500'),

  // ─── Search ───────────────────────────────────────────────────────────────────
  ...group(['elastic', 'elastic-apm', 'elasticsearch', 'elasticsearch-enhanced', 'opensearch', 'typesense', 'solr', 'meilisearch', 'meilisearch-enhanced'], SiElasticsearch, 'text-amber-500'),

  // ─── Document / eSign ─────────────────────────────────────────────────────────
  ...group(['docusign', 'docusign-enhanced', 'adobe-sign', 'adobe-sign-enhanced', 'hellosign', 'signnow', 'signnow-enhanced', 'signrequest', 'documenso', 'docuseal', 'pandadoc-enhanced', 'contractbook', 'getaccept'], FileText, 'text-blue-500'),
  ...group(['adobe-pdf', 'pdfco', 'pdfmonkey', 'transloadit', 'filestack', 'mindee'], FileText, 'text-red-500'),
  ...group(['paperform', 'formio', 'formstack', 'formstack-documents', 'surveymonkey', 'surveymonkey-enhanced', 'surveysparrow', 'wufoo', 'kobo', 'cognito-forms', 'tally-forms', 'fillout', 'jotform', 'jotform-enhanced', 'qualtrics'], FileText, 'text-blue-500'),

  // ─── Maps / Location / Weather ───────────────────────────────────────────────
  ...group(['mapbox', 'mapbox-enhanced'], Map, 'text-blue-600'),
  ...group(['openweathermap', 'ipinfo', 'maxmind', 'urlscanio', 'peekalink'], Globe, 'text-blue-400'),
  ...group(['fixerio', 'currencylayer', 'openexchangerates', 'alphaVantage'], Globe, 'text-zinc-500'),

  // ─── IoT ──────────────────────────────────────────────────────────────────────
  ...group(['thingspeak', 'particle-iot', 'homeassistant'], Radio, 'text-teal-500'),

  // ─── Community / Events ───────────────────────────────────────────────────────
  ...group(['eventbrite', 'ticketmaster', 'bandsintown'], Calendar, 'text-orange-500'),
  ...group(['circle-community', 'hivebrite', 'bevy', 'orbit', 'common-room', 'churnzero', 'gainsight', 'totango'], Users, 'text-blue-500'),
  ...group(['discourse', 'vanilla'], MessageSquare, 'text-blue-500'),

  // ─── Misc utilities ───────────────────────────────────────────────────────────
  ...group(['brightdata', 'scrapingbee', 'browserless', 'apify', 'phantombuster', 'phantombuster-enhanced', 'firecrawl', 'zenrows'], Globe, 'text-green-500'),
  ...group(['nasa'], Globe, 'text-blue-600'),
  ...group(['hackernews', 'g2'], Globe, 'text-orange-500'),
  ...group(['abstract', 'abstract-api'], Server, 'text-zinc-500'),
  ...group(['strava', 'mindbody'], Activity, 'text-orange-500'),
  ...group(['upwork'], Users, 'text-green-500'),
  ...group(['gotify', 'pushbullet', 'pushcut', 'pusher', 'pushover', 'onesignal'], Send, 'text-blue-400'),
  ...group(['gumroad'], SiGumroad, 'text-pink-500'),
  ...group(['nango'], Webhook, 'text-blue-500'),
  ...group(['quickchart', 'bannerbear'], Image, 'text-blue-500'),
  ...group(['ably'], Radio, 'text-purple-500'),
  ...group(['deepl', 'openthesaurus'], Globe, 'text-blue-500'),
  ...group(['clearbit', 'clearbit-enhanced', 'apollo', 'apollo-enhanced', 'lusha', 'uplead', 'snovio', 'hunter', 'hunter-enhanced', 'hunterio', 'fullcontact', 'leadsquared', 'smartlead', 'instantly', 'neverbounce', 'zerobounce'], Users, 'text-blue-500'),
};

export function getIconEntry(appId: string): IconEntry {
  if (iconRegistry[appId]) return iconRegistry[appId];
  const prefix = appId.split('-')[0];
  if (iconRegistry[prefix]) return iconRegistry[prefix];
  return { icon: Zap, iconColor: 'text-gray-500' };
}
