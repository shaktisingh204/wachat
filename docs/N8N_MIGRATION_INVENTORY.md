# n8n → SabFlow Node Migration Inventory

Generated from `n8n-master/packages/nodes-base/nodes/` against the canonical `*.node.ts` per service directory. **Triggers and versioned variants (V1/V2)** are deliberately excluded from this inventory — they get their own follow-up pass once the base nodes land.

- **Total services:** 288
- **Total LOC:** ~126,195
- **Tier S (<300 LOC):** 141
- **Tier M (300–799 LOC):** 109
- **Tier L (800+ LOC):** 38

Each row maps to a target forge block under `src/lib/sabflow/forge/blocks/<batch>/<name>.ts`. The target id follows the convention `forge_<snake_case>`. Credential type matches an entry in `src/lib/sabflow/credentials/types.ts` (`CREDENTIAL_TYPES`). When the existing credentials catalog doesn't cover a service, add it in that file as part of the port and reference it from `auth.credentialType`.

## Tier legend

| Tier | LOC | Typical effort | Common shape |
| --- | --- | --- | --- |
| S | <300 | one action set, <8 fields | Single-resource CRUD or simple HTTP wrapper |
| M | 300–799 | 2–4 resources, 10–30 fields | Multi-resource CRM/PM with shared helper |
| L | 800+ | 4+ resources, 30+ fields, often pagination + LoadOptions | Slack/Asana/ClickUp-class connectors |

## Inventory

