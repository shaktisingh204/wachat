//! The six built-in SabCRM standard objects.
//!
//! Faithful port of `STANDARD_OBJECTS` in `src/lib/sabcrm/schema.ts`:
//! Companies, People, Opportunities, Notes, Tasks, Activities. Field,
//! relation, select-option and board definitions mirror Twenty's standard
//! data model 1:1.
//!
//! This module is pure, dependency-free metadata — safe to use from any
//! crate. Persisted custom objects/fields are merged on top of these
//! defaults by the Next.js server layer (`objects.server.ts`).

use serde_json::Value;

use crate::types::{BoardMeta, FieldMetadata, ObjectMetadata, RelationMeta, SelectOption};

// ---------------------------------------------------------------------------
// terse builders — keep the six-object table readable + 1:1 with schema.ts
// ---------------------------------------------------------------------------

/// Bare field with just `key`/`label`/`type`/`icon`; every flag defaults
/// to `None`. Chain the `.with_*` setters below for the rest.
fn field(key: &str, label: &str, ty: &str, icon: &str) -> FieldMetadata {
    FieldMetadata {
        key: key.to_owned(),
        label: label.to_owned(),
        r#type: ty.to_owned(),
        icon: Some(icon.to_owned()),
        required: None,
        in_table: None,
        is_label: None,
        description: None,
        options: None,
        relation: None,
        default_value: None,
        system: None,
    }
}

impl FieldMetadata {
    fn required(mut self) -> Self {
        self.required = Some(true);
        self
    }
    fn in_table(mut self, v: bool) -> Self {
        self.in_table = Some(v);
        self
    }
    fn is_label(mut self) -> Self {
        self.is_label = Some(true);
        self
    }
    fn description(mut self, d: &str) -> Self {
        self.description = Some(d.to_owned());
        self
    }
    fn system(mut self, v: bool) -> Self {
        self.system = Some(v);
        self
    }
    fn options(mut self, opts: Vec<SelectOption>) -> Self {
        self.options = Some(opts);
        self
    }
    fn default_value(mut self, v: &str) -> Self {
        self.default_value = Some(Value::String(v.to_owned()));
        self
    }
    fn relation(mut self, target: &str, kind: &str, label_field: &str) -> Self {
        self.relation = Some(RelationMeta {
            target_object: target.to_owned(),
            kind: kind.to_owned(),
            label_field: Some(label_field.to_owned()),
        });
        self
    }
}

fn opt(value: &str, label: &str, color: &str) -> SelectOption {
    SelectOption {
        value: value.to_owned(),
        label: label.to_owned(),
        color: Some(color.to_owned()),
    }
}

// ---------------------------------------------------------------------------
// the six standard objects (verbatim from schema.ts)
// ---------------------------------------------------------------------------

fn companies() -> ObjectMetadata {
    ObjectMetadata {
        slug: "companies".to_owned(),
        label_singular: "Company".to_owned(),
        label_plural: "Companies".to_owned(),
        icon: "building-2".to_owned(),
        standard: Some(true),
        views: vec!["table".to_owned(), "board".to_owned()],
        board: None,
        description: None,
        fields: vec![
            field("name", "Name", "TEXT", "building-2")
                .required()
                .in_table(true)
                .is_label()
                .description("The company's legal name"),
            field("domainName", "Domain Name", "LINK", "globe")
                .in_table(true)
                .description("Company's official website domain"),
            field("address", "Address", "TEXT", "map-pin")
                .in_table(false)
                .description("Company's physical address"),
            field("employees", "Employees", "NUMBER", "users")
                .in_table(true)
                .description("Number of employees"),
            field("linkedinLink", "LinkedIn", "LINK", "linkedin")
                .in_table(false)
                .description("LinkedIn company profile URL"),
            field("xLink", "X (Twitter)", "LINK", "twitter")
                .in_table(false)
                .description("X (formerly Twitter) company handle"),
            field(
                "annualRecurringRevenue",
                "Annual Recurring Revenue",
                "CURRENCY",
                "dollar-sign",
            )
            .in_table(true)
            .description("ARR in USD"),
            field(
                "idealCustomerProfile",
                "Ideal Customer Profile",
                "BOOLEAN",
                "target",
            )
            .in_table(true)
            .description("Whether this is an ideal customer profile"),
            field("accountOwner", "Account Owner", "RELATION", "user-check")
                .in_table(true)
                .description("Primary account owner/team member")
                .relation("workspaceMembers", "MANY_TO_ONE", "name"),
            field("people", "People", "RELATION", "contact")
                .in_table(false)
                .description("People associated with this company")
                .relation("people", "ONE_TO_MANY", "name"),
            field("opportunities", "Opportunities", "RELATION", "briefcase")
                .in_table(false)
                .description("Sales opportunities with this company")
                .relation("opportunities", "ONE_TO_MANY", "name"),
        ],
    }
}

