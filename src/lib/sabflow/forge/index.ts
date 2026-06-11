/**
 * Forge entry point — SERVER ONLY.
 *
 * Importing this file pulls every declarative block into the registry. Several
 * blocks transitively reach server-only packages (db drivers, node:crypto,
 * AWS SDK, etc.), so this barrel is **not** safe to import from a client
 * component. Use the metadata API (`/api/sabflow/forge-metadata`) from the
 * client side; the engine + server actions can keep importing this barrel.
 */
import 'server-only';

import './blocks/notion';
import './blocks/airtable';
import './blocks/sabsheet';
import './blocks/slack';
import './blocks/discord';
import './blocks/github';
import './blocks/twilio';
import './blocks/sendgrid';
import './blocks/agent-run';
import './blocks/agent-tool';
import './blocks/agent-conditional';
// Step 28 — TypeScript shim executors for previously-stubbed integrations.
import './blocks/shims';
// Step 29 — net-new n8n-parity integrations.
import './blocks/parity';
// Agent A1 — 20 more shim executors (Asana, Linear, Jira, GitLab, …).
import './blocks/shims2';
// Agent A2 — 10 net-new integrations (HubSpot, Calendly, Pinecone, …).
import './blocks/parity2';
// Agent B9 — 10 more integrations (Cloudflare, Vercel, Linode, Heroku, …).
import './blocks/parity3';
// Step 39 — native database blocks (Postgres / MySQL / MongoDB / Redis).
import './blocks/databases';

// ── n8n migration: wave 1+ ports (see N8N_MIGRATION_PLAN.md) ───────────────
// Pilots
import './blocks/n8n/generic/http_request';
import './blocks/n8n/project_mgmt/linear';
import './blocks/n8n/storage/mongodb';

// Wave 1 — Batch 1: Communication
import './blocks/n8n/communication/telegram';
import './blocks/n8n/communication/whatsapp';
import './blocks/n8n/communication/mattermost';
import './blocks/n8n/communication/matrix';
import './blocks/n8n/communication/rocketchat';
import './blocks/n8n/communication/line';
import './blocks/n8n/communication/messagebird';
import './blocks/n8n/communication/vonage';
import './blocks/n8n/communication/plivo';
import './blocks/n8n/communication/sms77';

// Wave 1 — Batch 2: CRM & Sales
import './blocks/n8n/crm/hubspot';
import './blocks/n8n/crm/salesforce';
import './blocks/n8n/crm/pipedrive';
import './blocks/n8n/crm/activecampaign';
import './blocks/n8n/crm/copper';
import './blocks/n8n/crm/freshworks_crm';
import './blocks/n8n/crm/zoho_crm';
import './blocks/n8n/crm/agile_crm';
import './blocks/n8n/crm/customerio';
import './blocks/n8n/crm/intercom';

// Wave 1 — Batch 3: Project Management
import './blocks/n8n/project_mgmt/asana';
import './blocks/n8n/project_mgmt/trello';
import './blocks/n8n/project_mgmt/clickup';
import './blocks/n8n/project_mgmt/monday';
import './blocks/n8n/project_mgmt/jira';
import './blocks/n8n/project_mgmt/wekan';
import './blocks/n8n/project_mgmt/taiga';
import './blocks/n8n/project_mgmt/todoist';
import './blocks/n8n/project_mgmt/servicenow';
import './blocks/n8n/project_mgmt/freshdesk';

// Wave 1 — Batch 4: Storage / Database
import './blocks/n8n/storage/aws_s3';
import './blocks/n8n/storage/dropbox';
import './blocks/n8n/storage/nextcloud';
import './blocks/n8n/storage/box';
import './blocks/n8n/storage/ftp';
import './blocks/n8n/storage/ssh';
import './blocks/n8n/storage/snowflake';
import './blocks/n8n/storage/postgres';
import './blocks/n8n/storage/mysql';
import './blocks/n8n/storage/redis';

// Wave 1 — Batch 5: Generic / Logic
import './blocks/n8n/generic/webhook';
import './blocks/n8n/generic/set';
import './blocks/n8n/generic/if';
import './blocks/n8n/generic/switch_n8n';
import './blocks/n8n/generic/filter';
import './blocks/n8n/generic/merge';
import './blocks/n8n/generic/graphql';
import './blocks/n8n/generic/rename_keys';
import './blocks/n8n/generic/crypto';
import './blocks/n8n/generic/code';

// Wave 2 — Email & Marketing
import './blocks/n8n/email/mailchimp';
import './blocks/n8n/email/sendgrid_ext';
import './blocks/n8n/email/mailgun';
import './blocks/n8n/email/mailjet';
import './blocks/n8n/email/mandrill';
import './blocks/n8n/email/convertkit';
import './blocks/n8n/email/getresponse';
import './blocks/n8n/email/brevo';
import './blocks/n8n/email/mailerlite';
import './blocks/n8n/email/vero';

// Wave 3 — Commerce & Payments
import './blocks/n8n/commerce/shopify';
import './blocks/n8n/commerce/woocommerce';
import './blocks/n8n/commerce/stripe';
import './blocks/n8n/commerce/paddle';
import './blocks/n8n/commerce/chargebee';
import './blocks/n8n/commerce/paypal';
import './blocks/n8n/commerce/magento';
import './blocks/n8n/commerce/quickbooks';
import './blocks/n8n/commerce/xero';
import './blocks/n8n/commerce/invoiceninja';

