//! Permission moduleKey constants for every CRM/HRM entity.
//!
//! Mirrors the TS world — keys are snake_case strings consumed by
//! `requirePermission(moduleKey, action)` on both the Rust and Next.js sides.
//!
//! Grouped by `docs/ecosystem/CRM_PLAN.md` §6 sub-section. Adding a new
//! entity: pick the right module, add the const, append to [`ALL`].
//!
//! Total: ~140 entities.

// ─── 6.1 Foundational ────────────────────────────────────────────────────
pub mod foundational {
    pub const PIPELINE: &str = "crm_pipeline";
    pub const STAGE: &str = "crm_stage";
    pub const TAG: &str = "crm_tag";
    pub const LABEL: &str = "crm_label";
    pub const DEPARTMENT: &str = "crm_department";
    pub const DESIGNATION: &str = "crm_designation";
    pub const BRAND: &str = "crm_brand";
    pub const BRANCH: &str = "crm_branch";
}

// ─── 6.2 Sales CRM core ──────────────────────────────────────────────────
pub mod sales_crm {
    pub const ACCOUNT: &str = "crm_account";
    pub const CONTACT: &str = "crm_contact";
    pub const LEAD: &str = "crm_lead";
    pub const DEAL: &str = "crm_deal";
    pub const AUTOMATION: &str = "crm_automation";
    pub const CUSTOM_FORM: &str = "crm_custom_form";
    pub const NOTE: &str = "crm_note";
    pub const AGENT_ASSIGNMENT: &str = "crm_agent_assignment";
}

// ─── 6.3 Sales transactions ──────────────────────────────────────────────
pub mod sales_tx {
    pub const QUOTATION: &str = "crm_quotation";
    pub const SALES_ORDER: &str = "crm_sales_order";
    pub const INVOICE: &str = "crm_invoice";
    pub const PROFORMA_INVOICE: &str = "crm_proforma_invoice";
    pub const RECURRING_INVOICE: &str = "crm_recurring_invoice";
    pub const CREDIT_NOTE: &str = "crm_credit_note";
    pub const RECEIPT: &str = "crm_receipt";
    pub const DELIVERY_CHALLAN: &str = "crm_delivery_challan";
    pub const PROPOSAL: &str = "crm_proposal";
    pub const PROPOSAL_TEMPLATE: &str = "crm_proposal_template";
    pub const CONTRACT: &str = "crm_contract";
    pub const CONTRACT_TEMPLATE: &str = "crm_contract_template";
    pub const SERVICE_CONTRACT: &str = "crm_service_contract";
    pub const SUBSCRIPTION: &str = "crm_subscription";
    pub const COUPON: &str = "crm_coupon";
    pub const GIFT_CARD: &str = "crm_gift_card";
    pub const LOYALTY: &str = "crm_loyalty";
    pub const ESTIMATE_REQUEST: &str = "crm_estimate_request";
    pub const BOOKING: &str = "crm_booking";
}

// ─── 6.4 Purchase transactions ───────────────────────────────────────────
pub mod purchase_tx {
    pub const VENDOR: &str = "crm_vendor";
    pub const PURCHASE_ORDER: &str = "crm_purchase_order";
    pub const BILL: &str = "crm_bill";
    pub const RECURRING_EXPENSE: &str = "crm_recurring_expense";
    pub const DEBIT_NOTE: &str = "crm_debit_note";
    pub const RFQ: &str = "crm_rfq";
    pub const VENDOR_BID: &str = "crm_vendor_bid";
    pub const PAYOUT: &str = "crm_payout";
    pub const HIRE: &str = "crm_hire";
    pub const PURCHASE_LEAD: &str = "crm_purchase_lead";
}

// ─── 6.5 Inventory ───────────────────────────────────────────────────────
pub mod inventory {
    pub const ITEM: &str = "crm_item";
    pub const WAREHOUSE: &str = "crm_warehouse";
    pub const STOCK_ADJUSTMENT: &str = "crm_stock_adjustment";
    pub const GRN: &str = "crm_grn";
    pub const BOM: &str = "crm_bom";
    pub const PRODUCTION_ORDER: &str = "crm_production_order";
    pub const STOCK_TRANSACTION: &str = "crm_stock_transaction";
}

