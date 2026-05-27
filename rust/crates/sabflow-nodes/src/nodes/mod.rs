// Generated new nodes
pub mod action_network;
pub mod acuity_scheduling;
pub mod adalo;
pub mod affinity;
pub mod agile_crm;
pub mod ai_transform;
pub mod airtop;
pub mod amqp;
pub mod autopilot;
pub mod aws;
pub mod bamboo_hr;
pub mod baserow;
pub mod beeminder;
pub mod bitbucket;
pub mod bitly;
pub mod bitwarden;
pub mod brandfetch;
pub mod bubble;
pub mod cal;
pub mod chargebee;
pub mod circle_ci;
pub mod cisco;
pub mod clockify;
pub mod cockpit;
pub mod coda;
pub mod cohere;
pub mod coin_gecko;
pub mod compare_datasets;
pub mod contentful;
pub mod copper;
pub mod cortex;
pub mod cron;
pub mod currents;
pub mod data_table;
pub mod databricks;
pub mod debug_helper;
pub mod deep_l;
pub mod demio;
pub mod dhl;
pub mod discourse;
pub mod disqus;
pub mod drift;
pub mod dropcontact;
pub mod dynamic_credential_check;
pub mod e2e_test;
pub mod edit_image;
pub mod egoi;
pub mod elasticsearch;
pub mod emelia;
pub mod erp_next;
pub mod error_trigger;
pub mod evaluation;
pub mod eventbrite;
pub mod execute_command;
pub mod execution_data;
pub mod facebook;
pub mod facebook_lead_ads;
pub mod figma;
pub mod file_maker;
pub mod files;
pub mod filter;
pub mod flow;
pub mod form;
pub mod form_io;
pub mod freshdesk;
pub mod freshservice;
pub mod freshworks_crm;
pub mod function_item;
pub mod ghost;
pub mod git;
pub mod go_to_webinar;
pub mod gong;
pub mod google;
pub mod gotify;
pub mod grafana;
pub mod graph_q_l;
pub mod grist;
pub mod gumroad;
pub mod hacker_news;
pub mod halo_psa;
pub mod harvest;
pub mod help_scout;
pub mod high_level;
pub mod home_assistant;
pub mod html_extract;
pub mod humantic_ai;
pub mod hunter;
pub mod i_calendar;
pub mod intercom;
pub mod interval;
pub mod invoice_ninja;
pub mod iterable;
pub mod jenkins;
pub mod jina_ai;
pub mod kafka;
pub mod keap;
pub mod ko_bo_toolbox;
pub mod kommo;
pub mod ldap;
pub mod lemlist;
pub mod lingva_nex;
pub mod linked_in;
pub mod lone_scale;
pub mod mailcheck;
pub mod mailgun;
pub mod mailjet;
pub mod mandrill;
pub mod markdown;
pub mod marketstack;
pub mod mautic;
pub mod medium;
pub mod microsoft;
pub mod mindee;
pub mod misp;
pub mod mistral_ai;
pub mod mocean;
pub mod monica_crm;
pub mod mqtt;
pub mod msg91;
pub mod n8n_api;
pub mod n8n_training_customer_datastore;
pub mod n8n_training_customer_messenger;
pub mod n8n_trigger;
pub mod nasa;
pub mod netlify;
pub mod netscaler;
pub mod npm;
pub mod odoo;
pub mod okta;
pub mod one_simple;
pub mod onfleet;
pub mod open_thesaurus;
pub mod open_weather_map;
pub mod orbit;
pub mod oura;
pub mod paddle;
pub mod pager_duty;
pub mod pay_pal;
pub mod peekalink;
pub mod perplexity;
pub mod phantombuster;
pub mod philips_hue;
pub mod pinecone;
pub mod plivo;
pub mod post_bin;
pub mod postmark;
pub mod profit_well;
pub mod pushbullet;
pub mod pushcut;
pub mod pushover;
pub mod qdrant;
pub mod quest_db;
pub mod quick_base;
pub mod quick_books;
pub mod rabbit_mq;
pub mod raindrop;
pub mod read_binary_files;
pub mod read_pdf;
pub mod reddit;
pub mod rename_keys;
pub mod rundeck;
pub mod salesmate;
pub mod schedule;
pub mod sea_table;
pub mod security_scorecard;
pub mod segment;
pub mod sendy;
pub mod sentry_io;
pub mod service_now;
pub mod signl4;
pub mod simulate;
pub mod sms77;
pub mod snowflake;
pub mod split_in_batches;
pub mod splunk;
pub mod spotify;
pub mod spreadsheet_file;
pub mod stackby;
pub mod sticky_note;
pub mod storyblok;
pub mod strapi;
pub mod strava;
pub mod survey_monkey;
pub mod syncro_msp;
pub mod taiga;
pub mod tapfiliate;
pub mod the_hive;
pub mod the_hive_project;
pub mod time_saved;
pub mod timescale_db;
pub mod todoist;
pub mod toggl;
pub mod totp;
pub mod transform;
pub mod travis_ci;
pub mod twake;
pub mod twitter;
pub mod u_proc;
pub mod unleashed_software;
pub mod uplead;
pub mod uptime_robot;
pub mod venafi;
pub mod vero;
pub mod webflow;
pub mod wekan;
pub mod whats_app;
pub mod wise;
pub mod wordpress;
pub mod workable;
pub mod workflow_trigger;
pub mod write_binary_file;
pub mod wufoo;
pub mod xero;
pub mod zammad;
pub mod zendesk;
pub mod zulip;

// All SabFlow nodes.
//
// Layout:
//   - One module per fully-implemented node (e.g. `http_request`, `slack`).
//   - Stubs for the remaining n8n-parity nodes are registered via
//     [`register_stubs`] using the shared [`stub::StubNode`].
//
// [`register_all`] is the single entry point used by the registry.
// Implemented nodes register first so stubs with the same name don't overwrite them.

pub mod stub;

// ── Fully-implemented core nodes ────────────────────────────────────────────
pub mod code;
pub mod code_node;
pub mod edit_fields;
pub mod execute_workflow_trigger;
pub mod function;
pub mod http_request;
pub mod if_node;
pub mod manual_trigger;
pub mod mattermost_trigger;
pub mod merge_node;
pub mod noop_node;
pub mod schedule_trigger;
pub mod set;
pub mod switch_node;
pub mod twilio_trigger;
pub mod twist_trigger;
pub mod wait;
pub mod webhook;
pub mod webhook_trigger;
pub mod logic;
pub mod delay;
pub mod action;
// ── Phase C.4.9: trigger variants ───────────────────────────────────────────
pub mod cron_trigger;
pub mod email_trigger;
pub mod form_trigger;
pub mod interval_trigger;
pub mod local_file_trigger;
pub mod mqtt_trigger;