// Wave 4 — DevOps & Git
import './blocks/n8n/devops/gitlab';
import './blocks/n8n/devops/bitbucket';
import './blocks/n8n/devops/jenkins';
import './blocks/n8n/devops/circleci';
import './blocks/n8n/devops/travisci';
import './blocks/n8n/devops/aws_lambda';
import './blocks/n8n/devops/cloudflare';
import './blocks/n8n/devops/netlify';
import './blocks/n8n/devops/git';
import './blocks/n8n/devops/postbin';

// Wave 5 — Docs & Productivity
import './blocks/n8n/docs/coda';
import './blocks/n8n/docs/google_sheets_ext';
import './blocks/n8n/docs/nocodb_ext';
import './blocks/n8n/docs/baserow';
import './blocks/n8n/docs/grist';
import './blocks/n8n/docs/stackby';
import './blocks/n8n/docs/seatable';
import './blocks/n8n/docs/strapi';
import './blocks/n8n/docs/ghost';
import './blocks/n8n/docs/wordpress';

// Wave 6 — Monitoring & Support
import './blocks/n8n/monitoring/sentry_io';
import './blocks/n8n/monitoring/pagerduty';
import './blocks/n8n/monitoring/grafana';
import './blocks/n8n/monitoring/helpscout';
import './blocks/n8n/monitoring/zendesk';
import './blocks/n8n/monitoring/zammad';
import './blocks/n8n/monitoring/deepl';
import './blocks/n8n/monitoring/reddit';
import './blocks/n8n/monitoring/discourse';
import './blocks/n8n/monitoring/hackernews';

// Wave 7 — AI & ML
import './blocks/n8n/ai/ai_transform';
import './blocks/n8n/ai/openai_ext';
import './blocks/n8n/ai/mistral_ext';
import './blocks/n8n/ai/perplexity_ext';
import './blocks/n8n/ai/humantic_ai';
import './blocks/n8n/ai/mindee';
import './blocks/n8n/ai/jina_ai';
import './blocks/n8n/ai/lingvanex';
import './blocks/n8n/ai/cortex';
import './blocks/n8n/ai/airtop';

// Wave 8 — Marketing & Analytics
import './blocks/n8n/marketing/mautic';
import './blocks/n8n/marketing/egoi';
import './blocks/n8n/marketing/iterable';
import './blocks/n8n/marketing/hunter';
import './blocks/n8n/marketing/phantombuster';
import './blocks/n8n/marketing/posthog';
import './blocks/n8n/marketing/segment';
import './blocks/n8n/marketing/clearbit';
import './blocks/n8n/marketing/profitwell';
import './blocks/n8n/marketing/tapfiliate';

// Wave 9 — CRM Extensions
import './blocks/n8n/crm_ext/keap';
import './blocks/n8n/crm_ext/monica_crm';
import './blocks/n8n/crm_ext/drift';
import './blocks/n8n/crm_ext/demio';
import './blocks/n8n/crm_ext/salesmate';
import './blocks/n8n/crm_ext/syncro_msp';
import './blocks/n8n/crm_ext/highlevel';
import './blocks/n8n/crm_ext/microsoft_dynamics_crm';
import './blocks/n8n/crm_ext/affinity';
import './blocks/n8n/crm_ext/erpnext';

// Wave 10 — Social & CMS
import './blocks/n8n/social/bitly';
import './blocks/n8n/social/twitter';
import './blocks/n8n/social/yourls';
import './blocks/n8n/social/storyblok';
import './blocks/n8n/social/webflow';
import './blocks/n8n/social/medium';
import './blocks/n8n/social/disqus';
import './blocks/n8n/social/linkedin';
import './blocks/n8n/social/rss_feed_read';
import './blocks/n8n/social/markdown';

// Wave 11 — Tools & Utilities
import './blocks/n8n/tools/bannerbear';
import './blocks/n8n/tools/brandfetch';
import './blocks/n8n/tools/quickchart';
import './blocks/n8n/tools/apitemplate_io';
import './blocks/n8n/tools/peekalink';
import './blocks/n8n/tools/kobotoolbox';
import './blocks/n8n/tools/onesimpleapi';
import './blocks/n8n/tools/html';
import './blocks/n8n/tools/xml';
import './blocks/n8n/tools/datetime';

// Wave 12 — Misc & Long Tail
import './blocks/n8n/tools/openweathermap';
import './blocks/n8n/tools/coingecko';
import './blocks/n8n/tools/urlscanio';
import './blocks/n8n/tools/marketstack';
import './blocks/n8n/tools/openthesaurus';
import './blocks/n8n/tools/nasa';
import './blocks/n8n/tools/strava';
import './blocks/n8n/tools/oura';
import './blocks/n8n/tools/spotify';
import './blocks/n8n/tools/zoom';

// Wave 13 — Email/Marketing extras
import './blocks/n8n/utilities/lemlist';
import './blocks/n8n/utilities/mailcheck';
import './blocks/n8n/utilities/dropcontact';
import './blocks/n8n/utilities/sendy';
import './blocks/n8n/utilities/emelia';
import './blocks/n8n/utilities/lonescale';
import './blocks/n8n/utilities/autopilot';
import './blocks/n8n/utilities/action_network';
import './blocks/n8n/utilities/currents';
import './blocks/n8n/utilities/bubble';

// Wave 14 — HR/Time/Productivity
import './blocks/n8n/hr/bamboohr';
import './blocks/n8n/hr/clockify';
import './blocks/n8n/hr/harvest';
import './blocks/n8n/hr/gotowebinar';
import './blocks/n8n/hr/gong';
import './blocks/n8n/hr/freshservice';
import './blocks/n8n/hr/halopsa';
import './blocks/n8n/hr/adalo';
import './blocks/n8n/hr/onfleet';
import './blocks/n8n/hr/twist';

