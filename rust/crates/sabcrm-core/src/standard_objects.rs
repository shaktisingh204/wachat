//! The built-in SabCRM standard objects.
//!
//! Faithful port of `STANDARD_OBJECTS` in `src/lib/sabcrm/schema.ts`:
//! Companies, People, Opportunities, Notes, Tasks, Activities — plus a
//! `workspaceMembers` object so the RELATION fields that target team members
//! (`accountOwner`, opportunity `owner`, task `assignee`) resolve to a real
//! person. Field, relation, select-option and board definitions mirror
//! Twenty's standard data model 1:1.
//!
//! This module is pure, dependency-free metadata — safe to use from any
//! crate. Persisted custom objects/fields are merged on top of these
//! defaults by the Next.js server layer (`objects.server.ts`).

use serde_json::Value;

use crate::types::{BoardMeta, FieldMetadata, ObjectMetadata, RelationMeta, SelectOption};

// ---------------------------------------------------------------------------
// terse builders — keep the object table readable + 1:1 with schema.ts
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
// the standard objects (verbatim from schema.ts) + workspaceMembers
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
                .description("The company name"),
            field("domainName", "Domain Name", "LINKS", "globe")
                .in_table(true)
                .description("Company's domain name"),
            field("createdBy", "Created by", "ACTOR", "user")
                .in_table(true)
                .system(true)
                .description("The creator of the record"),
            field("accountOwner", "Account Owner", "RELATION", "user-check")
                .in_table(true)
                .description(
                    "Your team member responsible for managing the company account",
                )
                .relation("workspaceMembers", "MANY_TO_ONE", "name"),
            field("createdAt", "Creation date", "DATE_TIME", "calendar")
                .in_table(true)
                .system(true)
                .description("Creation date"),
            field("updatedAt", "Last update", "DATE_TIME", "calendar-clock")
                .in_table(false)
                .system(true)
                .description("Last time the record was changed"),
            field("updatedBy", "Updated by", "ACTOR", "user-circle")
                .in_table(false)
                .system(true)
                .description("The workspace member who last updated the record"),
            field("employees", "Employees", "NUMBER", "users")
                .in_table(true)
                .description("Number of employees in the company"),
            field("linkedinLink", "Linkedin", "LINKS", "linkedin")
                .in_table(true)
                .description("The company Linkedin account"),
            field("address", "Address", "ADDRESS", "map-pin")
                .in_table(true)
                .description("Address of the company"),
            field("xLink", "X", "LINKS", "twitter")
                .in_table(false)
                .description("The company Twitter/X account"),
            field(
                "annualRecurringRevenue",
                "ARR",
                "CURRENCY",
                "dollar-sign",
            )
            .in_table(false)
            .description(
                "Annual Recurring Revenue: The actual or estimated annual revenue of the company",
            ),
            field(
                "idealCustomerProfile",
                "ICP",
                "BOOLEAN",
                "target",
            )
            .in_table(false)
            .description(
                "Ideal Customer Profile: Indicates whether the company is the most suitable and valuable customer for you",
            ),
            field("people", "People", "RELATION", "contact")
                .in_table(false)
                .description("People linked to the company.")
                .relation("people", "ONE_TO_MANY", "name"),
            field("opportunities", "Opportunities", "RELATION", "target-arrow")
                .in_table(false)
                .description("Opportunities linked to the company.")
                .relation("opportunities", "ONE_TO_MANY", "name"),
            field("attachments", "Attachments", "RELATION", "paperclip")
                .in_table(false)
                .system(true)
                .description("Attachments linked to the company")
                .relation("attachments", "ONE_TO_MANY", "name"),
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
                .in_table(true)
                .description("Contact's first name"),
            field("lastName", "Last Name", "TEXT", "user")
                .required()
                .in_table(true)
                .is_label()
                .description("Contact's last name"),
            field("email", "Emails", "EMAILS", "mail")
                .in_table(true)
                .description("Contact's Emails"),
            field("createdBy", "Created by", "ACTOR", "user")
                .in_table(true)
                .system(true)
                .description("The creator of the record"),
            field("company", "Company", "RELATION", "building")
                .in_table(true)
                .description("Contact's company")
                .relation("companies", "MANY_TO_ONE", "name"),
            field("phone", "Phones", "PHONES", "phone")
                .in_table(true)
                .description("Contact's phone numbers"),
            field("createdAt", "Creation date", "DATE_TIME", "calendar")
                .in_table(true)
                .system(true)
                .description("Creation date"),
            field("city", "City", "TEXT", "map-pin")
                .in_table(true)
                .description("Contact's city"),
            field("jobTitle", "Job Title", "TEXT", "briefcase")
                .in_table(true)
                .description("Contact's job title"),
            field("linkedinLink", "Linkedin", "LINKS", "linkedin")
                .in_table(true)
                .description("Contact's Linkedin account"),
            field("xLink", "X", "LINKS", "twitter")
                .in_table(true)
                .description("Contact's X/Twitter account"),
            field("avatarUrl", "Avatar", "FILE", "image")
                .in_table(false)
                .system(true)
                .description("Contact's avatar"),
            field("updatedAt", "Last update", "DATE_TIME", "calendar-clock")
                .in_table(false)
                .system(true)
                .description("Last time the record was changed"),
            field("updatedBy", "Updated by", "ACTOR", "user-circle")
                .in_table(false)
                .system(true)
                .description("The workspace member who last updated the record"),
            field(
                "pointOfContactForOpportunities",
                "Opportunities",
                "RELATION",
                "target-arrow",
            )
            .in_table(false)
            .description(
                "List of opportunities for which that person is the point of contact",
            )
            .relation("opportunities", "ONE_TO_MANY", "name"),
            field("attachments", "Attachments", "RELATION", "paperclip")
                .in_table(false)
                .system(true)
                .description("Attachments linked to the contact.")
                .relation("attachments", "ONE_TO_MANY", "name"),
        ],
    }
}