// ── Commerce-webhook triggers (Phase C.6.4) ─────────────────────────────────
pub mod paypal_trigger;
pub mod shopify_trigger;
pub mod stripe_trigger;

// ── Phase C.6 — Webhook-style triggers ──────────────────────────────────────
pub mod calendly_trigger;
pub mod typeform_trigger;
pub mod zoom_trigger;

// ── Fully-implemented integration nodes ─────────────────────────────────────
pub mod airtable;
pub mod anthropic;
pub mod discord;
pub mod github;
pub mod gitlab;
pub mod gmail;
pub mod google_sheets;
pub mod hubspot;
pub mod mailchimp;
pub mod mongo_db;
pub mod notion;
pub mod openai;
pub mod postgres;
pub mod redis_node;
pub mod respond_to_webhook;
pub mod sendgrid;
pub mod slack;
pub mod slack_events_trigger;
pub mod slack_signature;
pub mod slack_slash_command;
pub mod slack_trigger;
pub mod stripe;
pub mod telegram;
pub mod twilio;

// ── Phase 7B: 50 additional implemented nodes ───────────────────────────────
pub mod active_campaign;
pub mod asana;
pub mod box_node;
pub mod brevo;
pub mod cal_com;
pub mod calendly;
pub mod click_up;
pub mod convert_kit;
pub mod convert_to_file;
pub mod convert_to_text;
pub mod crypto;
pub mod customer_io;
pub mod date_time;
pub mod dropbox;
pub mod email_read_imap;
pub mod email_send;
pub mod formstack;
pub mod ftp;
pub mod get_response;
pub mod graphql;
pub mod html;
pub mod jira;
pub mod jot_form;
pub mod jwt;
pub mod line;
pub mod linear;
pub mod magento;
pub mod mailer_lite;
pub mod matrix;
pub mod mattermost;
pub mod metabase;
pub mod monday_com;
pub mod my_sql;
pub mod next_cloud;
pub mod noco_db;
pub mod pipedrive;
pub mod post_hog;
pub mod rocketchat;
pub mod rss_feed_read;
pub mod s3;
pub mod salesforce;
pub mod segment_node;
pub mod shopify;
pub mod ssh;
pub mod supabase;
pub mod trello;
pub mod typeform;
pub mod whatsapp;
pub mod woo_commerce;
pub mod xml;
pub mod zoho;
pub mod zoom;

// ── Phase C.6.10 — generic webhook / listener triggers ──────────────────────
pub mod graphql_trigger;
pub mod sse_trigger;
pub mod webhook_v2;

use crate::{descriptor::NodeCategory, registry::NodeRegistry};