// Wave 15 — Comms/Messaging extras
import './blocks/n8n/messaging/twake';
import './blocks/n8n/messaging/zulip';
import './blocks/n8n/messaging/gotify';
import './blocks/n8n/messaging/pushbullet';
import './blocks/n8n/messaging/pushcut';
import './blocks/n8n/messaging/pushover';
import './blocks/n8n/messaging/mocean';
import './blocks/n8n/messaging/msg91';
import './blocks/n8n/messaging/signl4';
import './blocks/n8n/messaging/facebook';

// Wave 16 — DB/Infrastructure
import './blocks/n8n/infra/questdb';
import './blocks/n8n/infra/cratedb';
import './blocks/n8n/infra/timescaledb';
import './blocks/n8n/infra/oracle';
import './blocks/n8n/infra/kafka';
import './blocks/n8n/infra/rabbitmq';
import './blocks/n8n/infra/mqtt';
import './blocks/n8n/infra/amqp';
import './blocks/n8n/infra/ldap';
import './blocks/n8n/infra/supabase';

// Wave 17 — Security/Monitoring
import './blocks/n8n/security/bitwarden';
import './blocks/n8n/security/elastic_security';
import './blocks/n8n/security/misp';
import './blocks/n8n/security/thehive';
import './blocks/n8n/security/security_scorecard';
import './blocks/n8n/security/venafi';
import './blocks/n8n/security/netscaler';
import './blocks/n8n/security/okta';
import './blocks/n8n/security/totp';
import './blocks/n8n/security/jwt';

// Wave 18 — Specialty/IoT
import './blocks/n8n/specialty/philips_hue';
import './blocks/n8n/specialty/home_assistant';
import './blocks/n8n/specialty/filemaker';
import './blocks/n8n/specialty/dhl';
import './blocks/n8n/specialty/cisco_webex';
import './blocks/n8n/specialty/cockpit';
import './blocks/n8n/specialty/rundeck';
import './blocks/n8n/specialty/splunk';
import './blocks/n8n/specialty/contentful';
import './blocks/n8n/specialty/metabase';

// Wave 19 — Misc utilities
import './blocks/n8n/utilities/uproc';
import './blocks/n8n/utilities/unleashed_software';
import './blocks/n8n/utilities/uplead';
import './blocks/n8n/utilities/orbit';
import './blocks/n8n/utilities/raindrop';
import './blocks/n8n/utilities/quickbase';
import './blocks/n8n/utilities/wise';
import './blocks/n8n/utilities/uptimerobot';
import './blocks/n8n/utilities/htmlextract';
import './blocks/n8n/utilities/read_pdf';

// Wave 20 — Final closers
import './blocks/n8n/utilities/beeminder';
import './blocks/n8n/utilities/npm';
import './blocks/n8n/utilities/google_ads';
import './blocks/n8n/utilities/edit_image';
import './blocks/n8n/utilities/icalendar';
import './blocks/n8n/utilities/flow';
import './blocks/n8n/utilities/send_email';
import './blocks/n8n/utilities/n8n_api';
import './blocks/n8n/utilities/compression';
import './blocks/n8n/utilities/wait';

// Wave 21 — Triggers-as-actions
import './blocks/n8n/triggers_as_actions/cron';
import './blocks/n8n/triggers_as_actions/interval';
import './blocks/n8n/triggers_as_actions/manual_trigger';
import './blocks/n8n/triggers_as_actions/n8n_trigger';
import './blocks/n8n/triggers_as_actions/workflow_trigger';
import './blocks/n8n/triggers_as_actions/error_trigger';
import './blocks/n8n/triggers_as_actions/sse_trigger';
import './blocks/n8n/triggers_as_actions/email_read_imap';
import './blocks/n8n/triggers_as_actions/local_file_trigger';
import './blocks/n8n/triggers_as_actions/respond_to_webhook';

// Wave 22 — n8n internals
import './blocks/n8n/internals/no_op';
import './blocks/n8n/internals/sticky_note';
import './blocks/n8n/internals/form';
import './blocks/n8n/internals/debug_helper';
import './blocks/n8n/internals/execute_command';
import './blocks/n8n/internals/execute_workflow';
import './blocks/n8n/internals/execution_data';
import './blocks/n8n/internals/move_binary_data';
import './blocks/n8n/internals/split_in_batches';
import './blocks/n8n/internals/transform_sort';

// Wave 23 — Binary/file ops (mostly safe stubs)
import './blocks/n8n/binary_ops/read_binary_file';
import './blocks/n8n/binary_ops/read_binary_files';
import './blocks/n8n/binary_ops/write_binary_file';
import './blocks/n8n/binary_ops/read_write_file';
import './blocks/n8n/binary_ops/spreadsheet_file';
import './blocks/n8n/binary_ops/simulate';
import './blocks/n8n/binary_ops/e2e_test';
import './blocks/n8n/binary_ops/time_saved';
import './blocks/n8n/binary_ops/dynamic_credential_check';
import './blocks/n8n/binary_ops/data_table';

// Wave 25 — AWS family
import './blocks/n8n/aws/dynamodb';
import './blocks/n8n/aws/ses';
import './blocks/n8n/aws/sqs';
import './blocks/n8n/aws/cognito';
import './blocks/n8n/aws/comprehend';
import './blocks/n8n/aws/rekognition';
import './blocks/n8n/aws/textract';
import './blocks/n8n/aws/transcribe';
import './blocks/n8n/aws/certificate_manager';
import './blocks/n8n/aws/iam';

