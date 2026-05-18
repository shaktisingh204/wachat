//! All SabFlow nodes.
//!
//! Layout:
//!   - One module per fully-implemented node (e.g. `http_request`, `slack`).
//!   - Stubs for the remaining n8n-parity nodes are registered via
//!     [`register_stubs`] using the shared [`stub::StubNode`].
//!
//! [`register_all`] is the single entry point used by the registry.
//! Implemented nodes register first so stubs with the same name don't overwrite them.

pub mod stub;

// ── Fully-implemented core nodes ────────────────────────────────────────────
pub mod http_request;
pub mod set;
pub mod edit_fields;
pub mod function;
pub mod if_node;
pub mod switch_node;
pub mod merge_node;
pub mod wait;
pub mod code_node;
pub mod schedule_trigger;
pub mod manual_trigger;
pub mod execute_workflow_trigger;
pub mod webhook_trigger;
pub mod noop_node;
// ── Phase C.4.9: trigger variants ───────────────────────────────────────────
pub mod form_trigger;
pub mod interval_trigger;
pub mod cron_trigger;
pub mod local_file_trigger;
pub mod email_trigger;
pub mod mqtt_trigger;

// ── Fully-implemented integration nodes ─────────────────────────────────────
pub mod slack;
pub mod discord;
pub mod github;
pub mod gitlab;
pub mod notion;
pub mod airtable;
pub mod google_sheets;
pub mod gmail;
pub mod sendgrid;
pub mod mailchimp;
pub mod twilio;
pub mod hubspot;
pub mod stripe;
pub mod telegram;
pub mod openai;
pub mod anthropic;
pub mod postgres;
pub mod mongo_db;
pub mod redis_node;
pub mod respond_to_webhook;

// ── Phase 7B: 50 additional implemented nodes ───────────────────────────────
pub mod email_send;
pub mod email_read_imap;
pub mod matrix;
pub mod mattermost;
pub mod rocketchat;
pub mod line;
pub mod zoom;
pub mod whatsapp;
pub mod pipedrive;
pub mod salesforce;
pub mod zoho;
pub mod active_campaign;
pub mod customer_io;
pub mod convert_kit;
pub mod get_response;
pub mod mailer_lite;
pub mod brevo;
pub mod shopify;
pub mod woo_commerce;
pub mod magento;
pub mod dropbox;
pub mod box_node;
pub mod s3;
pub mod next_cloud;
pub mod ftp;
pub mod typeform;
pub mod jot_form;
pub mod formstack;
pub mod asana;
pub mod trello;
pub mod linear;
pub mod jira;
pub mod click_up;
pub mod monday_com;
pub mod calendly;
pub mod cal_com;
pub mod post_hog;
pub mod segment_node;
pub mod metabase;
pub mod html;
pub mod xml;
pub mod convert_to_file;
pub mod convert_to_text;
pub mod jwt;
pub mod crypto;
pub mod date_time;
pub mod rss_feed_read;
pub mod graphql;
pub mod ssh;
pub mod my_sql;
pub mod supabase;
pub mod noco_db;

// ── Phase C.5.4: CRM/sales nodes ────────────────────────────────────────────
pub mod copper;
pub mod agile_crm;
pub mod close_io;
pub mod freshworks_crm;
pub mod affinity;
pub mod kommo;

use crate::{descriptor::NodeCategory, registry::NodeRegistry};

/// Register every node (real + stub) into the registry.
pub fn register_all(r: &mut NodeRegistry) {
    register_implemented(r);
    register_stubs(r);
}