/// Register every node (real + stub) into the registry.
pub fn register_all(r: &mut NodeRegistry) {
    register_implemented(r);
    // register_stubs(r);
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
    r.register(twilio_trigger::TwilioTriggerNode);
    r.register(twist_trigger::TwistTriggerNode);
    r.register(mattermost_trigger::MattermostTriggerNode);
    r.register(noop_node::NoOpNode);
    r.register(logic::LogicNode);
    r.register(delay::DelayNode);
    r.register(action::ActionNode);
    // Commerce-webhook triggers (Phase C.6.4) — must register before stubs.
    r.register(stripe_trigger::StripeTriggerNode);
    r.register(shopify_trigger::ShopifyTriggerNode);
    r.register(paypal_trigger::PaypalTriggerNode);
    // Integrations (20)
    r.register(slack::SlackNode);
    r.register(slack_trigger::SlackTriggerNode);
    r.register(slack_slash_command::SlackSlashCommandTriggerNode);
    r.register(slack_events_trigger::SlackEventsApiTriggerNode);
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
    r.register(rocketchat::RocketchatNode);
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
    // Phase C.6.10 — generic webhook / listener triggers (3)
    r.register(webhook_v2::WebhookV2Node);
    r.register(sse_trigger::SseTriggerNode);
    r.register(graphql_trigger::GraphqlTriggerNode);
    // Newly implemented nodes
    r.register(action_network::ActionNetworkNode);
    r.register(acuity_scheduling::AcuitySchedulingNode);
    r.register(adalo::AdaloNode);
    r.register(affinity::AffinityNode);
    r.register(agile_crm::AgileCrmNode);
    r.register(ai_transform::AiTransformNode);
    r.register(airtop::AirtopNode);
    r.register(amqp::AmqpNode);
    r.register(autopilot::AutopilotNode);
    r.register(aws::AwsNode);
    r.register(bamboo_hr::BambooHrNode);
    r.register(baserow::BaserowNode);
    r.register(beeminder::BeeminderNode);
    r.register(bitbucket::BitbucketNode);
    r.register(bitly::BitlyNode);
    r.register(bitwarden::BitwardenNode);
    r.register(brandfetch::BrandfetchNode);
    r.register(bubble::BubbleNode);
    r.register(cal::CalNode);
    r.register(chargebee::ChargebeeNode);
    r.register(circle_ci::CircleCiNode);
    r.register(cisco::CiscoNode);
    r.register(clockify::ClockifyNode);
    r.register(cockpit::CockpitNode);
    r.register(coda::CodaNode);
    r.register(cohere::CohereNode);
    r.register(coin_gecko::CoinGeckoNode);
    r.register(compare_datasets::CompareDatasetsNode);
    r.register(contentful::ContentfulNode);
    r.register(copper::CopperNode);
    r.register(cortex::CortexNode);
    r.register(cron::CronNode);
    r.register(currents::CurrentsNode);
    r.register(data_table::DataTableNode);
    r.register(databricks::DatabricksNode);
    r.register(debug_helper::DebugHelperNode);
    r.register(deep_l::DeepLNode);
    r.register(demio::DemioNode);
    r.register(dhl::DhlNode);
    r.register(discourse::DiscourseNode);
    r.register(disqus::DisqusNode);
    r.register(drift::DriftNode);
    r.register(dropcontact::DropcontactNode);
    r.register(dynamic_credential_check::DynamicCredentialCheckNode);
    r.register(e2e_test::E2eTestNode);
    r.register(erp_next::ErpNextNode);
    r.register(edit_image::EditImageNode);
    r.register(egoi::EgoiNode);
    r.register(elasticsearch::ElasticsearchNode);
    r.register(emelia::EmeliaNode);
    r.register(error_trigger::ErrorTriggerNode);
    r.register(evaluation::EvaluationNode);
    r.register(eventbrite::EventbriteNode);
    r.register(execute_command::ExecuteCommandNode);
    r.register(execution_data::ExecutionDataNode);
    r.register(facebook::FacebookNode);
    r.register(facebook_lead_ads::FacebookLeadAdsNode);
    r.register(figma::FigmaNode);
    r.register(file_maker::FileMakerNode);
    r.register(files::FilesNode);
    r.register(filter::FilterNode);
    r.register(flow::FlowNode);
    r.register(form::FormNode);
    r.register(form_io::FormIoNode);
    r.register(freshdesk::FreshdeskNode);
    r.register(freshservice::FreshserviceNode);
    r.register(freshworks_crm::FreshworksCrmNode);
    r.register(function_item::FunctionItemNode);
    r.register(ghost::GhostNode);
    r.register(git::GitNode);
    r.register(go_to_webinar::GoToWebinarNode);
    r.register(gong::GongNode);
    r.register(google::GoogleNode);
    r.register(gotify::GotifyNode);
    r.register(grafana::GrafanaNode);
    r.register(graph_q_l::GraphQLNode);
    r.register(grist::GristNode);
    r.register(gumroad::GumroadNode);
    r.register(hacker_news::HackerNewsNode);
    r.register(halo_psa::HaloPsaNode);
    r.register(harvest::HarvestNode);
    r.register(help_scout::HelpScoutNode);
    r.register(high_level::HighLevelNode);
    r.register(home_assistant::HomeAssistantNode);
    r.register(html_extract::HtmlExtractNode);
    r.register(humantic_ai::HumanticAiNode);
    r.register(hunter::HunterNode);
    r.register(i_calendar::ICalendarNode);
    r.register(intercom::IntercomNode);
    r.register(interval::IntervalNode);
    r.register(invoice_ninja::InvoiceNinjaNode);
    r.register(iterable::IterableNode);
    r.register(jenkins::JenkinsNode);
    r.register(jina_ai::JinaAiNode);
    r.register(kafka::KafkaNode);
    r.register(keap::KeapNode);
    r.register(ko_bo_toolbox::KoBoToolboxNode);
    r.register(kommo::KommoNode);
    r.register(ldap::LdapNode);
    r.register(lemlist::LemlistNode);
    r.register(lingva_nex::LingvaNexNode);
    r.register(linked_in::LinkedInNode);
    r.register(lone_scale::LoneScaleNode);
    r.register(mqtt::MqttNode);
    r.register(mailcheck::MailcheckNode);
    r.register(mailgun::MailgunNode);
    r.register(mailjet::MailjetNode);
    r.register(mandrill::MandrillNode);
    r.register(markdown::MarkdownNode);
    r.register(marketstack::MarketstackNode);
    r.register(mautic::MauticNode);
    r.register(medium::MediumNode);
    r.register(microsoft::MicrosoftNode);
    r.register(mindee::MindeeNode);
    r.register(misp::MispNode);
    r.register(mistral_ai::MistralAiNode);
    r.register(mocean::MoceanNode);
    r.register(monica_crm::MonicaCrmNode);
    r.register(msg91::Msg91Node);
    r.register(n8n_api::N8nNode);
    r.register(n8n_training_customer_datastore::N8nTrainingCustomerDatastoreNode);
    r.register(n8n_training_customer_messenger::N8nTrainingCustomerMessengerNode);
    r.register(n8n_trigger::N8nTriggerNode);
    r.register(nasa::NasaNode);
    r.register(netlify::NetlifyNode);
    r.register(netscaler::NetscalerNode);
    r.register(npm::NpmNode);
    r.register(odoo::OdooNode);
    r.register(okta::OktaNode);
    r.register(one_simple::OneSimpleApiNode);
    r.register(onfleet::OnfleetNode);
    r.register(open_thesaurus::OpenThesaurusNode);
    r.register(open_weather_map::OpenWeatherMapNode);
    r.register(orbit::OrbitNode);
    r.register(oura::OuraNode);
    r.register(paddle::PaddleNode);
    r.register(pager_duty::PagerDutyNode);
    r.register(pay_pal::PayPalNode);
    r.register(peekalink::PeekalinkNode);
    r.register(perplexity::PerplexityNode);
    r.register(phantombuster::PhantombusterNode);
    r.register(philips_hue::PhilipsHueNode);
    r.register(pinecone::PineconeNode);
    r.register(plivo::PlivoNode);
    r.register(post_bin::PostBinNode);
    r.register(postmark::PostmarkNode);
    r.register(profit_well::ProfitWellNode);
    r.register(pushbullet::PushbulletNode);
    r.register(pushcut::PushcutNode);
    r.register(pushover::PushoverNode);
    r.register(qdrant::QdrantNode);
    r.register(quest_db::QuestDbNode);
    r.register(quick_base::QuickBaseNode);
    r.register(quick_books::QuickBooksNode);
    r.register(rabbit_mq::RabbitMqNode);
    r.register(raindrop::RaindropNode);
    r.register(read_binary_files::ReadBinaryFilesNode);
    r.register(read_pdf::ReadPdfNode);
    r.register(reddit::RedditNode);
    r.register(rename_keys::RenameKeysNode);
    r.register(rundeck::RundeckNode);
    r.register(salesmate::SalesmateNode);
    r.register(schedule::ScheduleNode);
    r.register(sea_table::SeaTableNode);
    r.register(security_scorecard::SecurityScorecardNode);
    r.register(segment::SegmentNode);
    r.register(sendy::SendyNode);
    r.register(sentry_io::SentryIoNode);
    r.register(service_now::ServiceNowNode);
    r.register(signl4::Signl4Node);
    r.register(simulate::SimulateNode);
    r.register(sms77::Sms77Node);
    r.register(snowflake::SnowflakeNode);
    r.register(split_in_batches::SplitInBatchesNode);
    r.register(splunk::SplunkNode);
    r.register(spotify::SpotifyNode);
    r.register(spreadsheet_file::SpreadsheetFileNode);
    r.register(stackby::StackbyNode);
    r.register(sticky_note::StickyNoteNode);
    r.register(storyblok::StoryblokNode);
    r.register(strapi::StrapiNode);
    r.register(strava::StravaNode);
    r.register(survey_monkey::SurveyMonkeyNode);
    r.register(syncro_msp::SyncroMspNode);
    r.register(taiga::TaigaNode);
    r.register(tapfiliate::TapfiliateNode);
    r.register(the_hive::TheHiveNode);
    r.register(the_hive_project::TheHiveProjectNode);
    r.register(time_saved::TimeSavedNode);
    r.register(timescale_db::TimescaleDbNode);
    r.register(todoist::TodoistNode);
    r.register(toggl::TogglNode);
    r.register(totp::TotpNode);
    r.register(transform::TransformNode);
    r.register(travis_ci::TravisCiNode);
    r.register(twake::TwakeNode);
    r.register(twitter::TwitterNode);
    r.register(u_proc::UProcNode);
    r.register(unleashed_software::UnleashedSoftwareNode);
    r.register(uplead::UpleadNode);
    r.register(uptime_robot::UptimeRobotNode);
    r.register(venafi::VenafiNode);
    r.register(vero::VeroNode);
    r.register(webflow::WebflowNode);
    r.register(wekan::WekanNode);
    r.register(whats_app::WhatsAppNode);
    r.register(wise::WiseNode);
    r.register(wordpress::WordpressNode);
    r.register(workable::WorkableNode);
    r.register(workflow_trigger::WorkflowTriggerNode);
    r.register(write_binary_file::WriteBinaryFileNode);
    r.register(wufoo::WufooNode);
    r.register(xero::XeroNode);
    r.register(zammad::ZammadNode);
    r.register(zendesk::ZendeskNode);
    r.register(zulip::ZulipNode);
}