// Wave 26 — Google family A
import './blocks/n8n/google/drive';
import './blocks/n8n/google/gmail';
import './blocks/n8n/google/calendar';
import './blocks/n8n/google/contacts';
import './blocks/n8n/google/docs';
import './blocks/n8n/google/slides';
import './blocks/n8n/google/tasks';
import './blocks/n8n/google/translate';
import './blocks/n8n/google/youtube';
import './blocks/n8n/google/analytics';

// Wave 27 — Google family B + Microsoft
import './blocks/n8n/google/bigquery';
import './blocks/n8n/google/chat';
import './blocks/n8n/google/cloud_storage';
import './blocks/n8n/google/firestore';
import './blocks/n8n/microsoft/excel';
import './blocks/n8n/microsoft/onedrive';
import './blocks/n8n/microsoft/outlook';
import './blocks/n8n/microsoft/teams';
import './blocks/n8n/microsoft/sharepoint';
import './blocks/n8n/microsoft/todo';

// Wave 28 — Transform / utility umbrella
import './blocks/n8n/transform/aggregate';
import './blocks/n8n/transform/limit';
import './blocks/n8n/transform/remove_duplicates';
import './blocks/n8n/transform/split_out';
import './blocks/n8n/transform/summarize';
import './blocks/n8n/transform/convert_to_file';
import './blocks/n8n/transform/extract_from_file';
import './blocks/n8n/transform/schedule_trigger';
import './blocks/n8n/transform/elasticsearch';
import './blocks/n8n/transform/venafi_cloud';

// Wave 29 — LangChain LLMs
import './blocks/n8n/langchain_llm/lm_chat_anthropic';
import './blocks/n8n/langchain_llm/lm_chat_openai';
import './blocks/n8n/langchain_llm/lm_chat_ollama';
import './blocks/n8n/langchain_llm/lm_chat_bedrock';
import './blocks/n8n/langchain_llm/lm_chat_azure_openai';
import './blocks/n8n/langchain_llm/lm_chat_gemini';
import './blocks/n8n/langchain_llm/lm_chat_groq';
import './blocks/n8n/langchain_llm/lm_chat_mistral';
import './blocks/n8n/langchain_llm/lm_cohere';
import './blocks/n8n/langchain_llm/lm_chat_alibaba';

// Wave 30 — LangChain Embeddings + Rerankers
import './blocks/n8n/langchain_embed/embeddings_openai';
import './blocks/n8n/langchain_embed/embeddings_cohere';
import './blocks/n8n/langchain_embed/embeddings_mistral';
import './blocks/n8n/langchain_embed/embeddings_ollama';
import './blocks/n8n/langchain_embed/embeddings_gemini';
import './blocks/n8n/langchain_embed/embeddings_vertex';
import './blocks/n8n/langchain_embed/embeddings_bedrock';
import './blocks/n8n/langchain_embed/embeddings_azure_openai';
import './blocks/n8n/langchain_embed/embeddings_huggingface';
import './blocks/n8n/langchain_embed/cohere_rerank';

// Wave 31 — LangChain Vector Stores
import './blocks/n8n/langchain_vector/pinecone';
import './blocks/n8n/langchain_vector/qdrant';
import './blocks/n8n/langchain_vector/weaviate';
import './blocks/n8n/langchain_vector/milvus';
import './blocks/n8n/langchain_vector/pgvector';
import './blocks/n8n/langchain_vector/supabase_vector';
import './blocks/n8n/langchain_vector/redis_vector';
import './blocks/n8n/langchain_vector/mongo_atlas_vector';
import './blocks/n8n/langchain_vector/chroma';
import './blocks/n8n/langchain_vector/in_memory';

// Wave 33 — LangChain Memory
import './blocks/n8n/langchain_memory/motorhead';
import './blocks/n8n/langchain_memory/mongo';
import './blocks/n8n/langchain_memory/redis';
import './blocks/n8n/langchain_memory/xata';
import './blocks/n8n/langchain_memory/zep';
import './blocks/n8n/langchain_memory/postgres';
import './blocks/n8n/langchain_memory/buffer_window';
import './blocks/n8n/langchain_memory/buffer';
import './blocks/n8n/langchain_memory/summary';
import './blocks/n8n/langchain_memory/vector_summary';

// Wave 34 — LangChain Retrievers + Doc Loaders
import './blocks/n8n/langchain_retrievers/retriever_vector_store';
import './blocks/n8n/langchain_retrievers/retriever_workflow';
import './blocks/n8n/langchain_retrievers/retriever_multi_query';
import './blocks/n8n/langchain_retrievers/retriever_contextual_compression';
import './blocks/n8n/langchain_retrievers/doc_loader_binary';
import './blocks/n8n/langchain_retrievers/doc_loader_default';
import './blocks/n8n/langchain_retrievers/doc_loader_github';
import './blocks/n8n/langchain_retrievers/doc_loader_json';
import './blocks/n8n/langchain_retrievers/vendor_n8n_credentials';
import './blocks/n8n/langchain_retrievers/vendor_n8n_self';

// Wave 35 — LangChain Misc (parsers/splitters/guardrails/MCP/tools)
import './blocks/n8n/langchain_misc/output_parser_structured';
import './blocks/n8n/langchain_misc/output_parser_autofix';
import './blocks/n8n/langchain_misc/text_splitter_character';
import './blocks/n8n/langchain_misc/text_splitter_recursive';
import './blocks/n8n/langchain_misc/text_splitter_token';
import './blocks/n8n/langchain_misc/guardrails_topical';
import './blocks/n8n/langchain_misc/guardrails_safety';
import './blocks/n8n/langchain_misc/guardrails_pii';
import './blocks/n8n/langchain_misc/mcp_client';
import './blocks/n8n/langchain_misc/tools_calculator';