/// Register every node that has a real Rust implementation.
///
/// ## Phase C.4.8 picks (miscellaneous A-band stubs, 6 nodes)
///
/// Selected from `register_stubs` candidates that are **not** claimed by
/// C.4.1-C.4.7 (storage / SQL / NoSQL / data-shaping / comms / crypto /
/// lifecycle) and that we can ship in one sub-task. The C.3.2 stub policy
/// applies to image processing: descriptor is full, runtime declines until
/// the imaging backend lands.
///
/// 1. `compareDatasets` — diff two upstream datasets by key (4 branches).
/// 2. `renameKeys`      — rename top-level keys per `{from, to}` mapping.
/// 3. `function`        — legacy code node, downgraded to the expression DSL.
/// 4. `functionItem`    — legacy per-item code node, same DSL semantics.
/// 5. `spreadsheetFile` — read/write CSV + TSV (XLSX/ODS deliberately declined).
/// 6. `editImage`       — full descriptor surface; runtime declines (C.3.2 stub policy).
fn register_implemented(r: &mut NodeRegistry) {
    // Core (12 — C.3.2 added edit_fields + function alongside set)
    r.register(http_request::HttpRequestNode);
    r.register(set::SetNode);
    r.register(edit_fields::EditFieldsNode);
    r.register(function::FunctionNode);
    r.register(if_node::IfNode);
    r.register(switch_node::SwitchNode);
    r.register(merge_node::MergeNode);
    r.register(wait::WaitNode);
    r.register(code_node::CodeNode);
    r.register(schedule_trigger::ScheduleTriggerNode);
    r.register(manual_trigger::ManualTriggerNode);
    r.register(execute_workflow_trigger::ExecuteWorkflowTriggerNode);
    r.register(webhook_trigger::WebhookTriggerNode);
    r.register(no_op::NoOpNode);
    r.register(compression::CompressionNode);
    // Integrations (20)
    r.register(slack::SlackNode);
    r.register(discord::DiscordNode);
    r.register(github::GithubNode);
    r.register(gitlab::GitlabNode);
    r.register(notion::NotionNode);
    r.register(airtable::AirtableNode);
    r.register(google_sheets::GoogleSheetsNode);
    r.register(gmail::GmailNode);
    r.register(sendgrid::SendGridNode);
    r.register(mailchimp::MailchimpNode);
    r.register(twilio::TwilioNode);
    r.register(hubspot::HubspotNode);
    r.register(stripe::StripeNode);
    r.register(telegram::TelegramNode);
    r.register(openai::OpenAiNode);
    r.register(anthropic::AnthropicNode);
    r.register(postgres::PostgresNode);
    r.register(mongo_db::MongoDbNode);
    r.register(redis_node::RedisNode);
    r.register(respond_to_webhook::RespondToWebhookNode);
    // Phase 7B — 50 new implementations
    r.register(email_send::EmailSendNode);
    r.register(email_read_imap::EmailReadImapNode);
    r.register(matrix::MatrixNode);
    r.register(mattermost::MattermostNode);
    r.register(rocketchat::RocketChatNode);
    r.register(line::LineNode);
    r.register(zoom::ZoomNode);
    r.register(whatsapp::WhatsAppNode);
    r.register(pipedrive::PipedriveNode);
    r.register(salesforce::SalesforceNode);
    r.register(zoho::ZohoNode);
    r.register(active_campaign::ActiveCampaignNode);
    r.register(customer_io::CustomerIoNode);
    r.register(convert_kit::ConvertKitNode);
    r.register(get_response::GetResponseNode);
    r.register(mailer_lite::MailerLiteNode);
    r.register(brevo::BrevoNode);
    r.register(shopify::ShopifyNode);
    r.register(woo_commerce::WooCommerceNode);
    r.register(magento::MagentoNode);
    r.register(dropbox::DropboxNode);
    r.register(box_node::BoxNode);
    r.register(s3::S3Node);
    r.register(next_cloud::NextCloudNode);
    r.register(ftp::FtpNode);
    r.register(typeform::TypeformNode);
    r.register(jot_form::JotFormNode);
    r.register(formstack::FormstackNode);
    r.register(asana::AsanaNode);
    r.register(trello::TrelloNode);
    r.register(linear::LinearNode);
    r.register(jira::JiraNode);
    r.register(click_up::ClickUpNode);
    r.register(monday_com::MondayComNode);
    r.register(calendly::CalendlyNode);
    r.register(cal_com::CalComNode);
    r.register(post_hog::PostHogNode);
    r.register(segment_node::SegmentNode);
    r.register(metabase::MetabaseNode);
    r.register(html::HtmlNode);
    r.register(xml::XmlNode);
    r.register(convert_to_file::ConvertToFileNode);
    r.register(convert_to_text::ConvertToTextNode);
    r.register(jwt::JwtNode);
    r.register(crypto::CryptoNode);
    r.register(date_time::DateTimeNode);
    r.register(rss_feed_read::RssFeedReadNode);
    r.register(graphql::GraphqlNode);
    r.register(ssh::SshNode);
    r.register(my_sql::MySqlNode);
    r.register(supabase::SupabaseNode);
    r.register(noco_db::NocoDbNode);
    // Phase C.5.4 — CRM / sales (6)
    r.register(copper::CopperNode);
    r.register(agile_crm::AgileCrmNode);
    r.register(close_io::CloseIoNode);
    r.register(freshworks_crm::FreshworksCrmNode);
    r.register(affinity::AffinityNode);
    r.register(kommo::KommoNode);
}

