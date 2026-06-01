// PORT-NOTE: pg-migration->mongo-index/seed
// Original: SetupMetadataTables1700140427984 — a very large Postgres migration
// that creates all core and metadata tables (apiKey, fieldMetadata, objectMetadata,
// view, viewField, viewFilter, etc.) with indexes and foreign-key constraints.
//
// In SabNode (MongoDB) there are no DDL tables or FK constraints.
// This module creates the equivalent Mongo indexes for every collection.
// Unique and compound indexes mirror the Postgres UNIQUE / INDEX declarations.
//
// Collections use the naming convention: sabcrm_<tableName_lowercase>.

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';

export const up = async (): Promise<void> => {
  const { db } = await connectToDatabase();

  // apiKey
  await db.collection('sabcrm_apikey').createIndexes([
    { key: { workspaceId: 1 }, name: 'IDX_API_KEY_WORKSPACE_ID' },
  ]);

  // keyValuePair
  await db.collection('sabcrm_keyvaluepair').createIndexes([
    { key: { key: 1, userId: 1, workspaceId: 1 }, unique: true, sparse: true, name: 'IDX_KEY_VALUE_PAIR_KEY_USER_ID_WORKSPACE_ID_UNIQUE' },
  ]);

  // twoFactorAuthenticationMethod
  await db.collection('sabcrm_twofactorauthenticationmethod').createIndexes([
    { key: { userWorkspaceId: 1, strategy: 1 }, unique: true, name: 'IDX_2FA_USER_WORKSPACE_STRATEGY_UNIQUE' },
  ]);

  // userWorkspace
  await db.collection('sabcrm_userworkspace').createIndexes([
    { key: { workspaceId: 1 }, name: 'IDX_USER_WORKSPACE_WORKSPACE_ID' },
    { key: { userId: 1 }, name: 'IDX_USER_WORKSPACE_USER_ID' },
    { key: { userId: 1, workspaceId: 1 }, unique: true, sparse: true, name: 'IDX_USER_WORKSPACE_USER_ID_WORKSPACE_ID_UNIQUE' },
  ]);

  // user
  await db.collection('sabcrm_user').createIndexes([
    { key: { email: 1 }, unique: true, sparse: true, name: 'UQ_USER_EMAIL' },
  ]);

  // approvedAccessDomain
  await db.collection('sabcrm_approvedaccessdomain').createIndexes([
    { key: { domain: 1, workspaceId: 1 }, unique: true, name: 'IDX_APPROVED_ACCESS_DOMAIN_DOMAIN_WORKSPACE_ID_UNIQUE' },
  ]);

  // featureFlag
  await db.collection('sabcrm_featureflag').createIndexes([
    { key: { key: 1, workspaceId: 1 }, unique: true, name: 'IDX_FEATURE_FLAG_KEY_WORKSPACE_ID_UNIQUE' },
  ]);

  // workspaceSSOIdentityProvider — no extra unique indexes needed beyond id.

  // dataSource
  await db.collection('sabcrm_datasource').createIndexes([
    { key: { workspaceId: 1, createdAt: 1 }, name: 'IDX_DATA_SOURCE_WORKSPACE_ID_CREATED_AT' },
  ]);

  // objectPermission
  await db.collection('sabcrm_objectpermission').createIndexes([
    { key: { objectMetadataId: 1, roleId: 1 }, unique: true, name: 'IDX_OBJECT_PERMISSION_OBJECT_METADATA_ID_ROLE_ID_UNIQUE' },
    { key: { workspaceId: 1, roleId: 1 }, name: 'IDX_OBJECT_PERMISSION_WORKSPACE_ID_ROLE_ID' },
  ]);

  // permissionFlag
  await db.collection('sabcrm_permissionflag').createIndexes([
    { key: { flag: 1, roleId: 1 }, unique: true, name: 'IDX_PERMISSION_FLAG_FLAG_ROLE_ID_UNIQUE' },
  ]);

  // roleTargets
  await db.collection('sabcrm_roletargets').createIndexes([
    { key: { apiKeyId: 1 }, sparse: true, name: 'IDX_ROLE_TARGETS_API_KEY_ID' },
    { key: { agentId: 1 }, sparse: true, name: 'IDX_ROLE_TARGETS_AGENT_ID' },
    { key: { userWorkspaceId: 1, workspaceId: 1 }, sparse: true, name: 'IDX_ROLE_TARGETS_WORKSPACE_ID' },
  ]);

  // role
  await db.collection('sabcrm_role').createIndexes([
    { key: { label: 1, workspaceId: 1 }, unique: true, name: 'IDX_ROLE_LABEL_WORKSPACE_ID_UNIQUE' },
  ]);

  // fieldPermission
  await db.collection('sabcrm_fieldpermission').createIndexes([
    { key: { fieldMetadataId: 1, roleId: 1 }, unique: true, name: 'IDX_FIELD_PERMISSION_FIELD_METADATA_ID_ROLE_ID_UNIQUE' },
    { key: { workspaceId: 1, roleId: 1 }, name: 'IDX_FIELD_PERMISSION_WORKSPACE_ID_ROLE_ID' },
  ]);

  // objectMetadata
  await db.collection('sabcrm_objectmetadata').createIndexes([
    { key: { namePlural: 1, workspaceId: 1 }, unique: true, name: 'IDX_OBJECT_METADATA_NAME_PLURAL_WORKSPACE_ID_UNIQUE' },
    { key: { nameSingular: 1, workspaceId: 1 }, unique: true, name: 'IDX_OBJECT_METADATA_NAME_SINGULAR_WORKSPACE_ID_UNIQUE' },
  ]);

  // indexMetadata
  await db.collection('sabcrm_indexmetadata').createIndexes([
    { key: { name: 1, workspaceId: 1, objectMetadataId: 1 }, unique: true, name: 'IDX_INDEX_METADATA_NAME_WORKSPACE_ID_OBJECT_METADATA_ID_UNIQUE' },
    { key: { workspaceId: 1, objectMetadataId: 1 }, name: 'IDX_INDEX_METADATA_WORKSPACE_ID_OBJECT_METADATA_ID' },
  ]);

  // indexFieldMetadata
  await db.collection('sabcrm_indexfieldmetadata').createIndexes([
    { key: { fieldMetadataId: 1 }, name: 'IDX_INDEX_FIELD_METADATA_FIELD_METADATA_ID' },
  ]);

  // fieldMetadata
  await db.collection('sabcrm_fieldmetadata').createIndexes([
    { key: { objectMetadataId: 1 }, name: 'IDX_FIELD_METADATA_OBJECT_METADATA_ID' },
    { key: { workspaceId: 1 }, name: 'IDX_FIELD_METADATA_WORKSPACE_ID' },
    { key: { objectMetadataId: 1, workspaceId: 1 }, name: 'IDX_FIELD_METADATA_OBJECT_METADATA_ID_WORKSPACE_ID' },
    { key: { relationTargetObjectMetadataId: 1 }, sparse: true, name: 'IDX_FIELD_METADATA_RELATION_TARGET_OBJECT_METADATA_ID' },
    { key: { relationTargetFieldMetadataId: 1 }, sparse: true, unique: true, name: 'IDX_FIELD_METADATA_RELATION_TARGET_FIELD_METADATA_ID' },
  ]);

  // viewFilter
  await db.collection('sabcrm_viewfilter').createIndexes([
    { key: { fieldMetadataId: 1 }, name: 'IDX_VIEW_FILTER_FIELD_METADATA_ID' },
    { key: { viewId: 1 }, name: 'IDX_VIEW_FILTER_VIEW_ID' },
    { key: { workspaceId: 1, viewId: 1 }, name: 'IDX_VIEW_FILTER_WORKSPACE_ID_VIEW_ID' },
    { key: { workspaceId: 1, universalIdentifier: 1 }, unique: true, sparse: true, name: 'IDX_VIEW_FILTER_WORKSPACE_UNIVERSAL_ID' },
  ]);

  // viewFilterGroup
  await db.collection('sabcrm_viewfiltergroup').createIndexes([
    { key: { viewId: 1 }, name: 'IDX_VIEW_FILTER_GROUP_VIEW_ID' },
    { key: { workspaceId: 1, viewId: 1 }, name: 'IDX_VIEW_FILTER_GROUP_WORKSPACE_ID_VIEW_ID' },
    { key: { workspaceId: 1, universalIdentifier: 1 }, unique: true, sparse: true, name: 'IDX_VIEW_FILTER_GROUP_WORKSPACE_UNIVERSAL_ID' },
  ]);

  // viewGroup
  await db.collection('sabcrm_viewgroup').createIndexes([
    { key: { viewId: 1 }, name: 'IDX_VIEW_GROUP_VIEW_ID' },
    { key: { workspaceId: 1, viewId: 1 }, name: 'IDX_VIEW_GROUP_WORKSPACE_ID_VIEW_ID' },
    { key: { workspaceId: 1, universalIdentifier: 1 }, unique: true, sparse: true, name: 'IDX_VIEW_GROUP_WORKSPACE_UNIVERSAL_ID' },
  ]);

  // viewSort
  await db.collection('sabcrm_viewsort').createIndexes([
    { key: { viewId: 1 }, name: 'IDX_VIEW_SORT_VIEW_ID' },
    { key: { workspaceId: 1, viewId: 1 }, name: 'IDX_VIEW_SORT_WORKSPACE_ID_VIEW_ID' },
    { key: { fieldMetadataId: 1, viewId: 1 }, unique: true, sparse: true, name: 'IDX_VIEW_SORT_FIELD_METADATA_ID_VIEW_ID_UNIQUE' },
    { key: { workspaceId: 1, universalIdentifier: 1 }, unique: true, sparse: true, name: 'IDX_VIEW_SORT_WORKSPACE_UNIVERSAL_ID' },
  ]);

  // view
  await db.collection('sabcrm_view').createIndexes([
    { key: { workspaceId: 1, objectMetadataId: 1 }, name: 'IDX_VIEW_WORKSPACE_ID_OBJECT_METADATA_ID' },
    { key: { workspaceId: 1, universalIdentifier: 1 }, unique: true, sparse: true, name: 'IDX_VIEW_WORKSPACE_UNIVERSAL_ID' },
  ]);

  // viewField
  await db.collection('sabcrm_viewfield').createIndexes([
    { key: { viewId: 1 }, name: 'IDX_VIEW_FIELD_VIEW_ID' },
    { key: { workspaceId: 1, viewId: 1 }, name: 'IDX_VIEW_FIELD_WORKSPACE_ID_VIEW_ID' },
    { key: { fieldMetadataId: 1, viewId: 1 }, unique: true, sparse: true, name: 'IDX_VIEW_FIELD_FIELD_METADATA_ID_VIEW_ID_UNIQUE' },
    { key: { workspaceId: 1, universalIdentifier: 1 }, unique: true, sparse: true, name: 'IDX_VIEW_FIELD_WORKSPACE_UNIVERSAL_ID' },
  ]);

  // webhook
  await db.collection('sabcrm_webhook').createIndexes([
    { key: { workspaceId: 1 }, name: 'IDX_WEBHOOK_WORKSPACE_ID' },
  ]);

  // file
  await db.collection('sabcrm_file').createIndexes([
    { key: { workspaceId: 1 }, name: 'IDX_FILE_WORKSPACE_ID' },
  ]);

  // agentChatMessage
  await db.collection('sabcrm_agentchatmessage').createIndexes([
    { key: { threadId: 1 }, name: 'IDX_AGENT_CHAT_MESSAGE_THREAD_ID' },
  ]);

  // agentChatThread
  await db.collection('sabcrm_agentchatthread').createIndexes([
    { key: { agentId: 1 }, name: 'IDX_AGENT_CHAT_THREAD_AGENT_ID' },
    { key: { userWorkspaceId: 1 }, name: 'IDX_AGENT_CHAT_THREAD_USER_WORKSPACE_ID' },
  ]);

  // agent
  await db.collection('sabcrm_agent').createIndexes([
    { key: { name: 1, workspaceId: 1 }, unique: true, sparse: true, name: 'IDX_AGENT_NAME_WORKSPACE_ID_UNIQUE' },
    { key: { id: 1 }, name: 'IDX_AGENT_ID_DELETED_AT' },
  ]);

  // agentHandoff
  await db.collection('sabcrm_agenthandoff').createIndexes([
    { key: { fromAgentId: 1, toAgentId: 1, workspaceId: 1 }, unique: true, sparse: true, name: 'IDX_AGENT_HANDOFF_FROM_TO_WORKSPACE_UNIQUE' },
    { key: { id: 1 }, name: 'IDX_AGENT_HANDOFF_ID_DELETED_AT' },
  ]);

  // workspace
  await db.collection('sabcrm_workspace').createIndexes([
    { key: { subdomain: 1 }, unique: true, name: 'UQ_WORKSPACE_SUBDOMAIN' },
    { key: { customDomain: 1 }, unique: true, sparse: true, name: 'UQ_WORKSPACE_CUSTOM_DOMAIN' },
    { key: { activationStatus: 1 }, name: 'IDX_WORKSPACE_ACTIVATION_STATUS' },
  ]);

  // cronTrigger
  await db.collection('sabcrm_crontrigger').createIndexes([
    { key: { workspaceId: 1 }, name: 'IDX_CRON_TRIGGER_WORKSPACE_ID' },
    { key: { workspaceId: 1, universalIdentifier: 1 }, unique: true, sparse: true, name: 'IDX_CRON_TRIGGER_WORKSPACE_UNIVERSAL_ID' },
  ]);

  // databaseEventTrigger
  await db.collection('sabcrm_databaseeventtrigger').createIndexes([
    { key: { workspaceId: 1 }, name: 'IDX_DATABASE_EVENT_TRIGGER_WORKSPACE_ID' },
    { key: { workspaceId: 1, universalIdentifier: 1 }, unique: true, sparse: true, name: 'IDX_DATABASE_EVENT_TRIGGER_WORKSPACE_UNIVERSAL_ID' },
  ]);

  // serverlessFunction
  await db.collection('sabcrm_serverlessfunction').createIndexes([
    { key: { id: 1 }, name: 'IDX_SERVERLESS_FUNCTION_ID_DELETED_AT' },
  ]);
};