// Wave 36 — App triggers wave 1
import './blocks/n8n/triggers_app/hubspot_trigger';
import './blocks/n8n/triggers_app/shopify_trigger';
import './blocks/n8n/triggers_app/gitlab_trigger';
import './blocks/n8n/triggers_app/mailchimp_trigger';
import './blocks/n8n/triggers_app/stripe_trigger';
import './blocks/n8n/triggers_app/woocommerce_trigger';
import './blocks/n8n/triggers_app/strava_trigger';
import './blocks/n8n/triggers_app/activecampaign_trigger';
import './blocks/n8n/triggers_app/box_trigger';
import './blocks/n8n/triggers_app/calendly_trigger';

// Wave 37 — App triggers wave 2
import './blocks/n8n/triggers_app/pipedrive_trigger';
import './blocks/n8n/triggers_app/trello_trigger';
import './blocks/n8n/triggers_app/clickup_trigger';
import './blocks/n8n/triggers_app/asana_trigger';
import './blocks/n8n/triggers_app/jira_trigger';
import './blocks/n8n/triggers_app/linear_trigger';
import './blocks/n8n/triggers_app/notion_trigger';
import './blocks/n8n/triggers_app/airtable_trigger';
import './blocks/n8n/triggers_app/telegram_trigger';
import './blocks/n8n/triggers_app/slack_trigger';

// Final sweep — Triggers A
import './blocks/n8n/triggers_app/acuity_trigger';
import './blocks/n8n/triggers_app/affinity_trigger';
import './blocks/n8n/triggers_app/amqp_trigger';
import './blocks/n8n/triggers_app/autopilot_trigger';
import './blocks/n8n/triggers_app/aws_trigger';
import './blocks/n8n/triggers_app/bitbucket_trigger';
import './blocks/n8n/triggers_app/brevo_trigger';
import './blocks/n8n/triggers_app/cal_trigger';
import './blocks/n8n/triggers_app/chargebee_trigger';
import './blocks/n8n/triggers_app/eventbrite_trigger';
// Final sweep — Triggers B
import './blocks/n8n/triggers_app/cisco_webex_trigger';
import './blocks/n8n/triggers_app/clockify_trigger';
import './blocks/n8n/triggers_app/convertkit_trigger';
import './blocks/n8n/triggers_app/copper_trigger';
import './blocks/n8n/triggers_app/currents_trigger';
import './blocks/n8n/triggers_app/customerio_trigger';
import './blocks/n8n/triggers_app/emelia_trigger';
import './blocks/n8n/triggers_app/facebook_trigger';
import './blocks/n8n/triggers_app/facebook_lead_ads_trigger';
import './blocks/n8n/triggers_app/figma_trigger';
// Final sweep — Triggers C
import './blocks/n8n/triggers_app/flow_trigger';
import './blocks/n8n/triggers_app/form_trigger';
import './blocks/n8n/triggers_app/formio_trigger';
import './blocks/n8n/triggers_app/formstack_trigger';
import './blocks/n8n/triggers_app/getresponse_trigger';
import './blocks/n8n/triggers_app/gumroad_trigger';
import './blocks/n8n/triggers_app/helpscout_trigger';
import './blocks/n8n/triggers_app/invoiceninja_trigger';
import './blocks/n8n/triggers_app/jotform_trigger';
import './blocks/n8n/triggers_app/kafka_trigger';
// Final sweep — Triggers D
import './blocks/n8n/triggers_app/keap_trigger';
import './blocks/n8n/triggers_app/kobotoolbox_trigger';
import './blocks/n8n/triggers_app/lemlist_trigger';
import './blocks/n8n/triggers_app/lonescale_trigger';
import './blocks/n8n/triggers_app/mqtt_trigger';
import './blocks/n8n/triggers_app/mailjet_trigger';
import './blocks/n8n/triggers_app/mautic_trigger';
import './blocks/n8n/triggers_app/microsoft_outlook_trigger';
import './blocks/n8n/triggers_app/microsoft_teams_trigger';
import './blocks/n8n/triggers_app/mailerlite_trigger';
// Final sweep — Triggers E
import './blocks/n8n/triggers_app/netlify_trigger';
import './blocks/n8n/triggers_app/onfleet_trigger';
import './blocks/n8n/triggers_app/paypal_trigger';
import './blocks/n8n/triggers_app/postgres_trigger';
import './blocks/n8n/triggers_app/postmark_trigger';
import './blocks/n8n/triggers_app/pushcut_trigger';
import './blocks/n8n/triggers_app/rabbitmq_trigger';
import './blocks/n8n/triggers_app/redis_trigger';
import './blocks/n8n/triggers_app/seatable_trigger';
import './blocks/n8n/triggers_app/salesforce_trigger';
// Final sweep — Triggers F
import './blocks/n8n/triggers_app/surveymonkey_trigger';
import './blocks/n8n/triggers_app/taiga_trigger';
import './blocks/n8n/triggers_app/thehive_trigger';
import './blocks/n8n/triggers_app/toggl_trigger';
import './blocks/n8n/triggers_app/twilio_trigger';
import './blocks/n8n/triggers_app/typeform_trigger';
import './blocks/n8n/triggers_app/venafi_trigger';
import './blocks/n8n/triggers_app/wise_trigger';
import './blocks/n8n/triggers_app/workable_trigger';
import './blocks/n8n/triggers_app/wufoo_trigger';