fn opportunities() -> ObjectMetadata {
    ObjectMetadata {
        slug: "opportunities".to_owned(),
        label_singular: "Opportunity".to_owned(),
        label_plural: "Opportunities".to_owned(),
        icon: "target-arrow".to_owned(),
        standard: Some(true),
        views: vec!["table".to_owned(), "board".to_owned()],
        board: Some(BoardMeta {
            group_by_field: "stage".to_owned(),
        }),
        description: None,
        fields: vec![
            field("name", "Name", "TEXT", "target-arrow")
                .description("The opportunity name")
                .required()
                .in_table(true)
                .is_label()
                .system(false),
            field("amount", "Amount", "CURRENCY", "dollar-sign")
                .description("Opportunity amount")
                .in_table(true)
                .system(false),
            field("createdBy", "Created by", "ACTOR", "user")
                .description("The creator of the record")
                .in_table(true)
                .system(true),
            field("closeDate", "Close date", "DATE_TIME", "calendar")
                .description("Opportunity close date")
                .in_table(true)
                .system(false),
            field("company", "Company", "RELATION", "building-2")
                .description("Opportunity company")
                .in_table(true)
                .system(false)
                .relation("companies", "MANY_TO_ONE", "name"),
            field("pointOfContact", "Point of Contact", "RELATION", "user")
                .description("Opportunity point of contact")
                .in_table(true)
                .system(false)
                .relation("people", "MANY_TO_ONE", "name"),
            field("stage", "Stage", "SELECT", "progress-check")
                .description("Opportunity stage")
                .required()
                .in_table(false)
                .system(false)
                .options(vec![
                    opt("NEW", "New", "red"),
                    opt("SCREENING", "Screening", "purple"),
                    opt("MEETING", "Meeting", "sky"),
                    opt("PROPOSAL", "Proposal", "turquoise"),
                    opt("CUSTOMER", "Customer", "yellow"),
                ])
                .default_value("NEW"),
            field("owner", "Owner", "RELATION", "user-circle")
                .description("Opportunity owner")
                .in_table(false)
                .system(false)
                .relation("workspaceMembers", "MANY_TO_ONE", "name"),
            field("updatedAt", "Last update", "DATE_TIME", "calendar-clock")
                .description("Last time the record was changed")
                .in_table(false)
                .system(true),
            field("updatedBy", "Updated by", "ACTOR", "user-circle")
                .description("The workspace member who last updated the record")
                .in_table(false)
                .system(true),
            field("attachments", "Attachments", "RELATION", "paperclip")
                .description("Attachments linked to the opportunity")
                .in_table(false)
                .system(true)
                .relation("attachments", "ONE_TO_MANY", "name"),
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
                .description("Note title")
                .required()
                .in_table(true)
                .is_label(),
            field("targetPeople", "Relations", "RELATION", "arrow-up-right")
                .description("Note targets")
                .in_table(true)
                .relation("people", "MANY_TO_ONE", "name"),
            field("body", "Body", "RICH_TEXT_V2", "file-text")
                .description("Note body")
                .in_table(true),
            field("createdBy", "Created by", "ACTOR", "user")
                .description("The creator of the record")
                .in_table(true)
                .system(true),
            field("createdAt", "Creation date", "DATE_TIME", "calendar")
                .description("Creation date")
                .in_table(true)
                .system(true),
            field("targetCompanies", "Companies", "RELATION", "building2")
                .description("Companies this note is related to")
                .in_table(false)
                .relation("companies", "MANY_TO_ONE", "name"),
            field("targetOpportunities", "Opportunities", "RELATION", "target-arrow")
                .description("Opportunities this note is related to")
                .in_table(false)
                .relation("opportunities", "MANY_TO_ONE", "name"),
            field("updatedAt", "Last update", "DATE_TIME", "calendar-clock")
                .description("Last time the record was changed")
                .in_table(false)
                .system(true),
            field("updatedBy", "Updated by", "ACTOR", "user-circle")
                .description("The workspace member who last updated the record")
                .in_table(false)
                .system(true),
            field("attachments", "Attachments", "RELATION", "paperclip")
                .description("Note attachments")
                .in_table(false)
                .system(true)
                .relation("attachments", "ONE_TO_MANY", "name"),
        ],
    }
}

