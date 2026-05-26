use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Create email_templates table
        manager
            .create_table(
                Table::create()
                    .table(EmailTemplates::Table)
                    .if_not_exists()
                    .col(uuid(EmailTemplates::Id).primary_key())
                    .col(string(EmailTemplates::WorkspaceId))
                    .col(string(EmailTemplates::Name))
                    .col(string_null(EmailTemplates::Subject))
                    .col(string_null(EmailTemplates::Category))
                    .col(text_null(EmailTemplates::Html))
                    .col(timestamp_with_time_zone(EmailTemplates::CreatedAt))
                    .col(timestamp_with_time_zone(EmailTemplates::UpdatedAt))
                    .to_owned(),
            )
            .await?;

        // Create email_campaigns table
        manager
            .create_table(
                Table::create()
                    .table(EmailCampaigns::Table)
                    .if_not_exists()
                    .col(uuid(EmailCampaigns::Id).primary_key())
                    .col(string(EmailCampaigns::WorkspaceId))
                    .col(string(EmailCampaigns::Name))
                    .col(string(EmailCampaigns::Status))
                    .col(uuid_null(EmailCampaigns::TemplateId))
                    .col(string_null(EmailCampaigns::Subject))
                    .col(timestamp_with_time_zone_null(EmailCampaigns::ScheduledAt))
                    .col(timestamp_with_time_zone_null(EmailCampaigns::SentAt))
                    .col(timestamp_with_time_zone(EmailCampaigns::CreatedAt))
                    .col(timestamp_with_time_zone(EmailCampaigns::UpdatedAt))
                    .to_owned(),
            )
            .await?;

        // Create email_messages table
        manager
            .create_table(
                Table::create()
                    .table(EmailMessages::Table)
                    .if_not_exists()
                    .col(uuid(EmailMessages::Id).primary_key())
                    .col(string(EmailMessages::WorkspaceId))
                    .col(string(EmailMessages::Status))
                    .col(string(EmailMessages::ToEmail))
                    .col(string_null(EmailMessages::FromEmail))
                    .col(uuid_null(EmailMessages::CampaignId))
                    .col(uuid_null(EmailMessages::TemplateId))
                    .col(string_null(EmailMessages::ProviderMessageId))
                    .col(timestamp_with_time_zone_null(EmailMessages::SentAt))
                    .col(timestamp_with_time_zone(EmailMessages::CreatedAt))
                    .col(timestamp_with_time_zone(EmailMessages::UpdatedAt))
                    .to_owned(),
            )
            .await?;

        // Add foreign keys
        manager
            .create_foreign_key(
                ForeignKey::create()
                    .name("fk_email_campaigns_template_id")
                    .from(EmailCampaigns::Table, EmailCampaigns::TemplateId)
                    .to(EmailTemplates::Table, EmailTemplates::Id)
                    .on_delete(ForeignKeyAction::SetNull)
                    .on_update(ForeignKeyAction::Cascade)
                    .to_owned(),
            )
            .await?;

        manager
            .create_foreign_key(
                ForeignKey::create()
                    .name("fk_email_messages_campaign_id")
                    .from(EmailMessages::Table, EmailMessages::CampaignId)
                    .to(EmailCampaigns::Table, EmailCampaigns::Id)
                    .on_delete(ForeignKeyAction::SetNull)
                    .on_update(ForeignKeyAction::Cascade)
                    .to_owned(),
            )
            .await?;

        manager
            .create_foreign_key(
                ForeignKey::create()
                    .name("fk_email_messages_template_id")
                    .from(EmailMessages::Table, EmailMessages::TemplateId)
                    .to(EmailTemplates::Table, EmailTemplates::Id)
                    .on_delete(ForeignKeyAction::SetNull)
                    .on_update(ForeignKeyAction::Cascade)
                    .to_owned(),
            )
            .await?;

        // INDEXES
        manager
            .create_index(
                Index::create()
                    .name("idx_email_templates_workspace_id")
                    .table(EmailTemplates::Table)
                    .col(EmailTemplates::WorkspaceId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_email_campaigns_workspace_id_status")
                    .table(EmailCampaigns::Table)
                    .col(EmailCampaigns::WorkspaceId)
                    .col(EmailCampaigns::Status)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_email_messages_workspace_id_status")
                    .table(EmailMessages::Table)
                    .col(EmailMessages::WorkspaceId)
                    .col(EmailMessages::Status)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_email_messages_workspace_id_created_at")
                    .table(EmailMessages::Table)
                    .col(EmailMessages::WorkspaceId)
                    .col(EmailMessages::CreatedAt)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_email_messages_provider_message_id")
                    .table(EmailMessages::Table)
                    .col(EmailMessages::ProviderMessageId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_email_campaigns_template_id")
                    .table(EmailCampaigns::Table)
                    .col(EmailCampaigns::TemplateId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_email_messages_campaign_id")
                    .table(EmailMessages::Table)
                    .col(EmailMessages::CampaignId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_email_messages_template_id")
                    .table(EmailMessages::Table)
                    .col(EmailMessages::TemplateId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(EmailMessages::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(EmailCampaigns::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(EmailTemplates::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum EmailTemplates {
    Table,
    Id,
    WorkspaceId,
    Name,
    Subject,
    Category,
    Html,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum EmailCampaigns {
    Table,
    Id,
    WorkspaceId,
    Name,
    Status,
    TemplateId,
    Subject,
    ScheduledAt,
    SentAt,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum EmailMessages {
    Table,
    Id,
    WorkspaceId,
    Status,
    ToEmail,
    FromEmail,
    CampaignId,
    TemplateId,
    ProviderMessageId,
    SentAt,
    CreatedAt,
    UpdatedAt,
}