/// Register stubs only when the name isn't already populated by an implemented node.
fn register_stubs(r: &mut NodeRegistry) {
    let stubs: &[(&str, &str, NodeCategory, &str)] = &[
        // (name, displayName, category, description)
        ("actionNetwork", "Action Network", NodeCategory::Crm, "Action Network operations"),
        ("activeCampaign", "ActiveCampaign", NodeCategory::Marketing, "Marketing automation and CRM"),
        ("acuityScheduling", "Acuity Scheduling", NodeCategory::Productivity, "Online appointment scheduling"),
        ("adalo", "Adalo", NodeCategory::Developer, "Adalo app data operations"),
        ("affinity", "Affinity", NodeCategory::Crm, "Relationship intelligence CRM"),
        ("agileCrm", "Agile CRM", NodeCategory::Crm, "Customer relationship management"),
        ("aiTransform", "AI Transform", NodeCategory::Ai, "Transform data with AI"),
        ("airtop", "Airtop", NodeCategory::Ai, "Browser automation for AI agents"),
        ("amqp", "AMQP", NodeCategory::Developer, "AMQP message queue"),
        ("apiTemplateIo", "APITemplate.io", NodeCategory::Developer, "Generate PDFs and images"),
        ("asana", "Asana", NodeCategory::Productivity, "Project and task management"),
        ("autopilot", "Autopilot", NodeCategory::Marketing, "Marketing automation"),
        ("aws", "AWS", NodeCategory::Storage, "Amazon Web Services"),
        ("bambooHr", "BambooHR", NodeCategory::Hr, "HR management"),
        ("bannerbear", "Bannerbear", NodeCategory::Marketing, "Auto-generate marketing creatives"),
        ("baserow", "Baserow", NodeCategory::Database, "Open-source no-code database"),
        ("beeminder", "Beeminder", NodeCategory::Productivity, "Goal tracking"),
        ("bitbucket", "Bitbucket", NodeCategory::Developer, "Git hosting and code review"),
        ("bitly", "Bitly", NodeCategory::Marketing, "URL shortener"),
        ("bitwarden", "Bitwarden", NodeCategory::Developer, "Password manager"),
        ("box", "Box", NodeCategory::Storage, "Cloud content management"),
        ("brandfetch", "Brandfetch", NodeCategory::Marketing, "Brand asset lookup"),
        ("brevo", "Brevo", NodeCategory::Marketing, "Email and SMS marketing"),
        ("bubble", "Bubble", NodeCategory::Developer, "No-code app data"),
        ("cal", "Cal.com", NodeCategory::Productivity, "Open-source scheduling"),
        ("calendly", "Calendly", NodeCategory::Productivity, "Meeting scheduling"),
        ("chargebee", "Chargebee", NodeCategory::Finance, "Subscription billing"),
        ("circleCi", "CircleCI", NodeCategory::Developer, "Continuous integration"),
        ("cisco", "Cisco", NodeCategory::Developer, "Cisco Webex meetings"),
        ("clearbit", "Clearbit", NodeCategory::Marketing, "Business intelligence APIs"),
        ("clickUp", "ClickUp", NodeCategory::Productivity, "Project management"),
        ("clockify", "Clockify", NodeCategory::Productivity, "Time tracking"),
        ("closeIo", "Close", NodeCategory::Sales, "Close (close.io) sales CRM"),
        ("cloudflare", "Cloudflare", NodeCategory::Developer, "DNS and CDN management"),
        ("cockpit", "Cockpit", NodeCategory::Developer, "Headless CMS"),
        ("coda", "Coda", NodeCategory::Productivity, "All-in-one doc"),
        ("cohere", "Cohere", NodeCategory::Ai, "Cohere chat, embeddings, and reranking"),
        ("coinGecko", "CoinGecko", NodeCategory::Finance, "Cryptocurrency price data"),
        ("compareDatasets", "Compare Datasets", NodeCategory::Transform, "Diff two datasets"),
        ("contentful", "Contentful", NodeCategory::Developer, "Headless CMS"),
        ("convertKit", "ConvertKit", NodeCategory::Marketing, "Email marketing for creators"),
        ("convertToFile", "Convert to File", NodeCategory::Transform, "Convert items into a binary file (CSV/JSON/TSV/XML/HTML/iCal/RTF)"),
        ("convertToText", "Convert to Text", NodeCategory::Transform, "Parse a binary file back into items"),
        ("copper", "Copper", NodeCategory::Crm, "CRM built for Google Workspace"),
        ("cortex", "Cortex", NodeCategory::Developer, "Threat intelligence analysis"),
        ("cron", "Cron", NodeCategory::Logic, "Schedule by cron expression"),
        ("crypto", "Crypto", NodeCategory::Transform, "Cryptographic operations"),
        ("currents", "Currents", NodeCategory::Analytics, "News API"),
        ("customerIo", "Customer.io", NodeCategory::Marketing, "Behavioural email"),
        ("dataTable", "Data Table", NodeCategory::Transform, "Tabular data operations"),
        ("databricks", "Databricks", NodeCategory::Analytics, "Lakehouse platform"),
        ("debugHelper", "Debug Helper", NodeCategory::Developer, "Generate test data"),
        ("deepL", "DeepL", NodeCategory::Ai, "Translation API"),
        ("demio", "Demio", NodeCategory::Marketing, "Webinars"),
        ("dhl", "DHL", NodeCategory::Misc, "Shipping tracking"),
        ("discourse", "Discourse", NodeCategory::Communication, "Forum platform"),
        ("disqus", "Disqus", NodeCategory::Communication, "Comment platform"),
        ("drift", "Drift", NodeCategory::Marketing, "Conversational marketing"),
        ("dropbox", "Dropbox", NodeCategory::Storage, "Cloud file storage"),
        ("dropcontact", "Dropcontact", NodeCategory::Crm, "Email enrichment"),
        ("dynamicCredentialCheck", "Dynamic Credential Check", NodeCategory::Developer, "Test credentials"),
        ("e2eTest", "E2E Test", NodeCategory::Developer, "End-to-end test helper"),
        ("erpNext", "ERPNext", NodeCategory::Finance, "Open-source ERP"),
        ("editImage", "Edit Image", NodeCategory::Files, "Image manipulation"),
        ("egoi", "E-goi", NodeCategory::Marketing, "Multi-channel marketing"),
        // `elastic` → replaced by the fully-implemented `elasticsearch` node (Phase C.4.3).
        ("elasticsearch", "Elasticsearch", NodeCategory::Database, "Search engine — REST API search/index/get/update/delete/count"),
        ("emailReadImap", "Email Read (IMAP)", NodeCategory::Communication, "Read emails via IMAP"),
        ("emailSend", "Send Email", NodeCategory::Communication, "Send via SMTP"),
        ("emelia", "Emelia", NodeCategory::Marketing, "Cold email outreach"),
        ("errorTrigger", "Error Trigger", NodeCategory::Trigger, "Triggers on workflow errors"),
        ("evaluation", "Evaluation", NodeCategory::Ai, "Evaluate AI outputs"),
        ("eventbrite", "Eventbrite", NodeCategory::Productivity, "Event ticketing"),
        ("executeCommand", "Execute Command", NodeCategory::Developer, "Run a shell command"),
        // `executeWorkflow` is fully implemented — see `execute_workflow::ExecuteWorkflowNode`.
        ("executionData", "Execution Data", NodeCategory::Developer, "Read execution metadata"),
        ("facebook", "Facebook", NodeCategory::Marketing, "Facebook Graph API"),
        ("facebookLeadAds", "Facebook Lead Ads", NodeCategory::Marketing, "Lead form submissions"),
        ("figma", "Figma", NodeCategory::Productivity, "Design files"),
        ("fileMaker", "FileMaker", NodeCategory::Database, "FileMaker DB"),
        ("files", "Files", NodeCategory::Files, "Local file system operations"),
        ("filter", "Filter", NodeCategory::Transform, "Filter items by condition"),
        ("flow", "Flow", NodeCategory::Productivity, "Flow.io project management"),
        ("form", "Form", NodeCategory::Trigger, "Built-in form trigger"),
        ("formIo", "Form.io", NodeCategory::Productivity, "Form builder"),
        ("formstack", "Formstack", NodeCategory::Productivity, "Online forms"),
        ("freshdesk", "Freshdesk", NodeCategory::Communication, "Customer support"),
        ("freshservice", "Freshservice", NodeCategory::Communication, "IT service management"),
        ("freshworksCrm", "Freshworks CRM", NodeCategory::Crm, "Freshworks CRM"),
        ("ftp", "FTP", NodeCategory::Storage, "Transfer files via FTP/SFTP"),
        // ("function", ...) promoted to a real implementation in Phase C.3.2 — see nodes/function.rs.
        ("functionItem", "Function Item (legacy)", NodeCategory::Logic, "Legacy per-item code"),
        ("getResponse", "GetResponse", NodeCategory::Marketing, "Email marketing"),
        ("ghost", "Ghost", NodeCategory::Marketing, "Publishing platform"),
        ("git", "Git", NodeCategory::Developer, "Run git commands"),
        ("goToWebinar", "GoToWebinar", NodeCategory::Marketing, "Webinars"),
        ("gong", "Gong", NodeCategory::Sales, "Revenue intelligence"),
        ("google", "Google", NodeCategory::Productivity, "Google Workspace operations"),
        ("gotify", "Gotify", NodeCategory::Communication, "Self-hosted push notifications"),
        ("grafana", "Grafana", NodeCategory::Analytics, "Observability dashboards"),
        ("graphQL", "GraphQL", NodeCategory::Developer, "Send GraphQL queries"),
        ("grist", "Grist", NodeCategory::Database, "Spreadsheet-database hybrid"),
        ("gumroad", "Gumroad", NodeCategory::Finance, "Digital product sales"),
        ("hackerNews", "Hacker News", NodeCategory::Analytics, "HN API"),
        ("haloPsa", "HaloPSA", NodeCategory::Communication, "Service management"),
        ("harvest", "Harvest", NodeCategory::Finance, "Time tracking and invoicing"),
        ("helpScout", "Help Scout", NodeCategory::Communication, "Customer support"),
        ("highLevel", "HighLevel", NodeCategory::Crm, "All-in-one marketing"),
        ("homeAssistant", "Home Assistant", NodeCategory::Misc, "Home automation"),
        ("html", "HTML", NodeCategory::Transform, "HTML manipulation"),
        ("htmlExtract", "HTML Extract", NodeCategory::Transform, "Extract content from HTML"),
        ("humanticAi", "HumanticAI", NodeCategory::Ai, "Personality AI"),
        ("hunter", "Hunter", NodeCategory::Marketing, "Email finder and verifier"),
        ("iCalendar", "iCalendar", NodeCategory::Productivity, "Generate iCal events"),
        ("intercom", "Intercom", NodeCategory::Communication, "Customer messaging"),
        ("interval", "Interval", NodeCategory::Trigger, "Fire at fixed intervals"),
        ("invoiceNinja", "Invoice Ninja", NodeCategory::Finance, "Invoicing and billing"),
        ("iterable", "Iterable", NodeCategory::Marketing, "Cross-channel marketing"),
        ("jenkins", "Jenkins", NodeCategory::Developer, "CI/CD jobs"),
        ("jinaAi", "Jina AI", NodeCategory::Ai, "Embeddings and reranking"),
        ("jira", "Jira", NodeCategory::Developer, "Issue tracking"),
        ("jotForm", "JotForm", NodeCategory::Productivity, "Online form builder"),
        ("jwt", "JWT", NodeCategory::Developer, "Sign and verify JWTs"),
        ("kafka", "Kafka", NodeCategory::Developer, "Apache Kafka producer/consumer"),
        ("keap", "Keap", NodeCategory::Crm, "Small-business CRM"),
        ("koBoToolbox", "KoBoToolbox", NodeCategory::Productivity, "Data collection forms"),
        ("kommo", "Kommo", NodeCategory::Crm, "Kommo (amoCRM) sales CRM"),
        ("ldap", "LDAP", NodeCategory::Developer, "Directory operations"),
        ("lemlist", "Lemlist", NodeCategory::Marketing, "Cold email outreach"),
        ("line", "LINE", NodeCategory::Communication, "LINE messaging"),
        ("linear", "Linear", NodeCategory::Developer, "Issue tracking for software teams"),
        ("lingvaNex", "LingvaNex", NodeCategory::Ai, "Translation"),
        ("linkedIn", "LinkedIn", NodeCategory::Marketing, "LinkedIn social posting"),
        ("localFileTrigger", "Local File Trigger", NodeCategory::Trigger, "Watch local file system"),
        ("loneScale", "LoneScale", NodeCategory::Sales, "Sales intent data"),
        ("mqtt", "MQTT", NodeCategory::Developer, "MQTT messaging"),
        ("magento", "Magento", NodeCategory::Finance, "E-commerce platform"),
        ("mailcheck", "Mailcheck", NodeCategory::Developer, "Validate email addresses"),
        ("mailerLite", "MailerLite", NodeCategory::Marketing, "Email marketing"),
        ("mailgun", "Mailgun", NodeCategory::Communication, "Email API"),
        ("mailjet", "Mailjet", NodeCategory::Communication, "Email service"),
        ("mandrill", "Mandrill", NodeCategory::Communication, "Transactional email"),
        ("markdown", "Markdown", NodeCategory::Transform, "Markdown <-> HTML conversion"),
        ("marketstack", "marketstack", NodeCategory::Finance, "Stock market data"),
        ("matrix", "Matrix", NodeCategory::Communication, "Decentralised chat"),
        ("mattermost", "Mattermost", NodeCategory::Communication, "Team chat"),
        ("mautic", "Mautic", NodeCategory::Marketing, "Marketing automation"),
        ("medium", "Medium", NodeCategory::Marketing, "Publishing platform"),
        ("messageBird", "MessageBird", NodeCategory::Communication, "Omnichannel messaging"),
        ("metabase", "Metabase", NodeCategory::Analytics, "Business intelligence"),
        ("microsoft", "Microsoft", NodeCategory::Productivity, "Microsoft 365 services"),
        ("mindee", "Mindee", NodeCategory::Ai, "Document OCR"),
        ("misp", "MISP", NodeCategory::Developer, "Threat intelligence platform"),
        ("mistralAi", "Mistral AI", NodeCategory::Ai, "Mistral language models"),
        ("mocean", "Mocean", NodeCategory::Communication, "SMS messaging"),
        ("mondayCom", "monday.com", NodeCategory::Productivity, "Work OS"),
        ("monicaCrm", "Monica CRM", NodeCategory::Crm, "Personal CRM"),
        ("msg91", "MSG91", NodeCategory::Communication, "SMS gateway"),
        ("mySql", "MySQL", NodeCategory::Database, "MySQL operations"),
        ("n8n", "n8n API", NodeCategory::Developer, "Manage n8n itself"),
        ("n8nTrainingCustomerDatastore", "n8n Training: Customer Data", NodeCategory::Developer, "Training-only mock node"),
        ("n8nTrainingCustomerMessenger", "n8n Training: Customer Messenger", NodeCategory::Developer, "Training-only mock node"),
        ("n8nTrigger", "n8n Trigger", NodeCategory::Trigger, "n8n lifecycle events"),
        ("nasa", "NASA", NodeCategory::Misc, "NASA Open APIs"),
        ("netlify", "Netlify", NodeCategory::Developer, "Netlify hosting"),
        ("netscaler", "Netscaler", NodeCategory::Developer, "Citrix Netscaler ops"),
        ("nextCloud", "NextCloud", NodeCategory::Storage, "Self-hosted cloud storage"),
        ("nocoDb", "NocoDB", NodeCategory::Database, "No-code database"),
        ("npm", "npm", NodeCategory::Developer, "npm package operations"),
        ("odoo", "Odoo", NodeCategory::Finance, "Open ERP"),
        ("okta", "Okta", NodeCategory::Developer, "Identity management"),
        ("oneSimpleApi", "One Simple API", NodeCategory::Developer, "Multi-purpose API"),
        ("onfleet", "Onfleet", NodeCategory::Misc, "Last-mile delivery"),
        ("openThesaurus", "OpenThesaurus", NodeCategory::Ai, "German thesaurus"),
        ("openWeatherMap", "OpenWeatherMap", NodeCategory::Misc, "Weather data"),
        ("orbit", "Orbit", NodeCategory::Marketing, "Community management"),
        ("oura", "Oura", NodeCategory::Misc, "Health tracking ring"),
        ("paddle", "Paddle", NodeCategory::Finance, "Subscription billing"),
        ("pagerDuty", "PagerDuty", NodeCategory::Communication, "On-call incident response"),
        ("payPal", "PayPal", NodeCategory::Finance, "Payments"),
        ("peekalink", "Peekalink", NodeCategory::Misc, "URL preview generator"),
        ("perplexity", "Perplexity", NodeCategory::Ai, "Perplexity AI search"),
        ("phantombuster", "Phantombuster", NodeCategory::Marketing, "Automated outreach"),
        ("philipsHue", "Philips Hue", NodeCategory::Misc, "Smart lighting"),
        ("pinecone", "Pinecone", NodeCategory::Database, "Pinecone vector database"),
        ("pipedrive", "Pipedrive", NodeCategory::Sales, "Sales CRM"),
        ("plivo", "Plivo", NodeCategory::Communication, "SMS / voice"),
        ("postBin", "PostBin", NodeCategory::Developer, "HTTP request bin"),
        ("postHog", "PostHog", NodeCategory::Analytics, "Product analytics"),
        ("postmark", "Postmark", NodeCategory::Communication, "Transactional email"),
        ("profitWell", "ProfitWell", NodeCategory::Finance, "SaaS metrics"),
        ("pushbullet", "Pushbullet", NodeCategory::Communication, "Cross-device notifications"),
        ("pushcut", "Pushcut", NodeCategory::Communication, "iOS automation"),
        ("pushover", "Pushover", NodeCategory::Communication, "Push notifications"),
        ("qdrant", "Qdrant", NodeCategory::Database, "Qdrant vector database"),
        ("questDb", "QuestDB", NodeCategory::Database, "Time-series database"),
        ("quickBase", "QuickBase", NodeCategory::Database, "Low-code application database"),
        ("quickBooks", "QuickBooks", NodeCategory::Finance, "Accounting"),
        ("quickChart", "QuickChart", NodeCategory::Analytics, "Chart image generation"),
        ("rabbitMq", "RabbitMQ", NodeCategory::Developer, "AMQP message broker"),
        ("raindrop", "Raindrop", NodeCategory::Productivity, "Bookmark manager"),
        ("readBinaryFiles", "Read Binary Files", NodeCategory::Files, "Read multiple files"),
        ("readPdf", "Read PDF", NodeCategory::Files, "Extract text from PDF"),
        ("reddit", "Reddit", NodeCategory::Communication, "Reddit API"),
        ("renameKeys", "Rename Keys", NodeCategory::Transform, "Rename object keys"),
        ("rocketchat", "Rocket.Chat", NodeCategory::Communication, "Self-hosted team chat"),
        ("rssFeedRead", "RSS Feed Read", NodeCategory::Communication, "Read RSS feeds"),
        ("rundeck", "Rundeck", NodeCategory::Developer, "Job scheduler"),
        ("s3", "S3", NodeCategory::Storage, "S3-compatible object storage"),
        ("salesforce", "Salesforce", NodeCategory::Crm, "Salesforce CRM"),
        ("salesmate", "Salesmate", NodeCategory::Sales, "Sales CRM"),
        ("schedule", "Schedule", NodeCategory::Trigger, "Schedule trigger by interval or cron"),
        ("seaTable", "SeaTable", NodeCategory::Database, "Real-time collaborative database"),
        ("securityScorecard", "SecurityScorecard", NodeCategory::Developer, "Security ratings"),
        ("segment", "Segment", NodeCategory::Analytics, "Customer data platform"),
        ("sendy", "Sendy", NodeCategory::Marketing, "Self-hosted email marketing"),
        ("sentryIo", "Sentry.io", NodeCategory::Developer, "Error monitoring"),
        ("serviceNow", "ServiceNow", NodeCategory::Communication, "IT service management"),
        ("shopify", "Shopify", NodeCategory::Finance, "E-commerce platform"),
        ("signl4", "Signl4", NodeCategory::Communication, "Mobile alerting"),
        ("simulate", "Simulate", NodeCategory::Developer, "Simulate node output"),
        ("sms77", "sms77", NodeCategory::Communication, "SMS messaging"),
        ("snowflake", "Snowflake", NodeCategory::Database, "Cloud data warehouse"),
        ("splitInBatches", "Split In Batches", NodeCategory::Logic, "Loop over items in batches"),
        ("splunk", "Splunk", NodeCategory::Analytics, "Operational intelligence"),
        ("spotify", "Spotify", NodeCategory::Misc, "Music streaming API"),
        ("spreadsheetFile", "Spreadsheet File", NodeCategory::Files, "Read/write CSV, XLS, ODS"),
        ("sseTrigger", "SSE Trigger", NodeCategory::Trigger, "Server-Sent Events trigger"),
        ("ssh", "SSH", NodeCategory::Developer, "Execute SSH commands"),
        ("stackby", "Stackby", NodeCategory::Database, "Spreadsheet-style database"),
        ("stickyNote", "Sticky Note", NodeCategory::Misc, "Canvas annotation"),
        // `stopAndError` is fully implemented — see `stop_and_error::StopAndErrorNode`.
        ("storyblok", "Storyblok", NodeCategory::Developer, "Headless CMS"),
        ("strapi", "Strapi", NodeCategory::Developer, "Headless CMS"),
        ("strava", "Strava", NodeCategory::Misc, "Athletic activity tracking"),
        ("supabase", "Supabase", NodeCategory::Database, "Open-source Firebase alternative"),
        ("surveyMonkey", "SurveyMonkey", NodeCategory::Productivity, "Surveys"),
        ("syncroMsp", "SyncroMSP", NodeCategory::Communication, "MSP management"),
        ("taiga", "Taiga", NodeCategory::Developer, "Project management"),
        ("tapfiliate", "Tapfiliate", NodeCategory::Marketing, "Affiliate marketing"),
        ("theHive", "TheHive", NodeCategory::Developer, "Security incident response"),
        ("theHiveProject", "TheHive Project", NodeCategory::Developer, "TheHive v5 platform"),
        ("timeSaved", "Time Saved", NodeCategory::Misc, "Manual time logging"),
        ("timescaleDb", "TimescaleDB", NodeCategory::Database, "Time-series Postgres"),
        ("todoist", "Todoist", NodeCategory::Productivity, "Task manager"),
        ("toggl", "Toggl", NodeCategory::Productivity, "Time tracking"),
        ("totp", "TOTP", NodeCategory::Developer, "Time-based one-time passwords"),
        ("transform", "Transform", NodeCategory::Transform, "Generic transform helpers"),
        ("travisCi", "Travis CI", NodeCategory::Developer, "CI builds"),
        ("trello", "Trello", NodeCategory::Productivity, "Kanban boards"),
        ("twake", "Twake", NodeCategory::Communication, "Open-source workplace"),
        ("twist", "Twist", NodeCategory::Communication, "Async team messaging"),
        ("twitter", "Twitter / X", NodeCategory::Marketing, "Twitter API"),
        ("typeform", "Typeform", NodeCategory::Productivity, "Online forms"),
        ("uProc", "uProc", NodeCategory::Developer, "Data processing toolset"),
        ("unleashedSoftware", "Unleashed Software", NodeCategory::Finance, "Inventory management"),
        ("uplead", "UpLead", NodeCategory::Sales, "B2B contact data"),
        ("uptimeRobot", "UptimeRobot", NodeCategory::Developer, "Site monitoring"),
        ("urlScanIo", "urlscan.io", NodeCategory::Developer, "Website scanner"),
        ("venafi", "Venafi", NodeCategory::Developer, "Machine identity"),
        ("vero", "Vero", NodeCategory::Marketing, "Customer messaging"),
        ("vonage", "Vonage", NodeCategory::Communication, "Voice and SMS"),
        ("webflow", "Webflow", NodeCategory::Developer, "Website builder API"),
        ("wekan", "Wekan", NodeCategory::Productivity, "Open-source Kanban"),
        ("whatsApp", "WhatsApp Business", NodeCategory::Communication, "WhatsApp Business API"),
        ("wise", "Wise", NodeCategory::Finance, "Cross-border payments"),
        ("wooCommerce", "WooCommerce", NodeCategory::Finance, "WordPress e-commerce"),
        ("wordpress", "WordPress", NodeCategory::Marketing, "WordPress CMS"),
        ("workable", "Workable", NodeCategory::Hr, "Recruiting software"),
        ("workflowTrigger", "Workflow Trigger", NodeCategory::Trigger, "Trigger from another workflow"),
        ("writeBinaryFile", "Write Binary File", NodeCategory::Files, "Write a file to disk"),
        ("wufoo", "Wufoo", NodeCategory::Productivity, "Online forms"),
        ("xero", "Xero", NodeCategory::Finance, "Accounting"),
        ("xml", "XML", NodeCategory::Transform, "Parse and build XML"),
        ("yourls", "YOURLS", NodeCategory::Marketing, "Self-hosted URL shortener"),
        ("zammad", "Zammad", NodeCategory::Communication, "Helpdesk"),
        ("zendesk", "Zendesk", NodeCategory::Communication, "Customer support"),
        ("zoho", "Zoho", NodeCategory::Crm, "Zoho CRM"),
        ("zoom", "Zoom", NodeCategory::Communication, "Video conferencing"),
        ("zulip", "Zulip", NodeCategory::Communication, "Topic-based team chat"),
    ];

    for (name, display, category, description) in stubs {
        if r.get(name).is_none() {
            r.register(stub::stub(name, display, description, *category));
        }
    }
}