| n8n service | source file (rel. to nodes-base/nodes) | LOC | tier |
| --- | --- | --- | --- |
| ActionNetwork | ActionNetwork/ActionNetwork.node.ts | 498 | M |
| ActiveCampaign | ActiveCampaign/ActiveCampaign.node.ts | 1195 | L |
| Adalo | Adalo/Adalo.node.ts | 212 | S |
| Affinity | Affinity/Affinity.node.ts | 432 | M |
| AgileCrm | AgileCrm/AgileCrm.node.ts | 642 | M |
| AiTransform | AiTransform/AiTransform.node.ts | 112 | S |
| Airtable | Airtable/Airtable.node.ts | 27 | S |
| Airtop | Airtop/Airtop.node.ts | 90 | S |
| Amqp | Amqp/Amqp.node.ts | 277 | S |
| ApiTemplateIo | ApiTemplateIo/ApiTemplateIo.node.ts | 579 | M |
| Asana | Asana/Asana.node.ts | 2484 | L |
| Autopilot | Autopilot/Autopilot.node.ts | 320 | M |
| Aws | Aws/AwsLambda.node.ts | 219 | S |
| BambooHr | BambooHr/BambooHr.node.ts | 31 | S |
| Bannerbear | Bannerbear/Bannerbear.node.ts | 190 | S |
| Baserow | Baserow/Baserow.node.ts | 556 | M |
| Beeminder | Beeminder/Beeminder.node.ts | 1544 | L |
| Bitly | Bitly/Bitly.node.ts | 224 | S |
| Bitwarden | Bitwarden/Bitwarden.node.ts | 569 | M |
| Box | Box/Box.node.ts | 530 | M |
| Brandfetch | Brandfetch/Brandfetch.node.ts | 268 | S |
| Brevo | Brevo/Brevo.node.ts | 72 | S |
| Bubble | Bubble/Bubble.node.ts | 184 | S |
| Chargebee | Chargebee/Chargebee.node.ts | 641 | M |
| CircleCi | CircleCi/CircleCi.node.ts | 155 | S |
| Cisco | Cisco/Webex/CiscoWebex.node.ts | 565 | M |
| Clearbit | Clearbit/Clearbit.node.ts | 169 | S |
| ClickUp | ClickUp/ClickUp.node.ts | 1632 | L |
| Clockify | Clockify/Clockify.node.ts | 844 | L |
| Cloudflare | Cloudflare/Cloudflare.node.ts | 181 | S |
| Cockpit | Cockpit/Cockpit.node.ts | 168 | S |
| Coda | Coda/Coda.node.ts | 946 | L |
| Code | Code/Code.node.ts | 206 | S |
| CoinGecko | CoinGecko/CoinGecko.node.ts | 489 | M |
| CompareDatasets | CompareDatasets/CompareDatasets.node.ts | 304 | M |
| Compression | Compression/Compression.node.ts | 465 | M |
| Contentful | Contentful/Contentful.node.ts | 376 | M |
| ConvertKit | ConvertKit/ConvertKit.node.ts | 494 | M |
| Copper | Copper/Copper.node.ts | 639 | M |
| Cortex | Cortex/Cortex.node.ts | 385 | M |
| CrateDb | CrateDb/CrateDb.node.ts | 393 | M |
| Cron | Cron/Cron.node.ts | 74 | S |
| Crypto | Crypto/Crypto.node.ts | 27 | S |
| Currents | Currents/Currents.node.ts | 131 | S |
| CustomerIo | CustomerIo/CustomerIo.node.ts | 350 | M |
| DataTable | DataTable/DataTable.node.ts | 79 | S |
| Databricks | Databricks/Databricks.node.ts | 145 | S |
| DateTime | DateTime/DateTime.node.ts | 27 | S |
| DebugHelper | DebugHelper/DebugHelper.node.ts | 379 | M |
| DeepL | DeepL/DeepL.node.ts | 156 | S |
| Demio | Demio/Demio.node.ts | 206 | S |
| Dhl | Dhl/Dhl.node.ts | 159 | S |
| Discord | Discord/Discord.node.ts | 25 | S |
| Discourse | Discourse/Discourse.node.ts | 456 | M |
| Disqus | Disqus/Disqus.node.ts | 751 | M |
| Drift | Drift/Drift.node.ts | 165 | S |
| Dropbox | Dropbox/Dropbox.node.ts | 1027 | L |
| Dropcontact | Dropcontact/Dropcontact.node.ts | 376 | M |
| DynamicCredentialCheck | DynamicCredentialCheck/DynamicCredentialCheck.node.ts | 51 | S |
| E2eTest | E2eTest/E2eTest.node.ts | 218 | S |
| ERPNext | ERPNext/ERPNext.node.ts | 292 | S |
| EditImage | EditImage/EditImage.node.ts | 1354 | L |
| Egoi | Egoi/Egoi.node.ts | 758 | M |
| Elastic | Elastic/ElasticSecurity/ElasticSecurity.node.ts | 540 | M |
| EmailReadImap | EmailReadImap/EmailReadImap.node.ts | 27 | S |
| EmailSend | EmailSend/EmailSend.node.ts | 27 | S |
| Emelia | Emelia/Emelia.node.ts | 445 | M |
| ErrorTrigger | ErrorTrigger/ErrorTrigger.node.ts | 88 | S |
| Evaluation | Evaluation/Evaluation/Description.node.ts | 499 | M |
| ExecuteCommand | ExecuteCommand/ExecuteCommand.node.ts | 132 | S |
| ExecuteWorkflow | ExecuteWorkflow/ExecuteWorkflow/ExecuteWorkflow.node.ts | 492 | M |
| ExecutionData | ExecutionData/ExecutionData.node.ts | 154 | S |
| Facebook | Facebook/FacebookGraphApi.node.ts | 478 | M |
| FileMaker | FileMaker/FileMaker.node.ts | 834 | L |
| Files | Files/ReadWriteFile/ReadWriteFile.node.ts | 75 | S |
| Filter | Filter/Filter.node.ts | 29 | S |
| Flow | Flow/Flow.node.ts | 274 | S |
| Form | Form/Form.node.ts | 458 | M |
| Freshdesk | Freshdesk/Freshdesk.node.ts | 1428 | L |
| Freshservice | Freshservice/Freshservice.node.ts | 1394 | L |
| FreshworksCrm | FreshworksCrm/FreshworksCrm.node.ts | 998 | L |
| Ftp | Ftp/Ftp.node.ts | 961 | L |
| Function | Function/Function.node.ts | 230 | S |
| FunctionItem | FunctionItem/FunctionItem.node.ts | 245 | S |
| GetResponse | GetResponse/GetResponse.node.ts | 318 | M |
| Ghost | Ghost/Ghost.node.ts | 380 | M |
| Git | Git/Git.node.ts | 738 | M |
| Github | Github/Github.node.ts | 3020 | L |
| Gitlab | Gitlab/Gitlab.node.ts | 1801 | L |
| GoToWebinar | GoToWebinar/GoToWebinar.node.ts | 655 | M |
| Gong | Gong/Gong.node.ts | 172 | S |
| Google | Google/Ads/GoogleAds.node.ts | 73 | S |
| Gotify | Gotify/Gotify.node.ts | 273 | S |
| Grafana | Grafana/Grafana.node.ts | 494 | M |
| GraphQL | GraphQL/GraphQL.node.ts | 582 | M |
| Grist | Grist/Grist.node.ts | 267 | S |
| HackerNews | HackerNews/HackerNews.node.ts | 366 | M |
| HaloPSA | HaloPSA/HaloPSA.node.ts | 684 | M |
| Harvest | Harvest/Harvest.node.ts | 1342 | L |
| HelpScout | HelpScout/HelpScout.node.ts | 580 | M |
| HighLevel | HighLevel/HighLevel.node.ts | 25 | S |
| HomeAssistant | HomeAssistant/HomeAssistant.node.ts | 460 | M |
| Html | Html/Html.node.ts | 616 | M |
| HtmlExtract | HtmlExtract/HtmlExtract.node.ts | 302 | M |
| HttpRequest | HttpRequest/HttpRequest.node.ts | 38 | S |
| Hubspot | Hubspot/Hubspot.node.ts | 28 | S |
| HumanticAI | HumanticAI/HumanticAi.node.ts | 176 | S |
| Hunter | Hunter/Hunter.node.ts | 392 | M |
| ICalendar | ICalendar/ICalendar.node.ts | 59 | S |
| If | If/If.node.ts | 29 | S |
| Intercom | Intercom/Intercom.node.ts | 640 | M |
| Interval | Interval/Interval.node.ts | 115 | S |
| InvoiceNinja | InvoiceNinja/InvoiceNinja.node.ts | 1306 | L |
| ItemLists | ItemLists/ItemLists.node.ts | 32 | S |
| Iterable | Iterable/Iterable.node.ts | 322 | M |
| Jenkins | Jenkins/Jenkins.node.ts | 653 | M |
| JinaAI | JinaAI/JinaAi.node.ts | 465 | M |
| Jira | Jira/Jira.node.ts | 1805 | L |
| Jwt | Jwt/Jwt.node.ts | 475 | M |
| Kafka | Kafka/Kafka.node.ts | 417 | M |
| Keap | Keap/Keap.node.ts | 820 | L |
| KoBoToolbox | KoBoToolbox/KoBoToolbox.node.ts | 479 | M |
| Ldap | Ldap/Ldap.node.ts | 462 | M |
| Lemlist | Lemlist/Lemlist.node.ts | 25 | S |
| Line | Line/Line.node.ts | 152 | S |
| Linear | Linear/Linear.node.ts | 354 | M |
| LingvaNex | LingvaNex/LingvaNex.node.ts | 177 | S |
| LinkedIn | LinkedIn/LinkedIn.node.ts | 310 | M |
| LocalFileTrigger | LocalFileTrigger/LocalFileTrigger.node.ts | 273 | S |
| LoneScale | LoneScale/LoneScale.node.ts | 483 | M |
| MQTT | MQTT/Mqtt.node.ts | 161 | S |
| Magento | Magento/Magento2.node.ts | 815 | L |
| Mailcheck | Mailcheck/Mailcheck.node.ts | 116 | S |
| Mailchimp | Mailchimp/Mailchimp.node.ts | 2205 | L |
| MailerLite | MailerLite/MailerLite.node.ts | 26 | S |
| Mailgun | Mailgun/Mailgun.node.ts | 207 | S |
| Mailjet | Mailjet/Mailjet.node.ts | 338 | M |
| Mandrill | Mandrill/Mandrill.node.ts | 906 | L |
| ManualTrigger | ManualTrigger/ManualTrigger.node.ts | 49 | S |
| Markdown | Markdown/Markdown.node.ts | 618 | M |
| Marketstack | Marketstack/Marketstack.node.ts | 184 | S |
| Matrix | Matrix/Matrix.node.ts | 162 | S |
| Mattermost | Mattermost/Mattermost.node.ts | 24 | S |
| Mautic | Mautic/Mautic.node.ts | 1028 | L |
| Medium | Medium/Medium.node.ts | 529 | M |
| Merge | Merge/Merge.node.ts | 32 | S |
| MessageBird | MessageBird/MessageBird.node.ts | 397 | M |
| Metabase | Metabase/Metabase.node.ts | 71 | S |
| Microsoft | Microsoft/Dynamics/MicrosoftDynamicsCrm.node.ts | 299 | S |
| Mindee | Mindee/Mindee.node.ts | 364 | M |
| Misp | Misp/Misp.node.ts | 791 | M |
| MistralAI | MistralAI/MistralAi.node.ts | 316 | M |
| Mocean | Mocean/Mocean.node.ts | 297 | S |
| MondayCom | MondayCom/MondayCom.node.ts | 779 | M |
| MongoDb | MongoDb/MongoDb.node.ts | 552 | M |
| MonicaCrm | MonicaCrm/MonicaCrm.node.ts | 1177 | L |
| MoveBinaryData | MoveBinaryData/MoveBinaryData.node.ts | 488 | M |
| Msg91 | Msg91/Msg91.node.ts | 173 | S |
| MySql | MySql/MySql.node.ts | 31 | S |
| N8n | N8n/N8n.node.ts | 90 | S |
| N8nTrainingCustomerDatastore | N8nTrainingCustomerDatastore/N8nTrainingCustomerDatastore.node.ts | 154 | S |
| N8nTrainingCustomerMessenger | N8nTrainingCustomerMessenger/N8nTrainingCustomerMessenger.node.ts | 67 | S |
| N8nTrigger | N8nTrigger/N8nTrigger.node.ts | 102 | S |
| Nasa | Nasa/Nasa.node.ts | 1145 | L |
| Netlify | Netlify/Netlify.node.ts | 211 | S |
| Netscaler | Netscaler/ADC/NetscalerAdc.node.ts | 252 | S |
| NextCloud | NextCloud/NextCloud.node.ts | 1307 | L |
| NoOp | NoOp/NoOp.node.ts | 31 | S |
| NocoDB | NocoDB/NocoDB.node.ts | 771 | M |
| Notion | Notion/Notion.node.ts | 28 | S |
| Npm | Npm/Npm.node.ts | 57 | S |
| Odoo | Odoo/Odoo.node.ts | 760 | M |
| Okta | Okta/Okta.node.ts | 59 | S |
| OneSimpleApi | OneSimpleApi/OneSimpleApi.node.ts | 883 | L |
| Onfleet | Onfleet/Onfleet.node.ts | 186 | S |
| OpenAi | OpenAi/OpenAi.node.ts | 81 | S |
| OpenThesaurus | OpenThesaurus/OpenThesaurus.node.ts | 190 | S |
| OpenWeatherMap | OpenWeatherMap/OpenWeatherMap.node.ts | 292 | S |
| Oracle | Oracle/Sql/OracleSql.node.ts | 29 | S |
| Orbit | Orbit/Orbit.node.ts | 102 | S |
| Oura | Oura/Oura.node.ts | 187 | S |
| Paddle | Paddle/Paddle.node.ts | 538 | M |
| PagerDuty | PagerDuty/PagerDuty.node.ts | 472 | M |
| PayPal | PayPal/PayPal.node.ts | 259 | S |
| Peekalink | Peekalink/Peekalink.node.ts | 94 | S |
| Perplexity | Perplexity/Perplexity.node.ts | 105 | S |
| Phantombuster | Phantombuster/Phantombuster.node.ts | 285 | S |
| PhilipsHue | PhilipsHue/PhilipsHue.node.ts | 187 | S |
| Pipedrive | Pipedrive/Pipedrive.node.ts | 26 | S |
| Plivo | Plivo/Plivo.node.ts | 149 | S |
| PostBin | PostBin/PostBin.node.ts | 51 | S |
| PostHog | PostHog/PostHog.node.ts | 286 | S |
| Postgres | Postgres/Postgres.node.ts | 32 | S |
| ProfitWell | ProfitWell/ProfitWell.node.ts | 150 | S |
| Pushbullet | Pushbullet/Pushbullet.node.ts | 511 | M |
| Pushcut | Pushcut/Pushcut.node.ts | 202 | S |
| Pushover | Pushover/Pushover.node.ts | 376 | M |
| QuestDb | QuestDb/QuestDb.node.ts | 271 | S |
| QuickBase | QuickBase/QuickBase.node.ts | 642 | M |
| QuickBooks | QuickBooks/QuickBooks.node.ts | 1165 | L |
| QuickChart | QuickChart/QuickChart.node.ts | 432 | M |
| RabbitMQ | RabbitMQ/RabbitMQ.node.ts | 550 | M |
| Raindrop | Raindrop/Raindrop.node.ts | 429 | M |
| ReadBinaryFile | ReadBinaryFile/ReadBinaryFile.node.ts | 97 | S |
| ReadBinaryFiles | ReadBinaryFiles/ReadBinaryFiles.node.ts | 69 | S |
| ReadPdf | ReadPdf/ReadPDF.node.ts | 105 | S |
| Reddit | Reddit/Reddit.node.ts | 441 | M |
| Redis | Redis/Redis.node.ts | 715 | M |
| RenameKeys | RenameKeys/RenameKeys.node.ts | 263 | S |
| RespondToWebhook | RespondToWebhook/RespondToWebhook.node.ts | 599 | M |
| Rocketchat | Rocketchat/Rocketchat.node.ts | 502 | M |
| RssFeedRead | RssFeedRead/RssFeedRead.node.ts | 176 | S |
| Rundeck | Rundeck/Rundeck.node.ts | 210 | S |
| S3 | S3/S3.node.ts | 912 | L |
| Salesforce | Salesforce/Salesforce.node.ts | 3080 | L |
| Salesmate | Salesmate/Salesmate.node.ts | 796 | M |
| SeaTable | SeaTable/SeaTable.node.ts | 27 | S |
| SecurityScorecard | SecurityScorecard/SecurityScorecard.node.ts | 522 | M |
| Segment | Segment/Segment.node.ts | 630 | M |
| SendGrid | SendGrid/SendGrid.node.ts | 666 | M |
| Sendy | Sendy/Sendy.node.ts | 313 | M |
| SentryIo | SentryIo/SentryIo.node.ts | 706 | M |
| ServiceNow | ServiceNow/ServiceNow.node.ts | 1159 | L |
| Set | Set/Set.node.ts | 31 | S |
| Shopify | Shopify/Shopify.node.ts | 479 | M |
| Signl4 | Signl4/Signl4.node.ts | 355 | M |
| Simulate | Simulate/Simulate.node.ts | 131 | S |
| Slack | Slack/Slack.node.ts | 30 | S |
| Sms77 | Sms77/Sms77.node.ts | 284 | S |
| Snowflake | Snowflake/Snowflake.node.ts | 267 | S |
| SplitInBatches | SplitInBatches/SplitInBatches.node.ts | 28 | S |
| Splunk | Splunk/Splunk.node.ts | 25 | S |
| Spotify | Spotify/Spotify.node.ts | 1336 | L |
| SpreadsheetFile | SpreadsheetFile/SpreadsheetFile.node.ts | 26 | S |
| SseTrigger | SseTrigger/SseTrigger.node.ts | 71 | S |
| Ssh | Ssh/Ssh.node.ts | 509 | M |
| Stackby | Stackby/Stackby.node.ts | 350 | M |
| StickyNote | StickyNote/StickyNote.node.ts | 61 | S |
| StopAndError | StopAndError/StopAndError.node.ts | 93 | S |
| Storyblok | Storyblok/Storyblok.node.ts | 364 | M |
| Strapi | Strapi/Strapi.node.ts | 405 | M |
| Strava | Strava/Strava.node.ts | 204 | S |
| Stripe | Stripe/Stripe.node.ts | 558 | M |
| Supabase | Supabase/Supabase.node.ts | 502 | M |
| Switch | Switch/Switch.node.ts | 32 | S |
| SyncroMSP | SyncroMSP/SyncroMsp.node.ts | 25 | S |
| Taiga | Taiga/Taiga.node.ts | 596 | M |
| Tapfiliate | Tapfiliate/Tapfiliate.node.ts | 316 | M |
| Telegram | Telegram/Telegram.node.ts | 2249 | L |
| TheHive | TheHive/TheHive.node.ts | 1903 | L |
| TheHiveProject | TheHiveProject/TheHiveProject.node.ts | 15 | S |
| TimeSaved | TimeSaved/TimeSaved.node.ts | 111 | S |
| TimescaleDb | TimescaleDb/TimescaleDb.node.ts | 335 | M |
| Todoist | Todoist/Todoist.node.ts | 28 | S |
| Totp | Totp/Totp.node.ts | 189 | S |
| Transform | Transform/Sort/Sort.node.ts | 290 | S |
| TravisCi | TravisCi/TravisCi.node.ts | 180 | S |
| Trello | Trello/Trello.node.ts | 916 | L |
| Twake | Twake/Twake.node.ts | 235 | S |
| Twilio | Twilio/Twilio.node.ts | 305 | M |
| Twist | Twist/Twist.node.ts | 771 | M |
| Twitter | Twitter/Twitter.node.ts | 26 | S |
| UProc | UProc/UProc.node.ts | 146 | S |
| UnleashedSoftware | UnleashedSoftware/UnleashedSoftware.node.ts | 198 | S |
| Uplead | Uplead/Uplead.node.ts | 126 | S |
| UptimeRobot | UptimeRobot/UptimeRobot.node.ts | 430 | M |
| UrlScanIo | UrlScanIo/UrlScanIo.node.ts | 145 | S |
| Venafi | Venafi/Datacenter/VenafiTlsProtectDatacenter.node.ts | 258 | S |
| Vero | Vero/Vero.node.ts | 236 | S |
| Vonage | Vonage/Vonage.node.ts | 497 | M |
| Wait | Wait/Wait.node.ts | 632 | M |
| Webflow | Webflow/Webflow.node.ts | 26 | S |
| Webhook | Webhook/Webhook.node.ts | 361 | M |
| Wekan | Wekan/Wekan.node.ts | 676 | M |
| WhatsApp | WhatsApp/WhatsApp.node.ts | 107 | S |
| Wise | Wise/Wise.node.ts | 555 | M |
| WooCommerce | WooCommerce/WooCommerce.node.ts | 590 | M |
| Wordpress | Wordpress/Wordpress.node.ts | 656 | M |
| WorkflowTrigger | WorkflowTrigger/WorkflowTrigger.node.ts | 102 | S |
| WriteBinaryFile | WriteBinaryFile/WriteBinaryFile.node.ts | 140 | S |
| Xero | Xero/Xero.node.ts | 731 | M |
| Xml | Xml/Xml.node.ts | 313 | M |
| Yourls | Yourls/Yourls.node.ts | 104 | S |
| Zammad | Zammad/Zammad.node.ts | 852 | L |
| Zendesk | Zendesk/Zendesk.node.ts | 800 | L |
| Zoho | Zoho/ZohoCrm.node.ts | 1336 | L |
| Zoom | Zoom/Zoom.node.ts | 797 | M |
| Zulip | Zulip/Zulip.node.ts | 475 | M |