// Final sweep — Subfolder extras (Google + Microsoft)
import './blocks/n8n/subfolder_extras/gsuite_admin';
import './blocks/n8n/subfolder_extras/google_business_profile';
import './blocks/n8n/subfolder_extras/google_books';
import './blocks/n8n/subfolder_extras/google_cnl';
import './blocks/n8n/subfolder_extras/google_perspective';
import './blocks/n8n/subfolder_extras/google_firebase_rtdb';
import './blocks/n8n/subfolder_extras/azure_cosmos_db';
import './blocks/n8n/subfolder_extras/microsoft_entra';
import './blocks/n8n/subfolder_extras/microsoft_graph_security';
import './blocks/n8n/subfolder_extras/azure_storage';

// Final sweep — LangChain vendors / tools
import './blocks/n8n/langchain_vendor/tool_wikipedia';
import './blocks/n8n/langchain_vendor/tool_serpapi';
import './blocks/n8n/langchain_vendor/tool_wolframalpha';
import './blocks/n8n/langchain_vendor/tool_sql';
import './blocks/n8n/langchain_vendor/tool_http_request';
import './blocks/n8n/langchain_vendor/tool_code';
import './blocks/n8n/langchain_vendor/tool_calculator_n8n';
import './blocks/n8n/langchain_vendor/tool_workflow';
import './blocks/n8n/langchain_vendor/tool_vector_store';
import './blocks/n8n/langchain_vendor/tool_think';

// Final sweep — Utility variants (compat-shims)
import './blocks/n8n/variants_utility/set_v1';
import './blocks/n8n/variants_utility/set_v2';
import './blocks/n8n/variants_utility/switch_v1';
import './blocks/n8n/variants_utility/switch_v2';
import './blocks/n8n/variants_utility/if_v1';
import './blocks/n8n/variants_utility/filter_v1';
import './blocks/n8n/variants_utility/merge_v1';
import './blocks/n8n/variants_utility/merge_v2';
import './blocks/n8n/variants_utility/http_request_v1';
import './blocks/n8n/variants_utility/http_request_v2';

// Final sweep — Service V1 variants (compat-shims)
import './blocks/n8n/variants_service/slack_v1';
import './blocks/n8n/variants_service/hubspot_v1';
import './blocks/n8n/variants_service/discord_v1';
import './blocks/n8n/variants_service/pipedrive_v1';
import './blocks/n8n/variants_service/notion_v1';
import './blocks/n8n/variants_service/airtable_v1';
import './blocks/n8n/variants_service/twitter_v1';
import './blocks/n8n/variants_service/mattermost_v1';
import './blocks/n8n/variants_service/splunk_v1';
import './blocks/n8n/variants_service/lemlist_v1';

// ── Wave 38-47: 10×20 mass-port sweep ──
// mass_a (utility variants V1/V2/V3)
import './blocks/n8n/mass_a/crypto_v1';
import './blocks/n8n/mass_a/crypto_v2';
import './blocks/n8n/mass_a/datetime_v1';
import './blocks/n8n/mass_a/datetime_v2';
import './blocks/n8n/mass_a/emailsend_v1';
import './blocks/n8n/mass_a/emailsend_v2';
import './blocks/n8n/mass_a/filter_v2';
import './blocks/n8n/mass_a/http_request_v3';
import './blocks/n8n/mass_a/if_v2';
import './blocks/n8n/mass_a/itemlists_v1';
import './blocks/n8n/mass_a/itemlists_v2';
import './blocks/n8n/mass_a/itemlists_v3';
import './blocks/n8n/mass_a/merge_v3';
import './blocks/n8n/mass_a/removeduplicates_v1';
import './blocks/n8n/mass_a/removeduplicates_v2';
import './blocks/n8n/mass_a/splitinbatches_v1';
import './blocks/n8n/mass_a/splitinbatches_v2';
import './blocks/n8n/mass_a/splitinbatches_v3';
import './blocks/n8n/mass_a/spreadsheetfile_v1';
import './blocks/n8n/mass_a/switch_v3';

// mass_b (service variants)
import './blocks/n8n/mass_b/airtable_v2';
import './blocks/n8n/mass_b/bamboohr_v1';
import './blocks/n8n/mass_b/discord_v2';
import './blocks/n8n/mass_b/emailimap_v1';
import './blocks/n8n/mass_b/emailimap_v2';
import './blocks/n8n/mass_b/gmail_v1';
import './blocks/n8n/mass_b/highlevel_v1';
import './blocks/n8n/mass_b/highlevel_v2';
import './blocks/n8n/mass_b/hubspot_v2';
import './blocks/n8n/mass_b/lemlist_v2';
import './blocks/n8n/mass_b/mailerlite_v2';
import './blocks/n8n/mass_b/notion_v2';
import './blocks/n8n/mass_b/pipedrive_v2';
import './blocks/n8n/mass_b/seatable_v1';
import './blocks/n8n/mass_b/seatable_v2';
import './blocks/n8n/mass_b/splunk_v2';
import './blocks/n8n/mass_b/syncromsp_v1';
import './blocks/n8n/mass_b/todoist_v1';
import './blocks/n8n/mass_b/todoist_v2';
import './blocks/n8n/mass_b/webflow_v2';

// mass_c (service extended ops)
import './blocks/n8n/mass_c/aws_elb';
import './blocks/n8n/mass_c/discord_ext';
import './blocks/n8n/mass_c/hubspot_v2_actions';
import './blocks/n8n/mass_c/mailchimp_ext';
import './blocks/n8n/mass_c/mautic_ext';
import './blocks/n8n/mass_c/ms_excel_v1';
import './blocks/n8n/mass_c/ms_outlook_v1';
import './blocks/n8n/mass_c/ms_teams_v1';
import './blocks/n8n/mass_c/mysql_ext';
import './blocks/n8n/mass_c/notion_v2_actions';
import './blocks/n8n/mass_c/postgres_ext';
import './blocks/n8n/mass_c/salesforce_ext';
import './blocks/n8n/mass_c/shopify_ext';
import './blocks/n8n/mass_c/slack_ext';
import './blocks/n8n/mass_c/slack_v2_actions';
import './blocks/n8n/mass_c/stripe_ext';
import './blocks/n8n/mass_c/telegram_ext';
import './blocks/n8n/mass_c/twilio_ext';
import './blocks/n8n/mass_c/twitter_v2_actions';
import './blocks/n8n/mass_c/webflow_v2_actions';