#[cfg(test)]
mod aws_family_smoke_tests {
    //! C.5.1 smoke tests — verify the 6 AWS-family nodes are registered with
    //! non-stub descriptors and expose sensible operation options. We do NOT
    //! hit real AWS endpoints from tests (no credentials in CI).
    use super::*;
    use crate::registry::default_registry;

    fn assert_real_aws_node(name: &str) {
        let r = default_registry();
        let node = r
            .get(name)
            .unwrap_or_else(|| panic!("AWS node `{name}` should be registered"));
        let d = node.descriptor();
        assert_eq!(d.name, name);
        assert!(!d.stub, "{name} should not be a stub");
        assert!(
            d.credentials.iter().any(|c| c.name == "awsApi"),
            "{name} should require awsApi credential",
        );
        let has_operation = d.properties.iter().any(|p| p.name == "operation");
        assert!(has_operation, "{name} should expose an `operation` property");
    }

    #[test]
    fn aws_lambda_registered() {
        assert_real_aws_node("awsLambda");
    }

    #[test]
    fn aws_ses_registered() {
        assert_real_aws_node("awsSes");
    }

    #[test]
    fn aws_sns_registered() {
        assert_real_aws_node("awsSns");
    }

    #[test]
    fn aws_sqs_registered() {
        assert_real_aws_node("awsSqs");
    }

    #[test]
    fn aws_cloudwatch_registered() {
        assert_real_aws_node("awsCloudWatch");
    }

    #[test]
    fn aws_comprehend_registered() {
        assert_real_aws_node("awsComprehend");
    }

    /// Sanity: an unconfigured `awsApi` credential should produce
    /// `MissingCredential` rather than panicking. Uses the Lambda node as the
    /// representative case — all six share the same credential plumbing.
    #[tokio::test]
    async fn aws_lambda_missing_credential_is_an_error() {
        use std::sync::Arc;
        use crate::context::ExecutionContext;
        use crate::nodes::aws_lambda::AwsLambdaNode;
        use serde_json::json;

        let http = Arc::new(reqwest::Client::new());
        let mut ctx = ExecutionContext::new("test-exec".into(), http);
        let params = json!({
            "credentialId": "missing",
            "operation": "invoke",
            "functionName": "fn",
            "invocationType": "DryRun",
            "payload": {},
        });
        let res = AwsLambdaNode
            .execute(&mut ctx, crate::context::NodeInput::empty(), &params)
            .await;
        assert!(matches!(res, Err(crate::error::NodeError::MissingCredential(_))));
    }
}