## Wave assignments

Migration runs in **waves of ~50 nodes**, each wave further split into **batches of ~10 nodes** dispatched to parallel sub-agents. Skip already-ported services (`slack`, `discord`, `github`, `twilio`, `sendgrid`, `notion`, `airtable`) — those land an upgrade to use `credentialType` instead of inline auth fields, not a fresh port.

### Wave 1 — 50 high-priority nodes (most-used connectors + utilities)

| Batch | Services |
| --- | --- |
| W1-B1 (Communication) | Telegram · WhatsApp · Mattermost · Discord-extended · Matrix · Twilio-extended · Rocketchat · Line · MessageBird · Vonage |
| W1-B2 (CRM core) | HubSpot · Salesforce · Pipedrive · ActiveCampaign · Copper · Freshworks · Zoho · AgileCrm · CustomerIo · Intercom |
| W1-B3 (Project mgmt) | Asana · Linear · Trello · ClickUp · Monday · Jira · Wekan · Taiga · Todoist · Notion-extended |
| W1-B4 (Storage / Files) | S3 · Dropbox · NextCloud · Box · Ftp · Ssh · Snowflake · Postgres · MySql · MongoDb |
| W1-B5 (Generic + Logic) | HttpRequest · Webhook · Set · If · Switch · Filter · Merge · GraphQL · RenameKeys · Crypto |