fn people() -> ObjectMetadata {
    ObjectMetadata {
        slug: "people".to_owned(),
        label_singular: "Person".to_owned(),
        label_plural: "People".to_owned(),
        icon: "users".to_owned(),
        standard: Some(true),
        views: vec!["table".to_owned(), "board".to_owned()],
        board: None,
        description: None,
        fields: vec![
            field("firstName", "First Name", "TEXT", "user")
                .required()
                .in_table(true),
            field("lastName", "Last Name", "TEXT", "user")
                .required()
                .in_table(true)
                .is_label(),
            field("email", "Email", "EMAIL", "mail").in_table(true),
            field("phone", "Phone", "PHONE", "phone").in_table(true),
            field("jobTitle", "Job Title", "TEXT", "briefcase").in_table(true),
            field("city", "City", "TEXT", "map-pin").in_table(false),
            field("linkedinLink", "LinkedIn", "LINK", "linkedin").in_table(false),
            field("xLink", "X (Twitter)", "LINK", "twitter").in_table(false),
            field("avatar", "Avatar", "FILE", "image").in_table(false),
            field("company", "Company", "RELATION", "building")
                .in_table(true)
                .relation("companies", "MANY_TO_ONE", "name"),
        ],
    }
}

fn opportunities() -> ObjectMetadata {
    ObjectMetadata {
        slug: "opportunities".to_owned(),
        label_singular: "Opportunity".to_owned(),
        label_plural: "Opportunities".to_owned(),
        icon: "briefcase".to_owned(),
        standard: Some(true),
        views: vec!["table".to_owned(), "board".to_owned()],
        board: Some(BoardMeta {
            group_by_field: "stage".to_owned(),
        }),
        description: None,
        fields: vec![
            field("name", "Name", "TEXT", "type")
                .description("The name or title of the opportunity")
                .required()
                .in_table(true)
                .is_label()
                .system(false),
            field("amount", "Amount", "CURRENCY", "dollar-sign")
                .description("Expected deal value")
                .in_table(true)
                .system(false),
            field("closeDate", "Close Date", "DATE_TIME", "calendar")
                .description("Expected closing date for the deal")
                .in_table(true)
                .system(false),
            field("stage", "Stage", "SELECT", "list")
                .description("Current stage in the sales pipeline")
                .required()
                .in_table(true)
                .system(false)
                .options(vec![
                    opt("NEW", "New", "--zoru-sky"),
                    opt("SCREENING", "Screening", "--zoru-blue"),
                    opt("MEETING", "Meeting", "--zoru-purple"),
                    opt("PROPOSAL", "Proposal", "--zoru-orange"),
                    opt("CUSTOMER", "Customer", "--zoru-green"),
                ])
                .default_value("NEW"),
            field("pointOfContact", "Point of Contact", "RELATION", "user")
                .description("Primary contact person for this opportunity")
                .in_table(true)
                .system(false)
                .relation("people", "MANY_TO_ONE", "name"),
            field("company", "Company", "RELATION", "building-2")
                .description("Company this opportunity is associated with")
                .required()
                .in_table(true)
                .system(false)
                .relation("companies", "MANY_TO_ONE", "name"),
        ],
    }
}

fn notes() -> ObjectMetadata {
    ObjectMetadata {
        slug: "notes".to_owned(),
        label_singular: "Note".to_owned(),
        label_plural: "Notes".to_owned(),
        icon: "note".to_owned(),
        standard: Some(true),
        views: vec!["table".to_owned()],
        board: None,
        description: None,
        fields: vec![
            field("title", "Title", "TEXT", "heading2")
                .description("The title or subject of the note")
                .required()
                .in_table(true)
                .is_label(),
            field("body", "Body", "TEXT", "file-text")
                .description("The main content of the note (rich text)")
                .in_table(false),
            field("createdBy", "Created By", "TEXT", "user")
                .description("User who created the note")
                .in_table(true)
                .system(true),
            field("targetCompanies", "Companies", "RELATION", "building2")
                .description("Companies this note is related to")
                .in_table(false)
                .relation("companies", "MANY_TO_ONE", "name"),
            field("targetPeople", "People", "RELATION", "user")
                .description("People this note is related to")
                .in_table(false)
                .relation("people", "MANY_TO_ONE", "name"),
            field("targetOpportunities", "Opportunities", "RELATION", "zap")
                .description("Opportunities this note is related to")
                .in_table(false)
                .relation("opportunities", "MANY_TO_ONE", "name"),
        ],
    }
}