// mass_d (LangChain misc + memory)
import './blocks/n8n/mass_d/agent_plan_execute';
import './blocks/n8n/mass_d/agent_react';
import './blocks/n8n/mass_d/chain_map_reduce';
import './blocks/n8n/mass_d/chain_qa_simple';
import './blocks/n8n/mass_d/chain_refine';
import './blocks/n8n/mass_d/doc_loader_csv';
import './blocks/n8n/mass_d/doc_loader_pdf';
import './blocks/n8n/mass_d/doc_loader_url';
import './blocks/n8n/mass_d/memory_chat_summary';
import './blocks/n8n/mass_d/memory_conversation';
import './blocks/n8n/mass_d/memory_token_buffer';
import './blocks/n8n/mass_d/output_parser_csv';
import './blocks/n8n/mass_d/output_parser_list';
import './blocks/n8n/mass_d/output_parser_xml';
import './blocks/n8n/mass_d/prompt_few_shot';
import './blocks/n8n/mass_d/prompt_template';
import './blocks/n8n/mass_d/tool_brave_search';
import './blocks/n8n/mass_d/tool_python_repl';
import './blocks/n8n/mass_d/tool_serper';
import './blocks/n8n/mass_d/tool_tavily';

// mass_e (utility helpers)
import './blocks/n8n/mass_e/array_chunk';
import './blocks/n8n/mass_e/array_filter';
import './blocks/n8n/mass_e/array_flatten';
import './blocks/n8n/mass_e/array_map';
import './blocks/n8n/mass_e/array_reduce';
import './blocks/n8n/mass_e/array_reverse';
import './blocks/n8n/mass_e/array_unique';
import './blocks/n8n/mass_e/number_arithmetic';
import './blocks/n8n/mass_e/number_format';
import './blocks/n8n/mass_e/number_round';
import './blocks/n8n/mass_e/regex_match';
import './blocks/n8n/mass_e/string_concat';
import './blocks/n8n/mass_e/string_length';
import './blocks/n8n/mass_e/string_lowercase';
import './blocks/n8n/mass_e/string_replace';
import './blocks/n8n/mass_e/string_split';
import './blocks/n8n/mass_e/string_substring';
import './blocks/n8n/mass_e/string_titlecase';
import './blocks/n8n/mass_e/string_trim';
import './blocks/n8n/mass_e/string_uppercase';

// mass_f (AI/LLM providers)
import './blocks/n8n/mass_f/audio_assemblyai';
import './blocks/n8n/mass_f/audio_deepgram';
import './blocks/n8n/mass_f/audio_elevenlabs_tts';
import './blocks/n8n/mass_f/audio_openai_tts';
import './blocks/n8n/mass_f/audio_whisper';
import './blocks/n8n/mass_f/embed_voyage';
import './blocks/n8n/mass_f/image_dalle3';
import './blocks/n8n/mass_f/image_flux';
import './blocks/n8n/mass_f/image_midjourney';
import './blocks/n8n/mass_f/image_stable_diffusion';
import './blocks/n8n/mass_f/lm_chat_anyscale';
import './blocks/n8n/mass_f/lm_chat_cerebras';
import './blocks/n8n/mass_f/lm_chat_deepseek';
import './blocks/n8n/mass_f/lm_chat_fireworks';
import './blocks/n8n/mass_f/lm_chat_octoai';
import './blocks/n8n/mass_f/lm_chat_replicate';
import './blocks/n8n/mass_f/lm_chat_xai';
import './blocks/n8n/mass_f/rerank_voyage';
import './blocks/n8n/mass_f/video_runway';
import './blocks/n8n/mass_f/video_synthesia';

// mass_g (trigger shims overflow)
import './blocks/n8n/mass_g/affinity_legacy_trigger';
import './blocks/n8n/mass_g/cisco_webex_legacy_trigger';
import './blocks/n8n/mass_g/customerio_legacy_trigger';
import './blocks/n8n/mass_g/drift_trigger';
import './blocks/n8n/mass_g/freshdesk_trigger';
import './blocks/n8n/mass_g/helpscout_trigger2';
import './blocks/n8n/mass_g/intercom_trigger';
import './blocks/n8n/mass_g/iterable_trigger';
import './blocks/n8n/mass_g/monica_crm_trigger';
import './blocks/n8n/mass_g/openai_assistants_trigger';
import './blocks/n8n/mass_g/pagerduty_trigger';
import './blocks/n8n/mass_g/posthog_trigger';
import './blocks/n8n/mass_g/salesmate_trigger';
import './blocks/n8n/mass_g/segment_trigger';
import './blocks/n8n/mass_g/sentry_trigger';
import './blocks/n8n/mass_g/servicenow_trigger';
import './blocks/n8n/mass_g/spotify_trigger';
import './blocks/n8n/mass_g/webex_meetings_trigger';
import './blocks/n8n/mass_g/zendesk_trigger';
import './blocks/n8n/mass_g/zoom_trigger';