/// Register stubs only when the name isn't already populated by an implemented node.
#[allow(dead_code)]
fn register_stubs(r: &mut NodeRegistry) {
    let stubs: &[(&str, &str, NodeCategory, &str)] = &[
        // (name, displayName, category, description)
        (
            "actionNetwork",
            "Action Network",
            NodeCategory::Crm,
            "Action Network operations",
        ),
        (
            "activeCampaign",
            "ActiveCampaign",
            NodeCategory::Marketing,
            "Marketing automation and CRM",
        ),
        (
            "acuityScheduling",
            "Acuity Scheduling",
            NodeCategory::Productivity,
            "Online appointment scheduling",
        ),
        (
            "adalo",
            "Adalo",
            NodeCategory::Developer,
            "Adalo app data operations",
        ),
        (
            "affinity",
            "Affinity",
            NodeCategory::Crm,
            "Relationship intelligence CRM",
        ),
        (
            "agileCrm",
            "Agile CRM",
            NodeCategory::Crm,
            "Customer relationship management",
        ),
        (
            "aiTransform",
            "AI Transform",
            NodeCategory::Ai,
            "Transform data with AI",
        ),
        (
            "airtop",
            "Airtop",
            NodeCategory::Ai,
            "Browser automation for AI agents",
        ),
        (
            "amqp",
            "AMQP",
            NodeCategory::Developer,
            "AMQP message queue",
        ),
        (
            "asana",
            "Asana",
            NodeCategory::Productivity,
            "Project and task management",
        ),
        (
            "autopilot",
            "Autopilot",
            NodeCategory::Marketing,
            "Marketing automation",
        ),
        ("aws", "AWS", NodeCategory::Storage, "Amazon Web Services"),
        ("bambooHr", "BambooHR", NodeCategory::Hr, "HR management"),
        (
            "baserow",
            "Baserow",
            NodeCategory::Database,
            "Open-source no-code database",
        ),
        (
            "beeminder",
            "Beeminder",
            NodeCategory::Productivity,
            "Goal tracking",
        ),
        (
            "bitbucket",
            "Bitbucket",
            NodeCategory::Developer,
            "Git hosting and code review",
        ),
        ("bitly", "Bitly", NodeCategory::Marketing, "URL shortener"),
        (
            "bitwarden",
            "Bitwarden",
            NodeCategory::Developer,
            "Password manager",
        ),
        (
            "box",
            "Box",
            NodeCategory::Storage,
            "Cloud content management",
        ),
        (
            "brandfetch",
            "Brandfetch",
            NodeCategory::Marketing,
            "Brand asset lookup",
        ),
        (
            "brevo",
            "Brevo",
            NodeCategory::Marketing,
            "Email and SMS marketing",
        ),
        (
            "bubble",
            "Bubble",
            NodeCategory::Developer,
            "No-code app data",
        ),
        (
            "cal",
            "Cal.com",
            NodeCategory::Productivity,
            "Open-source scheduling",
        ),
        (
            "calendly",
            "Calendly",
            NodeCategory::Productivity,
            "Meeting scheduling",
        ),
        (
            "chargebee",
            "Chargebee",
            NodeCategory::Finance,
            "Subscription billing",
        ),
        (
            "circleCi",
            "CircleCI",
            NodeCategory::Developer,
            "Continuous integration",
        ),
        (
            "cisco",
            "Cisco",
            NodeCategory::Developer,
            "Cisco Webex meetings",
        ),
        (
            "clickUp",
            "ClickUp",
            NodeCategory::Productivity,
            "Project management",
        ),
        (
            "clockify",
            "Clockify",
            NodeCategory::Productivity,
            "Time tracking",
        ),
        (
            "cockpit",
            "Cockpit",
            NodeCategory::Developer,
            "Headless CMS",
        ),
        ("coda", "Coda", NodeCategory::Productivity, "All-in-one doc"),
        (
            "cohere",
            "Cohere",
            NodeCategory::Ai,
            "Cohere chat, embeddings, and reranking",
        ),
        (
            "coinGecko",
            "CoinGecko",
            NodeCategory::Finance,
            "Cryptocurrency price data",
        ),
        (
            "compareDatasets",
            "Compare Datasets",
            NodeCategory::Transform,
            "Diff two datasets",
        ),
        (
            "contentful",
            "Contentful",
            NodeCategory::Developer,
            "Headless CMS",
        ),
        (
            "convertKit",
            "ConvertKit",
            NodeCategory::Marketing,
            "Email marketing for creators",
        ),
        (
            "convertToFile",
            "Convert to File",
            NodeCategory::Transform,
            "Convert items into a binary file (CSV/JSON/TSV/XML/HTML/iCal/RTF)",
        ),
        (
            "convertToText",
            "Convert to Text",
            NodeCategory::Transform,
            "Parse a binary file back into items",
        ),
        (
            "copper",
            "Copper",
            NodeCategory::Crm,
            "CRM built for Google Workspace",
        ),
        (
            "cortex",
            "Cortex",
            NodeCategory::Developer,
            "Threat intelligence analysis",
        ),
        (
            "cron",
            "Cron",
            NodeCategory::Logic,
            "Schedule by cron expression",
        ),
        (
            "crypto",
            "Crypto",
            NodeCategory::Transform,
            "Cryptographic operations",
        ),
        ("currents", "Currents", NodeCategory::Analytics, "News API"),
        (
            "customerIo",
            "Customer.io",
            NodeCategory::Marketing,
            "Behavioural email",
        ),
        (
            "dataTable",
            "Data Table",
            NodeCategory::Transform,
            "Tabular data operations",
        ),
        (
            "databricks",
            "Databricks",
            NodeCategory::Analytics,
            "Lakehouse platform",
        ),
        (
            "debugHelper",
            "Debug Helper",
            NodeCategory::Developer,
            "Generate test data",
        ),
        ("deepL", "DeepL", NodeCategory::Ai, "Translation API"),
        ("demio", "Demio", NodeCategory::Marketing, "Webinars"),
        ("dhl", "DHL", NodeCategory::Misc, "Shipping tracking"),
        (
            "discourse",
            "Discourse",
            NodeCategory::Communication,
            "Forum platform",
        ),
        (
            "disqus",
            "Disqus",
            NodeCategory::Communication,
            "Comment platform",
        ),
        (
            "drift",
            "Drift",
            NodeCategory::Marketing,
            "Conversational marketing",
        ),
        (
            "dropbox",
            "Dropbox",
            NodeCategory::Storage,
            "Cloud file storage",
        ),
        (
            "dropcontact",
            "Dropcontact",
            NodeCategory::Crm,
            "Email enrichment",
        ),
        (
            "dynamicCredentialCheck",
            "Dynamic Credential Check",
            NodeCategory::Developer,
            "Test credentials",
        ),
        (
            "e2eTest",
            "E2E Test",
            NodeCategory::Developer,
            "End-to-end test helper",
        ),
        (
            "erpNext",
            "ERPNext",
            NodeCategory::Finance,
            "Open-source ERP",
        ),
        (
            "editImage",
            "Edit Image",
            NodeCategory::Files,
            "Image manipulation",
        ),
        (
            "egoi",
            "E-goi",
            NodeCategory::Marketing,
            "Multi-channel marketing",
        ),
        // `elastic` → replaced by the fully-implemented `elasticsearch` node (Phase C.4.3).
        (
            "elasticsearch",
            "Elasticsearch",
            NodeCategory::Database,
            "Search engine — REST API search/index/get/update/delete/count",
        ),
        (
            "emailReadImap",
            "Email Read (IMAP)",
            NodeCategory::Communication,
            "Read emails via IMAP",
        ),
        (
            "emailSend",
            "Send Email",
            NodeCategory::Communication,
            "Send via SMTP",
        ),
        (
            "emelia",
            "Emelia",
            NodeCategory::Marketing,
            "Cold email outreach",
        ),
        (
            "errorTrigger",
            "Error Trigger",
            NodeCategory::Trigger,
            "Triggers on workflow errors",
        ),
        (
            "evaluation",
            "Evaluation",
            NodeCategory::Ai,
            "Evaluate AI outputs",
        ),
        (
            "eventbrite",
            "Eventbrite",
            NodeCategory::Productivity,
            "Event ticketing",
        ),
        (
            "executeCommand",
            "Execute Command",
            NodeCategory::Developer,
            "Run a shell command",
        ),
        // `executeWorkflow` is fully implemented — see `execute_workflow::ExecuteWorkflowNode`.
        (
            "executionData",
            "Execution Data",
            NodeCategory::Developer,
            "Read execution metadata",
        ),
        (
            "facebook",
            "Facebook",
            NodeCategory::Marketing,
            "Facebook Graph API",
        ),
        (
            "facebookLeadAds",
            "Facebook Lead Ads",
            NodeCategory::Marketing,
            "Lead form submissions",
        ),
        ("figma", "Figma", NodeCategory::Productivity, "Design files"),
        (
            "fileMaker",
            "FileMaker",
            NodeCategory::Database,
            "FileMaker DB",
        ),
        (
            "files",
            "Files",
            NodeCategory::Files,
            "Local file system operations",
        ),
        (
            "filter",
            "Filter",
            NodeCategory::Transform,
            "Filter items by condition",
        ),
        (
            "flow",
            "Flow",
            NodeCategory::Productivity,
            "Flow.io project management",
        ),
        (
            "form",
            "Form",
            NodeCategory::Trigger,
            "Built-in form trigger",
        ),
        (
            "formIo",
            "Form.io",
            NodeCategory::Productivity,
            "Form builder",
        ),
        (
            "formstack",
            "Formstack",
            NodeCategory::Productivity,
            "Online forms",
        ),
        (
            "freshdesk",
            "Freshdesk",
            NodeCategory::Communication,
            "Customer support",
        ),
        (
            "freshservice",
            "Freshservice",
            NodeCategory::Communication,
            "IT service management",
        ),
        (
            "freshworksCrm",
            "Freshworks CRM",
            NodeCategory::Crm,
            "Freshworks CRM",
        ),
        (
            "ftp",
            "FTP",
            NodeCategory::Storage,
            "Transfer files via FTP/SFTP",
        ),
        // ("function", ...) promoted to a real implementation in Phase C.3.2 — see nodes/function.rs.
        (
            "functionItem",
            "Function Item (legacy)",
            NodeCategory::Logic,
            "Legacy per-item code",
        ),
        (
            "getResponse",
            "GetResponse",
            NodeCategory::Marketing,
            "Email marketing",
        ),
        (
            "ghost",
            "Ghost",
            NodeCategory::Marketing,
            "Publishing platform",
        ),
        ("git", "Git", NodeCategory::Developer, "Run git commands"),
        (
            "goToWebinar",
            "GoToWebinar",
            NodeCategory::Marketing,
            "Webinars",
        ),
        ("gong", "Gong", NodeCategory::Sales, "Revenue intelligence"),
        (
            "google",
            "Google",
            NodeCategory::Productivity,
            "Google Workspace operations",
        ),
        (
            "gotify",
            "Gotify",
            NodeCategory::Communication,
            "Self-hosted push notifications",
        ),
        (
            "grafana",
            "Grafana",
            NodeCategory::Analytics,
            "Observability dashboards",
        ),
        (
            "graphQL",
            "GraphQL",
            NodeCategory::Developer,
            "Send GraphQL queries",
        ),
        (
            "grist",
            "Grist",
            NodeCategory::Database,
            "Spreadsheet-database hybrid",
        ),
        (
            "gumroad",
            "Gumroad",
            NodeCategory::Finance,
            "Digital product sales",
        ),
        (
            "hackerNews",
            "Hacker News",
            NodeCategory::Analytics,
            "HN API",
        ),
        (
            "haloPsa",
            "HaloPSA",
            NodeCategory::Communication,
            "Service management",
        ),
        (
            "harvest",
            "Harvest",
            NodeCategory::Finance,
            "Time tracking and invoicing",
        ),
        (
            "helpScout",
            "Help Scout",
            NodeCategory::Communication,
            "Customer support",
        ),
        (
            "highLevel",
            "HighLevel",
            NodeCategory::Crm,
            "All-in-one marketing",
        ),
        (
            "homeAssistant",
            "Home Assistant",
            NodeCategory::Misc,
            "Home automation",
        ),
        ("html", "HTML", NodeCategory::Transform, "HTML manipulation"),
        (
            "htmlExtract",
            "HTML Extract",
            NodeCategory::Transform,
            "Extract content from HTML",
        ),
        (
            "humanticAi",
            "HumanticAI",
            NodeCategory::Ai,
            "Personality AI",
        ),
        (
            "hunter",
            "Hunter",
            NodeCategory::Marketing,
            "Email finder and verifier",
        ),
        (
            "iCalendar",
            "iCalendar",
            NodeCategory::Productivity,
            "Generate iCal events",
        ),
        (
            "intercom",
            "Intercom",
            NodeCategory::Communication,
            "Customer messaging",
        ),
        (
            "interval",
            "Interval",
            NodeCategory::Trigger,
            "Fire at fixed intervals",
        ),
        (
            "invoiceNinja",
            "Invoice Ninja",
            NodeCategory::Finance,
            "Invoicing and billing",
        ),
        (
            "iterable",
            "Iterable",
            NodeCategory::Marketing,
            "Cross-channel marketing",
        ),
        ("jenkins", "Jenkins", NodeCategory::Developer, "CI/CD jobs"),
        (
            "jinaAi",
            "Jina AI",
            NodeCategory::Ai,
            "Embeddings and reranking",
        ),
        ("jira", "Jira", NodeCategory::Developer, "Issue tracking"),
        (
            "jotForm",
            "JotForm",
            NodeCategory::Productivity,
            "Online form builder",
        ),
        (
            "jwt",
            "JWT",
            NodeCategory::Developer,
            "Sign and verify JWTs",
        ),
        (
            "kafka",
            "Kafka",
            NodeCategory::Developer,
            "Apache Kafka producer/consumer",
        ),
        ("keap", "Keap", NodeCategory::Crm, "Small-business CRM"),
        (
            "koBoToolbox",
            "KoBoToolbox",
            NodeCategory::Productivity,
            "Data collection forms",
        ),
        (
            "kommo",
            "Kommo",
            NodeCategory::Crm,
            "Kommo (amoCRM) sales CRM",
        ),
        (
            "ldap",
            "LDAP",
            NodeCategory::Developer,
            "Directory operations",
        ),
        (
            "lemlist",
            "Lemlist",
            NodeCategory::Marketing,
            "Cold email outreach",
        ),
        (
            "line",
            "LINE",
            NodeCategory::Communication,
            "LINE messaging",
        ),
        (
            "linear",
            "Linear",
            NodeCategory::Developer,
            "Issue tracking for software teams",
        ),
        ("lingvaNex", "LingvaNex", NodeCategory::Ai, "Translation"),
        (
            "linkedIn",
            "LinkedIn",
            NodeCategory::Marketing,
            "LinkedIn social posting",
        ),
        (
            "localFileTrigger",
            "Local File Trigger",
            NodeCategory::Trigger,
            "Watch local file system",
        ),
        (
            "loneScale",
            "LoneScale",
            NodeCategory::Sales,
            "Sales intent data",
        ),
        ("mqtt", "MQTT", NodeCategory::Developer, "MQTT messaging"),
        (
            "magento",
            "Magento",
            NodeCategory::Finance,
            "E-commerce platform",
        ),
        (
            "mailcheck",
            "Mailcheck",
            NodeCategory::Developer,
            "Validate email addresses",
        ),
        (
            "mailerLite",
            "MailerLite",
            NodeCategory::Marketing,
            "Email marketing",
        ),
        (
            "mailgun",
            "Mailgun",
            NodeCategory::Communication,
            "Email API",
        ),
        (
            "mailjet",
            "Mailjet",
            NodeCategory::Communication,
            "Email service",
        ),
        (
            "mandrill",
            "Mandrill",
            NodeCategory::Communication,
            "Transactional email",
        ),
        (
            "markdown",
            "Markdown",
            NodeCategory::Transform,
            "Markdown <-> HTML conversion",
        ),
        (
            "marketstack",
            "marketstack",
            NodeCategory::Finance,
            "Stock market data",
        ),
        (
            "matrix",
            "Matrix",
            NodeCategory::Communication,
            "Decentralised chat",
        ),
        (
            "mattermost",
            "Mattermost",
            NodeCategory::Communication,
            "Team chat",
        ),
        (
            "mautic",
            "Mautic",
            NodeCategory::Marketing,
            "Marketing automation",
        ),
        (
            "medium",
            "Medium",
            NodeCategory::Marketing,
            "Publishing platform",
        ),
        (
            "metabase",
            "Metabase",
            NodeCategory::Analytics,
            "Business intelligence",
        ),
        (
            "microsoft",
            "Microsoft",
            NodeCategory::Productivity,
            "Microsoft 365 services",
        ),
        ("mindee", "Mindee", NodeCategory::Ai, "Document OCR"),
        (
            "misp",
            "MISP",
            NodeCategory::Developer,
            "Threat intelligence platform",
        ),
        (
            "mistralAi",
            "Mistral AI",
            NodeCategory::Ai,
            "Mistral language models",
        ),
        (
            "mocean",
            "Mocean",
            NodeCategory::Communication,
            "SMS messaging",
        ),
        (
            "mondayCom",
            "monday.com",
            NodeCategory::Productivity,
            "Work OS",
        ),
        ("monicaCrm", "Monica CRM", NodeCategory::Crm, "Personal CRM"),
        ("msg91", "MSG91", NodeCategory::Communication, "SMS gateway"),
        ("mySql", "MySQL", NodeCategory::Database, "MySQL operations"),
        (
            "n8n",
            "n8n API",
            NodeCategory::Developer,
            "Manage n8n itself",
        ),
        (
            "n8nTrainingCustomerDatastore",
            "n8n Training: Customer Data",
            NodeCategory::Developer,
            "Training-only mock node",
        ),
        (
            "n8nTrainingCustomerMessenger",
            "n8n Training: Customer Messenger",
            NodeCategory::Developer,
            "Training-only mock node",
        ),
        (
            "n8nTrigger",
            "n8n Trigger",
            NodeCategory::Trigger,
            "n8n lifecycle events",
        ),
        ("nasa", "NASA", NodeCategory::Misc, "NASA Open APIs"),
        (
            "netlify",
            "Netlify",
            NodeCategory::Developer,
            "Netlify hosting",
        ),
        (
            "netscaler",
            "Netscaler",
            NodeCategory::Developer,
            "Citrix Netscaler ops",
        ),
        (
            "nextCloud",
            "NextCloud",
            NodeCategory::Storage,
            "Self-hosted cloud storage",
        ),
        (
            "nocoDb",
            "NocoDB",
            NodeCategory::Database,
            "No-code database",
        ),
        (
            "npm",
            "npm",
            NodeCategory::Developer,
            "npm package operations",
        ),
        ("odoo", "Odoo", NodeCategory::Finance, "Open ERP"),
        (
            "okta",
            "Okta",
            NodeCategory::Developer,
            "Identity management",
        ),
        (
            "oneSimpleApi",
            "One Simple API",
            NodeCategory::Developer,
            "Multi-purpose API",
        ),
        (
            "onfleet",
            "Onfleet",
            NodeCategory::Misc,
            "Last-mile delivery",
        ),
        (
            "openThesaurus",
            "OpenThesaurus",
            NodeCategory::Ai,
            "German thesaurus",
        ),
        (
            "openWeatherMap",
            "OpenWeatherMap",
            NodeCategory::Misc,
            "Weather data",
        ),
        (
            "orbit",
            "Orbit",
            NodeCategory::Marketing,
            "Community management",
        ),
        ("oura", "Oura", NodeCategory::Misc, "Health tracking ring"),
        (
            "paddle",
            "Paddle",
            NodeCategory::Finance,
            "Subscription billing",
        ),
        (
            "pagerDuty",
            "PagerDuty",
            NodeCategory::Communication,
            "On-call incident response",
        ),
        ("payPal", "PayPal", NodeCategory::Finance, "Payments"),
        (
            "peekalink",
            "Peekalink",
            NodeCategory::Misc,
            "URL preview generator",
        ),
        (
            "perplexity",
            "Perplexity",
            NodeCategory::Ai,
            "Perplexity AI search",
        ),
        (
            "phantombuster",
            "Phantombuster",
            NodeCategory::Marketing,
            "Automated outreach",
        ),
        (
            "philipsHue",
            "Philips Hue",
            NodeCategory::Misc,
            "Smart lighting",
        ),
        (
            "pinecone",
            "Pinecone",
            NodeCategory::Database,
            "Pinecone vector database",
        ),
        ("pipedrive", "Pipedrive", NodeCategory::Sales, "Sales CRM"),
        ("plivo", "Plivo", NodeCategory::Communication, "SMS / voice"),
        (
            "postBin",
            "PostBin",
            NodeCategory::Developer,
            "HTTP request bin",
        ),
        (
            "postHog",
            "PostHog",
            NodeCategory::Analytics,
            "Product analytics",
        ),
        (
            "postmark",
            "Postmark",
            NodeCategory::Communication,
            "Transactional email",
        ),
        (
            "profitWell",
            "ProfitWell",
            NodeCategory::Finance,
            "SaaS metrics",
        ),
        (
            "pushbullet",
            "Pushbullet",
            NodeCategory::Communication,
            "Cross-device notifications",
        ),
        (
            "pushcut",
            "Pushcut",
            NodeCategory::Communication,
            "iOS automation",
        ),
        (
            "pushover",
            "Pushover",
            NodeCategory::Communication,
            "Push notifications",
        ),
        (
            "qdrant",
            "Qdrant",
            NodeCategory::Database,
            "Qdrant vector database",
        ),
        (
            "questDb",
            "QuestDB",
            NodeCategory::Database,
            "Time-series database",
        ),
        (
            "quickBase",
            "QuickBase",
            NodeCategory::Database,
            "Low-code application database",
        ),
        (
            "quickBooks",
            "QuickBooks",
            NodeCategory::Finance,
            "Accounting",
        ),
        (
            "rabbitMq",
            "RabbitMQ",
            NodeCategory::Developer,
            "AMQP message broker",
        ),
        (
            "raindrop",
            "Raindrop",
            NodeCategory::Productivity,
            "Bookmark manager",
        ),
        (
            "readBinaryFiles",
            "Read Binary Files",
            NodeCategory::Files,
            "Read multiple files",
        ),
        (
            "readPdf",
            "Read PDF",
            NodeCategory::Files,
            "Extract text from PDF",
        ),
        (
            "reddit",
            "Reddit",
            NodeCategory::Communication,
            "Reddit API",
        ),
        (
            "renameKeys",
            "Rename Keys",
            NodeCategory::Transform,
            "Rename object keys",
        ),
        (
            "rocketchat",
            "Rocket.Chat",
            NodeCategory::Communication,
            "Self-hosted team chat",
        ),
        (
            "rssFeedRead",
            "RSS Feed Read",
            NodeCategory::Communication,
            "Read RSS feeds",
        ),
        (
            "rundeck",
            "Rundeck",
            NodeCategory::Developer,
            "Job scheduler",
        ),
        (
            "s3",
            "S3",
            NodeCategory::Storage,
            "S3-compatible object storage",
        ),
        (
            "salesforce",
            "Salesforce",
            NodeCategory::Crm,
            "Salesforce CRM",
        ),
        ("salesmate", "Salesmate", NodeCategory::Sales, "Sales CRM"),
        (
            "schedule",
            "Schedule",
            NodeCategory::Trigger,
            "Schedule trigger by interval or cron",
        ),
        (
            "seaTable",
            "SeaTable",
            NodeCategory::Database,
            "Real-time collaborative database",
        ),
        (
            "securityScorecard",
            "SecurityScorecard",
            NodeCategory::Developer,
            "Security ratings",
        ),
        (
            "segment",
            "Segment",
            NodeCategory::Analytics,
            "Customer data platform",
        ),
        (
            "sendy",
            "Sendy",
            NodeCategory::Marketing,
            "Self-hosted email marketing",
        ),
        (
            "sentryIo",
            "Sentry.io",
            NodeCategory::Developer,
            "Error monitoring",
        ),
        (
            "serviceNow",
            "ServiceNow",
            NodeCategory::Communication,
            "IT service management",
        ),
        (
            "shopify",
            "Shopify",
            NodeCategory::Finance,
            "E-commerce platform",
        ),
        (
            "signl4",
            "Signl4",
            NodeCategory::Communication,
            "Mobile alerting",
        ),
        (
            "simulate",
            "Simulate",
            NodeCategory::Developer,
            "Simulate node output",
        ),
        (
            "sms77",
            "sms77",
            NodeCategory::Communication,
            "SMS messaging",
        ),
        (
            "snowflake",
            "Snowflake",
            NodeCategory::Database,
            "Cloud data warehouse",
        ),
        (
            "splitInBatches",
            "Split In Batches",
            NodeCategory::Logic,
            "Loop over items in batches",
        ),
        (
            "splunk",
            "Splunk",
            NodeCategory::Analytics,
            "Operational intelligence",
        ),
        (
            "spotify",
            "Spotify",
            NodeCategory::Misc,
            "Music streaming API",
        ),
        (
            "spreadsheetFile",
            "Spreadsheet File",
            NodeCategory::Files,
            "Read/write CSV, XLS, ODS",
        ),
        (
            "sseTrigger",
            "SSE Trigger",
            NodeCategory::Trigger,
            "Server-Sent Events trigger",
        ),
        (
            "ssh",
            "SSH",
            NodeCategory::Developer,
            "Execute SSH commands",
        ),
        (
            "stackby",
            "Stackby",
            NodeCategory::Database,
            "Spreadsheet-style database",
        ),
        (
            "stickyNote",
            "Sticky Note",
            NodeCategory::Misc,
            "Canvas annotation",
        ),
        // `stopAndError` is fully implemented — see `stop_and_error::StopAndErrorNode`.
        (
            "storyblok",
            "Storyblok",
            NodeCategory::Developer,
            "Headless CMS",
        ),
        ("strapi", "Strapi", NodeCategory::Developer, "Headless CMS"),
        (
            "strava",
            "Strava",
            NodeCategory::Misc,
            "Athletic activity tracking",
        ),
        (
            "supabase",
            "Supabase",
            NodeCategory::Database,
            "Open-source Firebase alternative",
        ),
        (
            "surveyMonkey",
            "SurveyMonkey",
            NodeCategory::Productivity,
            "Surveys",
        ),
        (
            "syncroMsp",
            "SyncroMSP",
            NodeCategory::Communication,
            "MSP management",
        ),
        (
            "taiga",
            "Taiga",
            NodeCategory::Developer,
            "Project management",
        ),
        (
            "tapfiliate",
            "Tapfiliate",
            NodeCategory::Marketing,
            "Affiliate marketing",
        ),
        (
            "theHive",
            "TheHive",
            NodeCategory::Developer,
            "Security incident response",
        ),
        (
            "theHiveProject",
            "TheHive Project",
            NodeCategory::Developer,
            "TheHive v5 platform",
        ),
        (
            "timeSaved",
            "Time Saved",
            NodeCategory::Misc,
            "Manual time logging",
        ),
        (
            "timescaleDb",
            "TimescaleDB",
            NodeCategory::Database,
            "Time-series Postgres",
        ),
        (
            "todoist",
            "Todoist",
            NodeCategory::Productivity,
            "Task manager",
        ),
        (
            "toggl",
            "Toggl",
            NodeCategory::Productivity,
            "Time tracking",
        ),
        (
            "totp",
            "TOTP",
            NodeCategory::Developer,
            "Time-based one-time passwords",
        ),
        (
            "transform",
            "Transform",
            NodeCategory::Transform,
            "Generic transform helpers",
        ),
        (
            "travisCi",
            "Travis CI",
            NodeCategory::Developer,
            "CI builds",
        ),
        (
            "trello",
            "Trello",
            NodeCategory::Productivity,
            "Kanban boards",
        ),
        (
            "twake",
            "Twake",
            NodeCategory::Communication,
            "Open-source workplace",
        ),
        (
            "twitter",
            "Twitter / X",
            NodeCategory::Marketing,
            "Twitter API",
        ),
        (
            "typeform",
            "Typeform",
            NodeCategory::Productivity,
            "Online forms",
        ),
        (
            "uProc",
            "uProc",
            NodeCategory::Developer,
            "Data processing toolset",
        ),
        (
            "unleashedSoftware",
            "Unleashed Software",
            NodeCategory::Finance,
            "Inventory management",
        ),
        ("uplead", "UpLead", NodeCategory::Sales, "B2B contact data"),
        (
            "uptimeRobot",
            "UptimeRobot",
            NodeCategory::Developer,
            "Site monitoring",
        ),
        (
            "venafi",
            "Venafi",
            NodeCategory::Developer,
            "Machine identity",
        ),
        (
            "vero",
            "Vero",
            NodeCategory::Marketing,
            "Customer messaging",
        ),
        (
            "webflow",
            "Webflow",
            NodeCategory::Developer,
            "Website builder API",
        ),
        (
            "wekan",
            "Wekan",
            NodeCategory::Productivity,
            "Open-source Kanban",
        ),
        (
            "whatsApp",
            "WhatsApp Business",
            NodeCategory::Communication,
            "WhatsApp Business API",
        ),
        (
            "wise",
            "Wise",
            NodeCategory::Finance,
            "Cross-border payments",
        ),
        (
            "wooCommerce",
            "WooCommerce",
            NodeCategory::Finance,
            "WordPress e-commerce",
        ),
        (
            "wordpress",
            "WordPress",
            NodeCategory::Marketing,
            "WordPress CMS",
        ),
        (
            "workable",
            "Workable",
            NodeCategory::Hr,
            "Recruiting software",
        ),
        (
            "workflowTrigger",
            "Workflow Trigger",
            NodeCategory::Trigger,
            "Trigger from another workflow",
        ),
        (
            "writeBinaryFile",
            "Write Binary File",
            NodeCategory::Files,
            "Write a file to disk",
        ),
        ("wufoo", "Wufoo", NodeCategory::Productivity, "Online forms"),
        ("xero", "Xero", NodeCategory::Finance, "Accounting"),
        ("xml", "XML", NodeCategory::Transform, "Parse and build XML"),
        ("zammad", "Zammad", NodeCategory::Communication, "Helpdesk"),
        (
            "zendesk",
            "Zendesk",
            NodeCategory::Communication,
            "Customer support",
        ),
        ("zoho", "Zoho", NodeCategory::Crm, "Zoho CRM"),
        (
            "zoom",
            "Zoom",
            NodeCategory::Communication,
            "Video conferencing",
        ),
        (
            "zulip",
            "Zulip",
            NodeCategory::Communication,
            "Topic-based team chat",
        ),
    ];

    for (name, display, category, description) in stubs {
        if r.get(name).is_none() {
            r.register(stub::stub(name, display, description, *category));
        }
    }
}

#[cfg(test)]
mod aws_family_smoke_tests {
    // C.5.1 smoke tests — verify the 6 AWS-family nodes are registered with
    // non-stub descriptors and expose sensible operation options. We do NOT
    // hit real AWS endpoints from tests (no credentials in CI).
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
        assert!(
            has_operation,
            "{name} should expose an `operation` property"
        );
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
        use crate::context::ExecutionContext;
        use crate::nodes::aws_lambda::AwsLambdaNode;
        use serde_json::json;
        use std::sync::Arc;

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
        assert!(matches!(
            res,
            Err(crate::error::NodeError::MissingCredential(_))
        ));
    }
}
