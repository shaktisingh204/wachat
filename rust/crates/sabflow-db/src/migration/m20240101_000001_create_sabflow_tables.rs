use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Create sabflow_graphs table
        manager
            .create_table(
                Table::create()
                    .table(SabflowGraphs::Table)
                    .if_not_exists()
                    .col(uuid(SabflowGraphs::Id).primary_key())
                    .col(string(SabflowGraphs::WorkspaceId))
                    .col(string(SabflowGraphs::Name))
                    .col(text_null(SabflowGraphs::Description))
                    .col(json(SabflowGraphs::Nodes))
                    .col(json(SabflowGraphs::Edges))
                    .col(string(SabflowGraphs::Status))
                    .col(integer(SabflowGraphs::Version).default(1))
                    .col(timestamp_with_time_zone(SabflowGraphs::CreatedAt))
                    .col(timestamp_with_time_zone(SabflowGraphs::UpdatedAt))
                    .to_owned(),
            )
            .await?;

        // Create sabflow_graph_versions table
        manager
            .create_table(
                Table::create()
                    .table(SabflowGraphVersions::Table)
                    .if_not_exists()
                    .col(uuid(SabflowGraphVersions::Id).primary_key())
                    .col(uuid(SabflowGraphVersions::GraphId))
                    .col(integer(SabflowGraphVersions::Version))
                    .col(json(SabflowGraphVersions::Nodes))
                    .col(json(SabflowGraphVersions::Edges))
                    .col(string_null(SabflowGraphVersions::CreatedBy))
                    .col(timestamp_with_time_zone(SabflowGraphVersions::CreatedAt))
                    .to_owned(),
            )
            .await?;

        // Add GraphVersion -> Graph foreign key
        manager
            .create_foreign_key(
                ForeignKey::create()
                    .name("fk_sabflow_graph_versions_graph_id")
                    .from(SabflowGraphVersions::Table, SabflowGraphVersions::GraphId)
                    .to(SabflowGraphs::Table, SabflowGraphs::Id)
                    .on_delete(ForeignKeyAction::Cascade)
                    .on_update(ForeignKeyAction::Cascade)
                    .to_owned(),
            )
            .await?;

        // Create sabflow_runs table
        manager
            .create_table(
                Table::create()
                    .table(SabflowRuns::Table)
                    .if_not_exists()
                    .col(uuid(SabflowRuns::Id).primary_key())
                    .col(string(SabflowRuns::WorkspaceId))
                    .col(uuid(SabflowRuns::GraphId))
                    .col(string(SabflowRuns::Status))
                    .col(json_null(SabflowRuns::TriggerData))
                    .col(json_null(SabflowRuns::StateData))
                    .col(text_null(SabflowRuns::Error))
                    .col(timestamp_with_time_zone_null(SabflowRuns::StartedAt))
                    .col(timestamp_with_time_zone_null(SabflowRuns::CompletedAt))
                    .col(timestamp_with_time_zone(SabflowRuns::CreatedAt))
                    .col(timestamp_with_time_zone(SabflowRuns::UpdatedAt))
                    .to_owned(),
            )
            .await?;

        // Add Run -> Graph foreign key
        manager
            .create_foreign_key(
                ForeignKey::create()
                    .name("fk_sabflow_runs_graph_id")
                    .from(SabflowRuns::Table, SabflowRuns::GraphId)
                    .to(SabflowGraphs::Table, SabflowGraphs::Id)
                    .on_delete(ForeignKeyAction::Cascade)
                    .on_update(ForeignKeyAction::Cascade)
                    .to_owned(),
            )
            .await?;

        // Indexes
        manager
            .create_index(
                Index::create()
                    .name("idx_sabflow_graphs_workspace_id")
                    .table(SabflowGraphs::Table)
                    .col(SabflowGraphs::WorkspaceId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_sabflow_graphs_workspace_id_status")
                    .table(SabflowGraphs::Table)
                    .col(SabflowGraphs::WorkspaceId)
                    .col(SabflowGraphs::Status)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_sabflow_runs_workspace_id_status")
                    .table(SabflowRuns::Table)
                    .col(SabflowRuns::WorkspaceId)
                    .col(SabflowRuns::Status)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(SabflowRuns::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(SabflowGraphVersions::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(SabflowGraphs::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum SabflowGraphs {
    Table,
    Id,
    WorkspaceId,
    Name,
    Description,
    Nodes,
    Edges,
    Status,
    Version,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum SabflowGraphVersions {
    Table,
    Id,
    GraphId,
    Version,
    Nodes,
    Edges,
    CreatedBy,
    CreatedAt,
}

#[derive(DeriveIden)]
enum SabflowRuns {
    Table,
    Id,
    WorkspaceId,
    GraphId,
    Status,
    TriggerData,
    StateData,
    Error,
    StartedAt,
    CompletedAt,
    CreatedAt,
    UpdatedAt,
}