export const down = async (): Promise<void> => {
  // PORT-NOTE: In MongoDB dropping all indexes is destructive. We only drop
  // the non-_id indexes created in up().
  const { db } = await connectToDatabase();

  const collections = [
    'sabcrm_apikey', 'sabcrm_keyvaluepair', 'sabcrm_twofactorauthenticationmethod',
    'sabcrm_userworkspace', 'sabcrm_user', 'sabcrm_approvedaccessdomain',
    'sabcrm_featureflag', 'sabcrm_datasource', 'sabcrm_objectpermission',
    'sabcrm_permissionflag', 'sabcrm_roletargets', 'sabcrm_role',
    'sabcrm_fieldpermission', 'sabcrm_objectmetadata', 'sabcrm_indexmetadata',
    'sabcrm_indexfieldmetadata', 'sabcrm_fieldmetadata', 'sabcrm_viewfilter',
    'sabcrm_viewfiltergroup', 'sabcrm_viewgroup', 'sabcrm_viewsort',
    'sabcrm_view', 'sabcrm_viewfield', 'sabcrm_webhook', 'sabcrm_file',
    'sabcrm_agentchatmessage', 'sabcrm_agentchatthread', 'sabcrm_agent',
    'sabcrm_agenthandoff', 'sabcrm_workspace', 'sabcrm_crontrigger',
    'sabcrm_databaseeventtrigger', 'sabcrm_serverlessfunction',
  ];

  await Promise.all(
    collections.map((name) => db.collection(name).dropIndexes().catch(() => undefined)),
  );
};

export const migrationName = 'SetupMetadataTables1700140427984';