fn tasks() -> ObjectMetadata {
    ObjectMetadata {
        slug: "tasks".to_owned(),
        label_singular: "Task".to_owned(),
        label_plural: "Tasks".to_owned(),
        icon: "checkbox".to_owned(),
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
            field("status", "Status", "SELECT", "circle-dot")
                .description("Task status")
                .in_table(true)
                .default_value("TODO")
                .options(vec![
                    opt("TODO", "To do", "sky"),
                    opt("IN_PROGRESS", "In progress", "purple"),
                    opt("DONE", "Done", "green"),
                ]),
            field("targetPeople", "Relations", "RELATION", "arrow-up-right")
                .description("Task targets")
                .in_table(true)
                .relation("people", "MANY_TO_ONE", "name"),
            field("assignee", "Assignee", "RELATION", "user-circle")
                .description("Task assignee")
                .in_table(true)
                .relation("workspaceMembers", "MANY_TO_ONE", "name"),
            field("createdBy", "Created by", "ACTOR", "user")
                .description("The creator of the record")
                .in_table(true)
                .system(true),
            field("dueAt", "Due Date", "DATE_TIME", "calendar")
                .description("Task due date")
                .in_table(true),
            field("body", "Body", "RICH_TEXT_V2", "align-left")
                .description("Task body")
                .in_table(true),
            field("createdAt", "Creation date", "DATE_TIME", "calendar")
                .description("Creation date")
                .in_table(true)
                .system(true),
            field("targetCompanies", "Companies", "RELATION", "building2")
                .description("Companies this task is related to")
                .in_table(false)
                .relation("companies", "MANY_TO_ONE", "name"),
            field("targetOpportunities", "Opportunities", "RELATION", "target-arrow")
                .description("Opportunities this task is related to")
                .in_table(false)
                .relation("opportunities", "MANY_TO_ONE", "name"),
            field("updatedAt", "Last update", "DATE_TIME", "calendar-clock")
                .description("Last time the record was changed")
                .in_table(false)
                .system(true),
            field("updatedBy", "Updated by", "ACTOR", "user-circle")
                .description("The workspace member who last updated the record")
                .in_table(false)
                .system(true),
            field("attachments", "Attachments", "RELATION", "paperclip")
                .description("Task attachments")
                .in_table(false)
                .system(true)
                .relation("attachments", "ONE_TO_MANY", "name"),
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

/// `workspaceMembers` — the project's team/members surfaced as a CRM object
/// so RELATION fields like `accountOwner`, opportunity `owner` and task
/// `assignee` resolve to a real person.
///
/// Records of this object are sourced from the project's team/members (not
/// hand-created in the CRM), so every field is `system: true`. Mirrors
/// Twenty's `workspaceMember` standard object (id, name, userEmail,
/// avatarUrl), plus a `role` SELECT for the member's workspace role.
fn workspace_members() -> ObjectMetadata {
    ObjectMetadata {
        slug: "workspaceMembers".to_owned(),
        label_singular: "Member".to_owned(),
        label_plural: "Members".to_owned(),
        icon: "user-circle".to_owned(),
        standard: Some(true),
        views: vec!["table".to_owned()],
        board: None,
        description: Some(
            "Your team members. Sourced from the project's team; used as the target of accountOwner / owner / assignee relations.".to_owned(),
        ),
        fields: vec![
            field("id", "Id", "TEXT", "hash")
                .system(true)
                .in_table(false)
                .description("The member's stable identifier (project member id)"),
            field("name", "Name", "TEXT", "user-circle")
                .required()
                .in_table(true)
                .is_label()
                .system(true)
                .description("The member's full name"),
            field("email", "Email", "EMAILS", "mail")
                .in_table(true)
                .system(true)
                .description("The member's email address"),
            field("avatarUrl", "Avatar", "FILE", "image")
                .in_table(true)
                .system(true)
                .description("The member's avatar"),
            field("role", "Role", "SELECT", "shield")
                .in_table(true)
                .system(true)
                .default_value("MEMBER")
                .options(vec![
                    opt("OWNER", "Owner", "--zoru-orange-50"),
                    opt("ADMIN", "Admin", "--zoru-purple-50"),
                    opt("MEMBER", "Member", "--zoru-blue-50"),
                    opt("GUEST", "Guest", "--zoru-gray-50"),
                ])
                .description("The member's workspace role"),
        ],
    }
}

/// All standard CRM objects, in the same order as `schema.ts`, followed by
/// the `workspaceMembers` relation target.
pub fn standard_objects() -> Vec<ObjectMetadata> {
    vec![
        companies(),
        people(),
        opportunities(),
        notes(),
        tasks(),
        activities(),
        workspace_members(),
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
        "workspaceMembers",
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
    fn has_all_standard_objects() {
        let objs = standard_objects();
        assert_eq!(objs.len(), 7);
        assert_eq!(standard_object_slugs().len(), 7);
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

    #[test]
    fn workspace_members_has_relation_target_fields() {
        let wm = standard_object("workspaceMembers").unwrap();
        for key in ["id", "name", "email", "avatarUrl", "role"] {
            assert!(wm.fields.iter().any(|f| f.key == key), "missing {key}");
        }
        // `name` is the label field that relations resolve against.
        let name = wm.fields.iter().find(|f| f.key == "name").unwrap();
        assert_eq!(name.is_label, Some(true));
    }

    #[test]
    fn relation_targets_resolve_to_standard_objects() {
        for obj in standard_objects() {
            for f in &obj.fields {
                if let Some(rel) = &f.relation {
                    // `attachments` is a relation target that is not itself a
                    // seeded standard object yet; everything else must resolve.
                    if rel.target_object == "attachments" {
                        continue;
                    }
                    assert!(
                        standard_object(&rel.target_object).is_some(),
                        "{}.{} -> unknown object {}",
                        obj.slug,
                        f.key,
                        rel.target_object
                    );
                }
            }
        }
    }
}