// ─── 6.6 Projects & Tasks ────────────────────────────────────────────────
pub mod projects {
    pub const PROJECT: &str = "crm_project";
    pub const TASK: &str = "crm_task";
    pub const SUBTASK: &str = "crm_subtask";
    pub const MILESTONE: &str = "crm_milestone";
    pub const ISSUE: &str = "crm_issue";
    pub const TIME_LOG: &str = "crm_time_log";
    pub const WEEKLY_TIMESHEET: &str = "crm_weekly_timesheet";
    pub const PROJECT_CATEGORY: &str = "crm_project_category";
    pub const TASK_CATEGORY: &str = "crm_task_category";
    pub const TASK_LABEL: &str = "crm_task_label";
    pub const TASK_TAG: &str = "crm_task_tag";
    pub const TASKBOARD_COLUMN: &str = "crm_taskboard_column";
}

// ─── 6.7 Tickets & KB ────────────────────────────────────────────────────
pub mod tickets {
    pub const TICKET: &str = "crm_ticket";
    pub const TICKET_GROUP: &str = "crm_ticket_group";
    pub const TICKET_CHANNEL: &str = "crm_ticket_channel";
    pub const TICKET_TAG: &str = "crm_ticket_tag";
    pub const TICKET_TYPE: &str = "crm_ticket_type";
    pub const SLA: &str = "crm_sla";
    pub const KB_ARTICLE: &str = "crm_kb_article";
    pub const REPLY_TEMPLATE: &str = "crm_reply_template";
    pub const AGENT_GROUP: &str = "crm_agent_group";
}

// ─── 6.8 Accounting & Banking ────────────────────────────────────────────
pub mod accounting {
    pub const CHART_OF_ACCOUNTS: &str = "crm_chart_of_accounts";
    pub const ACCOUNT_GROUP: &str = "crm_account_group";
    pub const VOUCHER: &str = "crm_voucher";
    pub const VOUCHER_BOOK: &str = "crm_voucher_book";
    pub const BANK_ACCOUNT: &str = "crm_bank_account";
    pub const BANK_TRANSACTION: &str = "crm_bank_transaction";
}

// ─── 6.9 HR & Payroll ────────────────────────────────────────────────────
pub mod hr {
    pub const EMPLOYEE: &str = "crm_employee";
    pub const ATTENDANCE: &str = "crm_attendance";
    pub const LEAVE: &str = "crm_leave";
    pub const LEAVE_TYPE: &str = "crm_leave_type";
    pub const SHIFT: &str = "crm_shift";
    pub const SHIFT_ROTATION: &str = "crm_shift_rotation";
    pub const SHIFT_CHANGE_REQUEST: &str = "crm_shift_change_request";
    pub const PAYROLL: &str = "crm_payroll";
    pub const PAYSLIP: &str = "crm_payslip";
    pub const SALARY_STRUCTURE: &str = "crm_salary_structure";
    pub const PF_ESI: &str = "crm_pf_esi";
    pub const PROFESSIONAL_TAX: &str = "crm_professional_tax";
    pub const TDS: &str = "crm_tds";
    pub const FORM_16: &str = "crm_form_16";
    pub const GOAL: &str = "crm_goal";
    pub const OKR: &str = "crm_okr";
    pub const KPI: &str = "crm_kpi";
    pub const APPRAISAL: &str = "crm_appraisal";
    pub const FEEDBACK_360: &str = "crm_feedback_360";
    pub const ONE_ON_ONE: &str = "crm_one_on_one";
    pub const CANDIDATE: &str = "crm_candidate";
    pub const JOB: &str = "crm_job";
    pub const INTERVIEW: &str = "crm_interview";
    pub const OFFER: &str = "crm_offer";
    pub const ONBOARDING: &str = "crm_onboarding";
    pub const EXIT: &str = "crm_exit";
    pub const ASSET: &str = "crm_asset";
    pub const ASSET_ASSIGNMENT: &str = "crm_asset_assignment";
    pub const DOCUMENT: &str = "crm_document";
    pub const DOCUMENT_TEMPLATE: &str = "crm_document_template";
    pub const POLICY: &str = "crm_policy";
    pub const TRAINING: &str = "crm_training";
    pub const CERTIFICATION: &str = "crm_certification";
    pub const LEARNING_PATH: &str = "crm_learning_path";
    pub const ANNOUNCEMENT: &str = "crm_announcement";
    pub const RECOGNITION: &str = "crm_recognition";
    pub const AWARD: &str = "crm_award";
    pub const SURVEY: &str = "crm_survey";
    pub const COMPENSATION_BAND: &str = "crm_compensation_band";
    pub const PROBATION: &str = "crm_probation";
    pub const SUCCESSION: &str = "crm_succession";
    pub const HR_TIMESHEET: &str = "crm_hr_timesheet";
    pub const TRAVEL: &str = "crm_travel";
    pub const EXPENSE_CLAIM: &str = "crm_expense_claim";
    pub const DISCIPLINARY: &str = "crm_disciplinary";
}