### Future waves (reserved IDs, expanded in subsequent sessions)

| Wave | Theme | Approx services |
| --- | --- | --- |
| W2 | Email & marketing (Mailchimp, SendGrid-extended, Mailgun, Mailjet, Mandrill, ConvertKit, GetResponse, Brevo, MailerLite, Vero) | 10 |
| W3 | Commerce (Shopify, WooCommerce, Stripe, Paddle, Chargebee, PayPal, Magento, QuickBooks, Xero, InvoiceNinja) | 10 |
| W4 | DevOps & Git (Gitlab, Bitbucket, Jenkins, CircleCi, TravisCi, Webhook-builders, Cloudflare, Netlify, S3-extended, Aws-Lambda) | 10 |
| W5 | Productivity & Docs (Coda, Google-Sheets-extended, NocoDB-extended, Baserow, Grist, Stackby, SeaTable, Strapi, Ghost, WordPress) | 10 |
| W6–W12 | Remaining tiers — monitoring/observability, AI, support, scheduling, analytics, e-commerce, IoT, regional services | 10 each |
| W13+ | Trigger nodes (Webhook-trigger, Cron, Schedule, Mongo-change-stream, Postgres-trigger) | per service |
| Final | Versioned variants (V1/V2/V3) wired to the same block via `block.options.version` | as needed |

Anything missing should be added at the end of this inventory before its wave starts, never inline into a new file.