// mass_h (niche services)
import './blocks/n8n/mass_h/anthropic_messages';
import './blocks/n8n/mass_h/cohere_generate';
import './blocks/n8n/mass_h/devto';
import './blocks/n8n/mass_h/hashnode';
import './blocks/n8n/mass_h/huggingface_inference';
import './blocks/n8n/mass_h/inngest';
import './blocks/n8n/mass_h/lemon_squeezy';
import './blocks/n8n/mass_h/llama_index_cloud';
import './blocks/n8n/mass_h/mistral_embed_ext';
import './blocks/n8n/mass_h/modal_labs';
import './blocks/n8n/mass_h/pinecone_catalog';
import './blocks/n8n/mass_h/pinecone_inference';
import './blocks/n8n/mass_h/pulumi_cloud';
import './blocks/n8n/mass_h/render';
import './blocks/n8n/mass_h/replicate';
import './blocks/n8n/mass_h/sanity';
import './blocks/n8n/mass_h/sdxl';
import './blocks/n8n/mass_h/stripe_treasury';
import './blocks/n8n/mass_h/together_ai_ext';
import './blocks/n8n/mass_h/vercel';

// mass_i (more niche)
import './blocks/n8n/mass_i/beehiiv';
import './blocks/n8n/mass_i/buttondown';
import './blocks/n8n/mass_i/coda_tables';
import './blocks/n8n/mass_i/courier';
import './blocks/n8n/mass_i/crisp';
import './blocks/n8n/mass_i/customerio_journeys';
import './blocks/n8n/mass_i/front';
import './blocks/n8n/mass_i/ghost_members';
import './blocks/n8n/mass_i/height';
import './blocks/n8n/mass_i/intercom_workspace';
import './blocks/n8n/mass_i/kit';
import './blocks/n8n/mass_i/knock';
import './blocks/n8n/mass_i/linear_search';
import './blocks/n8n/mass_i/livechat';
import './blocks/n8n/mass_i/loops';
import './blocks/n8n/mass_i/plain';
import './blocks/n8n/mass_i/pylon';
import './blocks/n8n/mass_i/substack';
import './blocks/n8n/mass_i/tana';
import './blocks/n8n/mass_i/tawk';

// mass_j (closers)
import './blocks/n8n/mass_j/base64_decode';
import './blocks/n8n/mass_j/base64_encode';
import './blocks/n8n/mass_j/currency_convert';
import './blocks/n8n/mass_j/date_iso';
import './blocks/n8n/mass_j/date_now';
import './blocks/n8n/mass_j/date_parse';
import './blocks/n8n/mass_j/hash_md5';
import './blocks/n8n/mass_j/hash_sha1';
import './blocks/n8n/mass_j/hash_sha256';
import './blocks/n8n/mass_j/ip_lookup';
import './blocks/n8n/mass_j/json_jq';
import './blocks/n8n/mass_j/json_merge';
import './blocks/n8n/mass_j/json_parse';
import './blocks/n8n/mass_j/json_stringify';
import './blocks/n8n/mass_j/qr_code';
import './blocks/n8n/mass_j/text_diff';
import './blocks/n8n/mass_j/url_decode';
import './blocks/n8n/mass_j/url_encode';
import './blocks/n8n/mass_j/url_parse';
import './blocks/n8n/mass_j/uuid_v4';

// Wave 32 — LangChain Agents/Chains/Tools
import './blocks/n8n/langchain_agent/agent';
import './blocks/n8n/langchain_agent/openai_assistant';
import './blocks/n8n/langchain_agent/chain_llm';
import './blocks/n8n/langchain_agent/chain_retrieval_qa';
import './blocks/n8n/langchain_agent/chain_summarization';
import './blocks/n8n/langchain_agent/information_extractor';
import './blocks/n8n/langchain_agent/sentiment_analysis';
import './blocks/n8n/langchain_agent/text_classifier';
import './blocks/n8n/langchain_agent/tool_executor';
import './blocks/n8n/langchain_agent/output_parser_json';

// gap_c — additional bespoke integrations (~20 most-requested services)
import './blocks/n8n/gap_c/calendly';
import './blocks/n8n/gap_c/typeform';
import './blocks/n8n/gap_c/postmark';
import './blocks/n8n/gap_c/resend';
import './blocks/n8n/gap_c/mixpanel';
import './blocks/n8n/gap_c/upstash_redis';
import './blocks/n8n/gap_c/upstash_qstash';
import './blocks/n8n/gap_c/cloudflare_kv';
import './blocks/n8n/gap_c/pinecone_vector';
import './blocks/n8n/gap_c/onesignal';
import './blocks/n8n/gap_c/exa_search';
import './blocks/n8n/gap_c/tavily_search';
import './blocks/n8n/gap_c/firecrawl';
import './blocks/n8n/gap_c/brave_search';
import './blocks/n8n/gap_c/algolia';
import './blocks/n8n/gap_c/meilisearch';
import './blocks/n8n/gap_c/typesense';
import './blocks/n8n/gap_c/tally';
import './blocks/n8n/gap_c/groq';
import './blocks/n8n/gap_c/openrouter';

// Wave 24 — Deprecated / training
import './blocks/n8n/deprecated/compare_datasets';
import './blocks/n8n/deprecated/evaluation';
import './blocks/n8n/deprecated/function_legacy';
import './blocks/n8n/deprecated/function_item_legacy';
import './blocks/n8n/deprecated/training_datastore';
import './blocks/n8n/deprecated/training_messenger';
import './blocks/n8n/deprecated/thehive_project';
import './blocks/n8n/deprecated/stop_and_error';
import './blocks/n8n/deprecated/ai_transform_v1';
import './blocks/n8n/deprecated/legacy_variants_info';

export * from './types';
export * from './registry';