// ─── 6.10 Workspace ──────────────────────────────────────────────────────
pub mod workspace {
    pub const DISCUSSION: &str = "crm_discussion";
    pub const DISCUSSION_CATEGORY: &str = "crm_discussion_category";
    pub const EVENT: &str = "crm_event";
    pub const NOTICE: &str = "crm_notice";
    pub const STICKY_NOTE: &str = "crm_sticky_note";
    pub const WORKSPACE_KB: &str = "crm_workspace_kb";
    pub const APPRECIATION: &str = "crm_appreciation";
}

// ─── 6.11 Master data & Settings ─────────────────────────────────────────
pub mod master {
    pub const CURRENCY: &str = "crm_currency";
    pub const TAX_RATE: &str = "crm_tax_rate";
    pub const UNIT_TYPE: &str = "crm_unit_type";
    pub const EXPENSE_CATEGORY: &str = "crm_expense_category";
    pub const CUSTOM_FIELD: &str = "crm_custom_field";
    pub const ROLE: &str = "crm_role";
    pub const PERMISSION_TYPE: &str = "crm_permission_type";
    pub const COMPANY_ADDRESS: &str = "crm_company_address";
    pub const COMPANY_PROFILE: &str = "crm_company_profile";
    pub const PROJECT_STATUS: &str = "crm_project_status";
    pub const LEADBOARD_PREFERENCE: &str = "crm_leadboard_preference";
    pub const TASKBOARD_PREFERENCE: &str = "crm_taskboard_preference";
}

// ─── 6.12 Cross-cutting ──────────────────────────────────────────────────
pub mod cross_cutting {
    pub const FILES: &str = "crm_files";
    pub const AUDIT_LOG: &str = "crm_audit_log";
    pub const ACTIVITY: &str = "crm_activity";
    pub const NOTIFICATION: &str = "crm_notification";
    pub const SEARCH: &str = "crm_search";
    pub const DASHBOARD: &str = "crm_dashboard";
}

