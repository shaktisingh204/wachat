use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Create sabsms_numbers table
        manager
            .create_table(
                Table::create()
                    .table(SabsmsNumbers::Table)
                    .if_not_exists()
                    .col(uuid(SabsmsNumbers::Id).primary_key())
                    .col(string(SabsmsNumbers::WorkspaceId))
                    .col(string(SabsmsNumbers::E164))
                    .col(string(SabsmsNumbers::Country))
                    .col(string(SabsmsNumbers::Type))
                    .col(string(SabsmsNumbers::Provider))
                    .col(string_null(SabsmsNumbers::ProviderNumberId))
                    .col(json(SabsmsNumbers::Capabilities))
                    .col(string(SabsmsNumbers::Status))
                    .col(integer_null(SabsmsNumbers::MonthlyCost))
                    .col(timestamp_with_time_zone(SabsmsNumbers::CreatedAt))
                    .col(timestamp_with_time_zone_null(SabsmsNumbers::ReleasedAt))
                    .to_owned(),
            )
            .await?;

        // Create sabsms_templates table
        manager
            .create_table(
                Table::create()
                    .table(SabsmsTemplates::Table)
                    .if_not_exists()
                    .col(uuid(SabsmsTemplates::Id).primary_key())
                    .col(string(SabsmsTemplates::WorkspaceId))
                    .col(string(SabsmsTemplates::Name))
                    .col(string(SabsmsTemplates::Category))
                    .col(json(SabsmsTemplates::Bodies))
                    .col(json_null(SabsmsTemplates::Variables))
                    .col(string(SabsmsTemplates::Status))
                    .col(text_null(SabsmsTemplates::ReviewerNotes))
                    .col(json_null(SabsmsTemplates::Dlt))
                    .col(json_null(SabsmsTemplates::Tendlc))
                    .col(timestamp_with_time_zone(SabsmsTemplates::CreatedAt))
                    .col(timestamp_with_time_zone(SabsmsTemplates::UpdatedAt))
                    .to_owned(),
            )
            .await?;

        // Create sabsms_campaigns table
        manager
            .create_table(
                Table::create()
                    .table(SabsmsCampaigns::Table)
                    .if_not_exists()
                    .col(uuid(SabsmsCampaigns::Id).primary_key())
                    .col(string(SabsmsCampaigns::WorkspaceId))
                    .col(string(SabsmsCampaigns::Name))
                    .col(uuid(SabsmsCampaigns::TemplateId))
                    .col(json(SabsmsCampaigns::Audience))
                    .col(json(SabsmsCampaigns::Schedule))
                    .col(integer_null(SabsmsCampaigns::ThrottlePerSecond))
                    .col(string(SabsmsCampaigns::SenderStrategy))
                    .col(json_null(SabsmsCampaigns::SenderNumberIds))
                    .col(string(SabsmsCampaigns::Category))
                    .col(string(SabsmsCampaigns::Status))
                    .col(json(SabsmsCampaigns::Stats))
                    .col(timestamp_with_time_zone_null(SabsmsCampaigns::ScheduledAt))
                    .col(timestamp_with_time_zone_null(SabsmsCampaigns::StartedAt))
                    .col(timestamp_with_time_zone_null(SabsmsCampaigns::CompletedAt))
                    .col(timestamp_with_time_zone(SabsmsCampaigns::CreatedAt))
                    .col(timestamp_with_time_zone(SabsmsCampaigns::UpdatedAt))
                    .to_owned(),
            )
            .await?;

        // Add Campaign -> Template foreign key
        manager
            .create_foreign_key(
                ForeignKey::create()
                    .name("fk_sabsms_campaigns_template_id")
                    .from(SabsmsCampaigns::Table, SabsmsCampaigns::TemplateId)
                    .to(SabsmsTemplates::Table, SabsmsTemplates::Id)
                    .on_delete(ForeignKeyAction::SetNull)
                    .on_update(ForeignKeyAction::Cascade)
                    .to_owned(),
            )
            .await?;

        // Create sabsms_messages table
        manager
            .create_table(
                Table::create()
                    .table(SabsmsMessages::Table)
                    .if_not_exists()
                    .col(uuid(SabsmsMessages::Id).primary_key())
                    .col(string(SabsmsMessages::WorkspaceId))
                    .col(string_null(SabsmsMessages::IdempotencyKey))
                    .col(string(SabsmsMessages::Direction))
                    .col(string(SabsmsMessages::Channel))
                    .col(string(SabsmsMessages::From))
                    .col(string(SabsmsMessages::To))
                    .col(text(SabsmsMessages::Body))
                    .col(json_null(SabsmsMessages::Media))
                    .col(string(SabsmsMessages::Category))
                    .col(string(SabsmsMessages::Status))
                    .col(string_null(SabsmsMessages::ErrorCode))
                    .col(text_null(SabsmsMessages::ErrorMessage))
                    .col(string(SabsmsMessages::Provider))
                    .col(string_null(SabsmsMessages::ProviderAccountId))
                    .col(string_null(SabsmsMessages::ProviderMessageId))
                    .col(uuid_null(SabsmsMessages::TemplateId))
                    .col(uuid_null(SabsmsMessages::CampaignId))
                    .col(string_null(SabsmsMessages::ConversationId))
                    .col(string_null(SabsmsMessages::ContactId))
                    .col(string_null(SabsmsMessages::EventKey))
                    .col(integer_null(SabsmsMessages::SegmentsCount))
                    .col(integer_null(SabsmsMessages::Price))
                    .col(integer_null(SabsmsMessages::Cost))
                    .col(json_null(SabsmsMessages::Tags))
                    .col(timestamp_with_time_zone_null(SabsmsMessages::QueuedAt))
                    .col(timestamp_with_time_zone_null(SabsmsMessages::SentAt))
                    .col(timestamp_with_time_zone_null(SabsmsMessages::DeliveredAt))
                    .col(timestamp_with_time_zone_null(SabsmsMessages::FailedAt))
                    .col(timestamp_with_time_zone(SabsmsMessages::CreatedAt))
                    .col(timestamp_with_time_zone(SabsmsMessages::UpdatedAt))
                    .to_owned(),
            )
            .await?;

        // Add Message -> Template foreign key
        manager
            .create_foreign_key(
                ForeignKey::create()
                    .name("fk_sabsms_messages_template_id")
                    .from(SabsmsMessages::Table, SabsmsMessages::TemplateId)
                    .to(SabsmsTemplates::Table, SabsmsTemplates::Id)
                    .on_delete(ForeignKeyAction::SetNull)
                    .on_update(ForeignKeyAction::Cascade)
                    .to_owned(),
            )
            .await?;

        // Add Message -> Campaign foreign key
        manager
            .create_foreign_key(
                ForeignKey::create()
                    .name("fk_sabsms_messages_campaign_id")
                    .from(SabsmsMessages::Table, SabsmsMessages::CampaignId)
                    .to(SabsmsCampaigns::Table, SabsmsCampaigns::Id)
                    .on_delete(ForeignKeyAction::SetNull)
                    .on_update(ForeignKeyAction::Cascade)
                    .to_owned(),
            )
            .await?;

        // Create sabsms_suppressions table
        manager
            .create_table(
                Table::create()
                    .table(SabsmsSuppressions::Table)
                    .if_not_exists()
                    .col(uuid(SabsmsSuppressions::Id).primary_key())
                    .col(string(SabsmsSuppressions::WorkspaceId))
                    .col(string(SabsmsSuppressions::PhoneHash))
                    .col(string(SabsmsSuppressions::Source))
                    .col(string_null(SabsmsSuppressions::Reason))
                    .col(timestamp_with_time_zone(SabsmsSuppressions::CreatedAt))
                    .to_owned(),
            )
            .await?;

        // Indexes
        manager
            .create_index(
                Index::create()
                    .name("idx_sabsms_numbers_workspace_e164")
                    .table(SabsmsNumbers::Table)
                    .col(SabsmsNumbers::WorkspaceId)
                    .col(SabsmsNumbers::E164)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_sabsms_templates_workspace_id")
                    .table(SabsmsTemplates::Table)
                    .col(SabsmsTemplates::WorkspaceId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_sabsms_campaigns_workspace_id_status")
                    .table(SabsmsCampaigns::Table)
                    .col(SabsmsCampaigns::WorkspaceId)
                    .col(SabsmsCampaigns::Status)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_sabsms_messages_workspace_id_status")
                    .table(SabsmsMessages::Table)
                    .col(SabsmsMessages::WorkspaceId)
                    .col(SabsmsMessages::Status)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_sabsms_messages_workspace_id_created_at")
                    .table(SabsmsMessages::Table)
                    .col(SabsmsMessages::WorkspaceId)
                    .col(SabsmsMessages::CreatedAt)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_sabsms_messages_provider_message_id")
                    .table(SabsmsMessages::Table)
                    .col(SabsmsMessages::ProviderMessageId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_sabsms_suppressions_workspace_phone_hash")
                    .table(SabsmsSuppressions::Table)
                    .col(SabsmsSuppressions::WorkspaceId)
                    .col(SabsmsSuppressions::PhoneHash)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_sabsms_campaigns_template_id")
                    .table(SabsmsCampaigns::Table)
                    .col(SabsmsCampaigns::TemplateId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_sabsms_messages_template_id")
                    .table(SabsmsMessages::Table)
                    .col(SabsmsMessages::TemplateId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_sabsms_messages_campaign_id")
                    .table(SabsmsMessages::Table)
                    .col(SabsmsMessages::CampaignId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(SabsmsSuppressions::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(SabsmsMessages::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(SabsmsCampaigns::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(SabsmsTemplates::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(SabsmsNumbers::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum SabsmsNumbers {
    Table,
    Id,
    WorkspaceId,
    E164,
    Country,
    Type,
    Provider,
    ProviderNumberId,
    Capabilities,
    Status,
    MonthlyCost,
    CreatedAt,
    ReleasedAt,
}

#[derive(DeriveIden)]
enum SabsmsTemplates {
    Table,
    Id,
    WorkspaceId,
    Name,
    Category,
    Bodies,
    Variables,
    Status,
    ReviewerNotes,
    Dlt,
    Tendlc,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum SabsmsCampaigns {
    Table,
    Id,
    WorkspaceId,
    Name,
    TemplateId,
    Audience,
    Schedule,
    ThrottlePerSecond,
    SenderStrategy,
    SenderNumberIds,
    Category,
    Status,
    Stats,
    ScheduledAt,
    StartedAt,
    CompletedAt,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum SabsmsMessages {
    Table,
    Id,
    WorkspaceId,
    IdempotencyKey,
    Direction,
    Channel,
    From,
    To,
    Body,
    Media,
    Category,
    Status,
    ErrorCode,
    ErrorMessage,
    Provider,
    ProviderAccountId,
    ProviderMessageId,
    TemplateId,
    CampaignId,
    ConversationId,
    ContactId,
    EventKey,
    SegmentsCount,
    Price,
    Cost,
    Tags,
    QueuedAt,
    SentAt,
    DeliveredAt,
    FailedAt,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum SabsmsSuppressions {
    Table,
    Id,
    WorkspaceId,
    PhoneHash,
    Source,
    Reason,
    CreatedAt,
}