fn tasks() -> ObjectMetadata {
    ObjectMetadata {
        slug: "tasks".to_owned(),
        label_singular: "Task".to_owned(),
        label_plural: "Tasks".to_owned(),
        icon: "check-circle-2".to_owned(),
        standard: Some(true),
        views: vec!["table".to_owned(), "board".to_owned()],
        board: Some(BoardMeta {
            group_by_field: "status".to_owned(),
        }),
        description: None,
        fields: vec![
            field("title", "Title", "TEXT", "heading-2")
                .description("Task title")
                .required()
                .in_table(true)
                .is_label(),
            field("body", "Body", "TEXT", "align-left")
                .description("Detailed description of the task")
                .in_table(false),
            field("status", "Status", "SELECT", "circle-dot")
                .description("Current status of the task")
                .required()
                .in_table(true)
                .default_value("TODO")
                .options(vec![
                    opt("TODO", "To Do", "--zoru-brand-lighter"),
                    opt("IN_PROGRESS", "In Progress", "--zoru-warning-lighter"),
                    opt("DONE", "Done", "--zoru-success-lighter"),
                ]),
            field("dueAt", "Due Date", "DATE_TIME", "calendar")
                .description("When the task is due")
                .in_table(true),
            field("assignee", "Assignee", "RELATION", "user")
                .description("Person responsible for this task")
                .in_table(true)
                .relation("people", "MANY_TO_ONE", "name"),
        ],
    }
}

fn activities() -> ObjectMetadata {
    ObjectMetadata {
        slug: "activities".to_owned(),
        label_singular: "Activity".to_owned(),
        label_plural: "Activities".to_owned(),
        icon: "activity-square".to_owned(),
        standard: Some(true),
        views: vec!["table".to_owned(), "board".to_owned()],
        board: Some(BoardMeta {
            group_by_field: "type".to_owned(),
        }),
        description: None,
        fields: vec![
            field("type", "Type", "SELECT", "list")
                .description("Category of activity")
                .required()
                .in_table(true)
                .options(vec![
                    opt("NOTE", "Note", "--zoru-blue-50"),
                    opt("TASK", "Task", "--zoru-purple-50"),
                    opt("CALL", "Call", "--zoru-green-50"),
                    opt("MEETING", "Meeting", "--zoru-orange-50"),
                    opt("EMAIL", "Email", "--zoru-pink-50"),
                ]),
            field("title", "Title", "TEXT", "heading-2")
                .description("Subject or brief description of the activity")
                .required()
                .in_table(true)
                .is_label(),
            field("body", "Body", "TEXT", "file-text")
                .description("Detailed description or notes for the activity")
                .in_table(false),
            field("happenedAt", "Happened At", "DATE_TIME", "clock")
                .description("When the activity occurred or is scheduled")
                .required()
                .in_table(true),
            field("targetObject", "Target Object", "TEXT", "target")
                .description(
                    "Slug of the object this activity relates to (e.g., companies, people, opportunities)",
                )
                .in_table(false),
            field("targetRecordId", "Target Record", "TEXT", "link-2")
                .description("ID of the specific record this activity relates to")
                .in_table(false),
        ],
    }
}

/// All six standard CRM objects, in the same order as `schema.ts`.
pub fn standard_objects() -> Vec<ObjectMetadata> {
    vec![
        companies(),
        people(),
        opportunities(),
        notes(),
        tasks(),
        activities(),
    ]
}

/// Slugs of every standard object — handy for membership checks. Order
/// matches [`standard_objects`].
pub fn standard_object_slugs() -> &'static [&'static str] {
    &[
        "companies",
        "people",
        "opportunities",
        "notes",
        "tasks",
        "activities",
    ]
}

/// Look up a standard object definition by slug. Returns `None` for
/// unknown / custom slugs.
pub fn standard_object(slug: &str) -> Option<ObjectMetadata> {
    standard_objects().into_iter().find(|o| o.slug == slug)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn has_all_six() {
        let objs = standard_objects();
        assert_eq!(objs.len(), 6);
        assert_eq!(standard_object_slugs().len(), 6);
    }

    #[test]
    fn lookup_round_trips() {
        for slug in standard_object_slugs() {
            assert!(standard_object(slug).is_some(), "missing {slug}");
        }
        assert!(standard_object("not-a-thing").is_none());
    }

    #[test]
    fn opportunities_board_groups_by_stage() {
        let opp = standard_object("opportunities").unwrap();
        assert_eq!(opp.board.unwrap().group_by_field, "stage");
    }
}