/// Every CRM permission moduleKey, flat. Used by tests + sidebar generators.
pub const ALL: &[&str] = &[
    // Foundational
    foundational::PIPELINE,
    foundational::STAGE,
    foundational::TAG,
    foundational::LABEL,
    foundational::DEPARTMENT,
    foundational::DESIGNATION,
    foundational::BRAND,
    foundational::BRANCH,
    // Sales CRM core
    sales_crm::ACCOUNT,
    sales_crm::CONTACT,
    sales_crm::LEAD,
    sales_crm::DEAL,
    sales_crm::AUTOMATION,
    sales_crm::CUSTOM_FORM,
    sales_crm::NOTE,
    sales_crm::AGENT_ASSIGNMENT,
    // Sales tx
    sales_tx::QUOTATION,
    sales_tx::SALES_ORDER,
    sales_tx::INVOICE,
    sales_tx::PROFORMA_INVOICE,
    sales_tx::RECURRING_INVOICE,
    sales_tx::CREDIT_NOTE,
    sales_tx::RECEIPT,
    sales_tx::DELIVERY_CHALLAN,
    sales_tx::PROPOSAL,
    sales_tx::PROPOSAL_TEMPLATE,
    sales_tx::CONTRACT,
    sales_tx::CONTRACT_TEMPLATE,
    sales_tx::SERVICE_CONTRACT,
    sales_tx::SUBSCRIPTION,
    sales_tx::COUPON,
    sales_tx::GIFT_CARD,
    sales_tx::LOYALTY,
    sales_tx::ESTIMATE_REQUEST,
    sales_tx::BOOKING,
    // Purchase tx
    purchase_tx::VENDOR,
    purchase_tx::PURCHASE_ORDER,
    purchase_tx::BILL,
    purchase_tx::RECURRING_EXPENSE,
    purchase_tx::DEBIT_NOTE,
    purchase_tx::RFQ,
    purchase_tx::VENDOR_BID,
    purchase_tx::PAYOUT,
    purchase_tx::HIRE,
    purchase_tx::PURCHASE_LEAD,
    // Inventory
    inventory::ITEM,
    inventory::WAREHOUSE,
    inventory::STOCK_ADJUSTMENT,
    inventory::GRN,
    inventory::BOM,
    inventory::PRODUCTION_ORDER,
    inventory::STOCK_TRANSACTION,
    // Projects
    projects::PROJECT,
    projects::TASK,
    projects::SUBTASK,
    projects::MILESTONE,
    projects::ISSUE,
    projects::TIME_LOG,
    projects::WEEKLY_TIMESHEET,
    projects::PROJECT_CATEGORY,
    projects::TASK_CATEGORY,
    projects::TASK_LABEL,
    projects::TASK_TAG,
    projects::TASKBOARD_COLUMN,
    // Tickets
    tickets::TICKET,
    tickets::TICKET_GROUP,
    tickets::TICKET_CHANNEL,
    tickets::TICKET_TAG,
    tickets::TICKET_TYPE,
    tickets::SLA,
    tickets::KB_ARTICLE,
    tickets::REPLY_TEMPLATE,
    tickets::AGENT_GROUP,
    // Accounting
    accounting::CHART_OF_ACCOUNTS,
    accounting::ACCOUNT_GROUP,
    accounting::VOUCHER,
    accounting::VOUCHER_BOOK,
    accounting::BANK_ACCOUNT,
    accounting::BANK_TRANSACTION,
    // HR
    hr::EMPLOYEE,
    hr::ATTENDANCE,
    hr::LEAVE,
    hr::LEAVE_TYPE,
    hr::SHIFT,
    hr::SHIFT_ROTATION,
    hr::SHIFT_CHANGE_REQUEST,
    hr::PAYROLL,
    hr::PAYSLIP,
    hr::SALARY_STRUCTURE,
    hr::PF_ESI,
    hr::PROFESSIONAL_TAX,
    hr::TDS,
    hr::FORM_16,
    hr::GOAL,
    hr::OKR,
    hr::KPI,
    hr::APPRAISAL,
    hr::FEEDBACK_360,
    hr::ONE_ON_ONE,
    hr::CANDIDATE,
    hr::JOB,
    hr::INTERVIEW,
    hr::OFFER,
    hr::ONBOARDING,
    hr::EXIT,
    hr::ASSET,
    hr::ASSET_ASSIGNMENT,
    hr::DOCUMENT,
    hr::DOCUMENT_TEMPLATE,
    hr::POLICY,
    hr::TRAINING,
    hr::CERTIFICATION,
    hr::LEARNING_PATH,
    hr::ANNOUNCEMENT,
    hr::RECOGNITION,
    hr::AWARD,
    hr::SURVEY,
    hr::COMPENSATION_BAND,
    hr::PROBATION,
    hr::SUCCESSION,
    hr::HR_TIMESHEET,
    hr::TRAVEL,
    hr::EXPENSE_CLAIM,
    hr::DISCIPLINARY,
    // Workspace
    workspace::DISCUSSION,
    workspace::DISCUSSION_CATEGORY,
    workspace::EVENT,
    workspace::NOTICE,
    workspace::STICKY_NOTE,
    workspace::WORKSPACE_KB,
    workspace::APPRECIATION,
    // Master
    master::CURRENCY,
    master::TAX_RATE,
    master::UNIT_TYPE,
    master::EXPENSE_CATEGORY,
    master::CUSTOM_FIELD,
    master::ROLE,
    master::PERMISSION_TYPE,
    master::COMPANY_ADDRESS,
    master::COMPANY_PROFILE,
    master::PROJECT_STATUS,
    master::LEADBOARD_PREFERENCE,
    master::TASKBOARD_PREFERENCE,
    // Cross-cutting
    cross_cutting::FILES,
    cross_cutting::AUDIT_LOG,
    cross_cutting::ACTIVITY,
    cross_cutting::NOTIFICATION,
    cross_cutting::SEARCH,
    cross_cutting::DASHBOARD,
];
