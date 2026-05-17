/**
 * CRM Public API — barrel export (Phase 7 foundation).
 *
 * Import surface for route handlers:
 *
 *   import {
 *     authenticateAndRequireScope,
 *     apiError, apiItemResponse, apiListResponse, ApiErrors,
 *     readScope, writeScope,
 *   } from '@/lib/api';
 */

export type {
    OAuthScope,
    CrmReadScope,
    CrmWriteScope,
    CrmWildcardScope,
    CrmApiEntity,
} from './oauth-scopes';
export {
    CRM_API_ENTITIES,
    ALL_CRM_SCOPES,
    readScope,
    writeScope,
    isOAuthScope,
    requireScope,
} from './oauth-scopes';

export type {
    ApiErrorCode,
    ApiErrorBody,
    ApiSuccessListBody,
    ApiSuccessItemBody,
} from './errors';
export { apiError, apiItemResponse, apiListResponse, ApiErrors } from './errors';

export type {
    CrmApiTokenDoc,
    PublicAuthContext,
    PublicAuthResult,
} from './auth';
export {
    authenticatePublicRequest,
    authenticateAndRequireScope,
    hashApiToken,
} from './auth';
