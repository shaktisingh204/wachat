# Core File & Domain Modules

Comprehensive function documentation for file storage, domain management, search, and messaging webhooks modules in twenty-server backend.

## file - Core File Management

### file.exception.ts
- **FileException** — `file:file.exception.ts:37`, class extends CustomException with code-based error handling. Maps exception codes (UNAUTHENTICATED, FILE_NOT_FOUND, INVALID_FILE_FOLDER, TEMPORARY_FILE_NOT_ALLOWED) to user-friendly messages via `getFileExceptionUserFriendlyMessage()`.

### file-api-exception.filter.ts
- **FileApiExceptionFilter.catch()** — `file:filters/file-api-exception.filter.ts:21`, catches FileException and routes to httpExceptionHandlerService with appropriate HTTP status (403 for UNAUTHENTICATED, 404 for FILE_NOT_FOUND, 500 for others).

### build-file-info.utils.ts
- **buildFileInfo()** — `file:utils/build-file-info.utils.ts:3`, splits filename by dots, extracts extension and generates UUID-based name with extension. Returns {ext, name}.

### check-file-folder.utils.ts
- **checkFileFolder()** — `file:utils/check-file-folder.utils.ts:9`, validates that file path root folder is in allowed FileFolder enum values (case-insensitive kebab-case), throws BadRequestException if invalid, returns FileFolder type.

### get-content-disposition.utils.ts
- **getContentDisposition()** — `file:utils/get-content-disposition.utils.ts:20`, returns 'inline' for safe MIME types (images, PDF, audio, video) or 'attachment' for all others; used in HTTP Content-Disposition header.

### sanitize-file.utils.ts
- **sanitizeFile()** — `file:utils/sanitize-file.utils.ts:4`, sanitizes SVG files via DOMPurify to prevent XSS; converts file to UTF-8 string, sanitizes if SVG extension/mimeType, returns sanitized or original file buffer/string.

### remove-file-folder-from-file-entity-path.utils.ts
- **removeFileFolderFromFileEntityPath()** — `file:utils/remove-file-folder-from-file-entity-path.utils.ts:5`, validates first path segment is valid FileFolder, throws BadRequestException if not, strips folder prefix from path.

### extract-file-info-from-request.utils.ts
- **extractFileInfoFromRequest()** — `file:utils/extract-file-info-from-request.utils.ts:8`, parses Express request path (e.g., /files/profile-picture/original/TOKEN/file.jpg) into segments, validates folder and filename, returns {filename, fileSignature, rawFolder, fileFolder, ignoreExpirationToken}.

### extract-file-info-or-throw.utils.ts
- **extractFileInfoOrThrow()** — `file:utils/extract-file-info-or-throw.utils.ts:20`, detects file MIME type via file-type library with PDF support, falls back to extension-based lookup with TWENTY_MIME_POLICY override, validates against supportedMimeTypes, throws if mismatch detected.

### set-file-response-headers.utils.ts
- **setFileResponseHeaders()** — `file:utils/set-file-response-headers.utils.ts:5`, sets Content-Type, X-Content-Type-Options: nosniff, and Content-Disposition headers based on mimeType.

### check-file-name.utils.ts
- **checkFilename()** — `file:utils/check-file-name.utils.ts:5`, strips null bytes, validates filename is non-empty, has no / or \\ separators, has at least one dot, applies basename normalization, throws BadRequestException if invalid.

### file.controller.ts
- **FileController.getPublicAssets()** — `file:controllers/file.controller.ts:42`, GET /public-assets/:workspaceId/:applicationId/*path, validates filepath against FileFolder.PublicAsset, retrieves file stream via fileService.getFileStreamByPath(), pipes to response with proper headers. Throws FileException on errors.
- **FileController.getFileById()** — `file:controllers/file.controller.ts:110`, GET /file/:fileFolder/:id, validates via FileByIdGuard, calls fileService.getFileResponseById(), redirects to presignedUrl if available or pipes stream to response.

### file-by-id.guard.ts
- **FileByIdGuard.canActivate()** — `file:guards/file-by-id.guard.ts:25`, validates fileFolder is in SUPPORTED_FILE_FOLDERS, verifies JWT token (with optional expiration check), decodes token to extract workspaceId and fileId, sets request.workspaceId, returns false if any check fails.

### file-path-guard.ts
- **FilePathGuard.canActivate()** — `file:guards/file-path-guard.ts:15`, extracts file info from request path, verifies JWT token's workspaceId and filename match, sets request.workspaceId, handles legacy signature-based authentication.

### file.service.ts
- **FileService.getFileStreamByPath()** — `file:services/file.service.ts:39`, verifies application exists, queries FileEntity by path pattern, retrieves file stream from storage service with mimeType, returns null if file/app not found.
- **FileService.getFileStreamById()** — `file:services/file.service.ts:96`, queries FileEntity by id and fileFolder pattern, verifies application exists, retrieves file stream from storage service with error handling.
- **FileService.getFileResponseById()** — `file:services/file.service.ts:155`, queries file by id with folder pattern match, gets presignedUrl from storage if available or reads stream, returns {type: 'redirect', presignedUrl} or {type: 'stream', stream, mimeType}.
- **FileService.getFileContentById()** — `file:services/file.service.ts:223`, retrieves file by id, converts stream to buffer via streamToBuffer utility, returns {buffer, mimeType} for in-memory file access.
- **FileService.deleteWorkspaceFolder()** — `file:services/file.service.ts:284`, checks if workspace folder exists in storage, deletes entire folder if found.

### file-url.service.ts
- **FileUrlService.signWorkspaceLogoUrl()** — `file:file-url/file-url.service.ts:21`, signs workspace logo file ID with JWT token, returns presigned file URL or null if no logoFileId.
- **FileUrlService.signFileByIdUrl()** — `file:file-url/file-url.service.ts:35`, creates JWT payload with fileId/workspaceId/type=FILE, signs with configurable expiration, returns SERVER_URL/file/:fileFolder/:fileId?token=token format.
- **FileUrlService.getLegacyWorkspaceMemberAvatarUrl()** — `file:file-url/file-url.service.ts:64`, returns legacy URL format without token: SERVER_URL/file/:fileFolder/:fileId.

### file-email-attachment.service.ts
- **FileEmailAttachmentService.uploadFile()** — `file:file-email-attachment/services/file-email-attachment.service.ts:23`, extracts file info, generates UUID-based filename, writes to storage with FileFolder.EmailAttachment, signs URL with JWT, returns FileWithSignedUrlDTO.
- **FileEmailAttachmentService.deleteFiles()** — `file:file-email-attachment/services/file-email-attachment.service.ts:71`, deletes multiple email attachment files by fileId, silently logs failures to avoid blocking on individual errors.

### file-email-attachment.resolver.ts
- **FileEmailAttachmentResolver.uploadEmailAttachmentFile()** — `file:file-email-attachment/resolvers/file-email-attachment.resolver.ts:31`, GraphQL mutation, converts stream to buffer, calls uploadFile service method, requires UPLOAD_FILE permission.

### file-workflow.service.ts
- **FileWorkflowService.uploadFile()** — `file:file-workflow/services/file-workflow.service.ts:21`, extracts file info, generates UUID filename, writes to FileFolder.Workflow with isTemporaryFile=true, signs URL, returns FileWithSignedUrlDTO.

### file-workflow.resolver.ts
- **FileWorkflowResolver.uploadWorkflowFile()** — `file:file-workflow/resolvers/file-workflow.resolver.ts:29`, GraphQL mutation, converts stream to buffer, calls uploadFile service, requires UPLOAD_FILE permission.

### file-ai-chat.service.ts
- **FileAiChatService.uploadFile()** — `file:file-ai-chat/services/file-ai-chat.service.ts:21`, extracts file info, generates UUID filename, writes to FileFolder.AgentChat with isTemporaryFile=false, signs URL, returns FileWithSignedUrlDTO.

### file-ai-chat.resolver.ts
- **FileAiChatResolver.uploadAiChatFile()** — `file:file-ai-chat/resolvers/file-ai-chat.resolver.ts:29`, GraphQL mutation, streams to buffer, calls uploadFile, requires UPLOAD_FILE permission.

### file-core-picture.service.ts
- **FileCorePictureService.findCustomApplicationUniversalIdentifier()** — `file:file-core-picture/services/file-core-picture.service.ts:44`, queries workspace to get workspaceCustomApplicationId, throws ApplicationException if not found.
- **FileCorePictureService.uploadCorePicture()** — `file:file-core-picture/services/file-core-picture.service.ts:63`, extracts file info, writes to FileFolder.CorePicture with custom or derived app ID, returns FileEntity, optionally uses queryRunner for transactions.
- **FileCorePictureService.uploadWorkspacePicture()** — `file:file-core-picture/services/file-core-picture.service.ts:102`, uploads picture, updates workspace.logoFileId, deletes old logo if exists, returns FileWithSignedUrlDTO.
- **FileCorePictureService.uploadWorkspaceMemberProfilePicture()** — `file:file-core-picture/services/file-core-picture.service.ts:140`, uploads core picture, signs URL, returns FileWithSignedUrlDTO (used during member onboarding with optional queryRunner).
- **FileCorePictureService.deleteCorePicture()** — `file:file-core-picture/services/file-core-picture.service.ts:173`, finds core picture file, deletes via storage service.
- **FileCorePictureService.fetchImageBufferFromUrl()** — `file:file-core-picture/services/file-core-picture.service.ts:198`, fetches image from URL via secure HTTP client with retries, validates MIME type is image, returns {buffer, extension} or undefined on failure.
- **FileCorePictureService.uploadWorkspaceMemberProfilePictureFromUrl()** — `file:file-core-picture/services/file-core-picture.service.ts:226`, fetches image buffer from URL, uploads as member profile picture, returns FileWithSignedUrlDTO or undefined if fetch fails.
- **FileCorePictureService.uploadWorkspaceLogoFromUrl()** — `file:file-core-picture/services/file-core-picture.service.ts:252`, fetches image buffer from URL, uploads as core picture, returns FileEntity or undefined.
- **FileCorePictureService.copyWorkspaceMemberProfilePicture()** — `file:file-core-picture/services/file-core-picture.service.ts:278`, reads file from source workspace storage, streams to buffer, uploads to target workspace with optional custom app ID.

### file-core-picture.resolver.ts
- **FileCorePictureResolver.uploadWorkspaceLogo()** — `file:file-core-picture/resolvers/file-core-picture.resolver.ts:39`, GraphQL mutation, streams to buffer, calls uploadWorkspacePicture, requires WORKSPACE permission.
- **FileCorePictureResolver.uploadWorkspaceMemberProfilePicture()** — `file:file-core-picture/resolvers/file-core-picture.resolver.ts:55`, GraphQL mutation, streams to buffer, calls uploadWorkspaceMemberProfilePicture, requires UploadProfilePicturePermissionGuard.

### files-field.service.ts
- **FilesFieldService.uploadFile()** — `file:files-field/services/files-field.service.ts:32`, requires fieldMetadataId or fieldMetadataUniversalIdentifier, extracts file info, writes to FileFolder.FilesField/fieldMetadataUniversalIdentifier/filename, signs URL, returns FileWithSignedUrlDTO.
- **FilesFieldService.deleteFilesFieldFile()** — `file:files-field/services/files-field.service.ts:104`, deletes file by fileId from FileFolder.FilesField, throws FilesFieldException on failure.

### files-field.resolver.ts
- **FilesFieldResolver.uploadFilesFieldFile()** — `file:files-field/resolvers/files-field.resolver.ts:29`, GraphQL mutation, streams to buffer, calls uploadFile with fieldMetadataId, requires UPLOAD_FILE permission.
- **FilesFieldResolver.uploadFilesFieldFileByUniversalIdentifier()** — `file:files-field/resolvers/files-field.resolver.ts:54`, GraphQL mutation, streams to buffer, calls uploadFile with fieldMetadataUniversalIdentifier, requires UPLOAD_FILE permission.

### file-deletion.job.ts
- **FileDeletionJob.handle()** — `file:jobs/file-deletion.job.ts:19`, BullMQ job processor, deletes file by fileId from specified fileFolder via fileStorageService, throws error if deletion fails.

### file-workspace-folder-deletion.job.ts
- **FileWorkspaceFolderDeletionJob.handle()** — `file:jobs/file-workspace-folder-deletion.job.ts:15`, BullMQ job processor, calls fileService.deleteWorkspaceFolder() to delete entire workspace folder structure.

### files-field-deletion.job.ts
- **FilesFieldDeletionJob.handle()** — `file:files-field/jobs/files-field-deletion.job.ts:22`, BullMQ job processor, iterates fileIds array, deletes each via filesFieldService.deleteFilesFieldFile(), silently logs individual failures.

---

## file-storage - Low-Level Storage Abstraction

### file-storage.service.ts
- **FileStorageService.buildStoragePathWithinWorkspaceOrThrow()** — `file-storage:file-storage.service.ts:42`, constructs storage path in format workspaceId/appUniversalIdentifier/fileFolder/relativePath, validates path is within workspace boundaries, returns {onStoragePath, resourcePath}.
- **FileStorageService.validateAndBuildFileStoragePathOrThrow()** — `file-storage:file-storage.service.ts:71`, validates file path against fileFolder rules and segment safety, builds storage paths, throws FileStorageException on validation failure.
- **FileStorageService.validateAndBuildFolderStoragePathOrThrow()** — `file-storage:file-storage.service.ts:96`, validates folder path safety (no extensions allowed), builds paths with trailing slash.
- **FileStorageService.writeFile()** — `file-storage:file-storage.service.ts:122`, validates path, prepares file (extract info and sanitize), writes to driver, upserts FileEntity with path/mimeType/size/settings via queryRunner if provided.
- **FileStorageService.getPresignedUrl()** — `file-storage:file-storage.service.ts:197`, validates path, calls driver.getPresignedUrl with expiration and response headers.
- **FileStorageService.readFile()** — `file-storage:file-storage.service.ts:216`, validates path, calls driver.readFile, returns Readable stream.
- **FileStorageService.downloadFile()** — `file-storage:file-storage.service.ts:225`, validates path, calls driver.downloadFile to download file to local path.
- **FileStorageService.deleteApplicationFiles()** — `file-storage:file-storage.service.ts:238`, finds application, deletes entire app folder via driver, deletes all FileEntity records for app.
- **FileStorageService.deleteFile()** — `file-storage:file-storage.service.ts:263`, validates path, calls driver.delete, removes FileEntity record from DB.
- **FileStorageService.deleteByFileId()** — `file-storage:file-storage.service.ts` (continuation), finds file by id and folder pattern, constructs path, calls deleteFile.
- **FileStorageService.checkIfWorkspaceFolderExists()** — `file-storage:file-storage.service.ts` (continuation), calls driver.checkFolderExists for workspace root.
- **FileStorageService.deleteWorkspaceFolder()** — `file-storage:file-storage.service.ts` (continuation), calls driver.delete for entire workspace folder.

### file-storage-driver.factory.ts
- **FileStorageDriverFactory.buildConfigKey()** — `file-storage:file-storage-driver.factory.ts:26`, generates cache key based on storage type (LOCAL: local|path, S3: s3|configHash).
- **FileStorageDriverFactory.createDriver()** — `file-storage:file-storage-driver.factory.ts:46`, instantiates LocalDriver or S3Driver based on STORAGE_TYPE config, wraps in ValidatedStorageDriver for path safety validation.

### validated-storage.driver.ts
- **ValidatedStorageDriver** — `file-storage:drivers/validated-storage.driver.ts:7`, decorator pattern wrapping StorageDriver, validates all path parameters via assertStoragePathIsSafe() before delegating to underlying driver (prevents path traversal/null bytes).

### local.driver.ts
- **LocalDriver.readFile()** — `file-storage:drivers/local.driver.ts:38`, resolves real path, validates within storage root, returns read stream, throws FILE_NOT_FOUND or access errors.
- **LocalDriver.writeFile()** — `file-storage:drivers/local.driver.ts:67`, resolves folder path, creates directory, checks for symlinks, writes file via fs.writeFile.
- **LocalDriver.downloadFile()** — `file-storage:drivers/local.driver.ts:100`, resolves file path, validates within storage root, creates local directory, writes file content locally.
- **LocalDriver.downloadFolder()** — `file-storage:drivers/local.driver.ts:128`, recursively downloads folder structure from storage to local path.
- **LocalDriver.uploadFolder()** — `file-storage:drivers/local.driver.ts:189`, recursively uploads folder structure from local path to storage.
- **LocalDriver.delete()** — `file-storage:drivers/local.driver.ts:216`, removes file or folder (recursive) via fs.rm.
- **LocalDriver.move()** — `file-storage:drivers/local.driver.ts:229`, moves/renames file or folder, creates destination folder first.
- **LocalDriver.copy()** — `file-storage:drivers/local.driver.ts:261`, recursively copies file or folder, creates destination folder first.
- **LocalDriver.checkFileExists()** — `file-storage:drivers/local.driver.ts:297`, returns existsSync check result.
- **LocalDriver.checkFolderExists()** — `file-storage:drivers/local.driver.ts:307`, returns existsSync check result for folder.
- **LocalDriver.getPresignedUrl()** — `file-storage:drivers/local.driver.ts:303`, always returns null (local storage has no presigned URLs).

### s3.driver.ts
- **S3Driver.readFile()** — `file-storage:drivers/s3.driver.ts:74`, sends GetObjectCommand, returns Readable from file Body, throws FILE_NOT_FOUND on NoSuchKey.
- **S3Driver.writeFile()** — `file-storage:drivers/s3.driver.ts:100`, sends PutObjectCommand with mimeType ContentType.
- **S3Driver.downloadFile()** — `file-storage:drivers/s3.driver.ts:119`, reads file via readFile, pipes to local write stream.
- **S3Driver.downloadFolder()** — `file-storage:drivers/s3.driver.ts:132`, lists S3 objects with folder prefix, downloads each to local path recursively.
- **S3Driver.delete()** — `file-storage:drivers/s3.driver.ts` (continuation), deletes single object or multiple objects via DeleteObjectCommand/DeleteObjectsCommand (batched).
- **S3Driver.move()** — `file-storage:drivers/s3.driver.ts` (continuation), copies object from source to destination, deletes source.
- **S3Driver.copy()** — `file-storage:drivers/s3.driver.ts` (continuation), copies object recursively for folders via CopyObjectCommand.
- **S3Driver.getPresignedUrl()** — `file-storage:drivers/s3.driver.ts` (continuation), generates presigned URL via getSignedUrl with optional custom endpoint and response headers.
- **S3Driver.checkFileExists()** — `file-storage:drivers/s3.driver.ts` (continuation), sends HeadObjectCommand, returns true if exists.
- **S3Driver.checkFolderExists()** — `file-storage:drivers/s3.driver.ts` (continuation), lists objects with folder prefix, returns true if any exist.

### prepare-file-for-storage-or-throw.util.ts
- **prepareFileForStorageOrThrow()** — `file-storage:utils/prepare-file-for-storage-or-throw.util.ts:4`, converts sourceFile to buffer, extracts file info via extractFileInfoOrThrow, sanitizes via sanitizeFile, returns {sourceFile, mimeType}.

### validate-file-extension.util.ts
- **validateFileExtension()** — `file-storage:utils/validate-file-extension.util.ts:8`, checks if resource path extension matches allowedExtensions for fileFolder, returns validation result with error message.

### assert-storage-path-is-safe.util.ts
- **assertStoragePathIsSafe()** — `file-storage:utils/assert-storage-path-is-safe.util.ts:8`, validates path has no null bytes, is not absolute, contains no '..' segments, throws FileStorageException if unsafe.

### validate-path-segments-safety.util.ts
- **validatePathSegmentsSafety()** — `file-storage:utils/validate-path-segments-safety.util.ts:9`, checks path length <= 1024, segments <= 255 chars, matches alphanumeric/dot/dash/underscore pattern, no empty segments or trailing slashes.

### validate-file-path.util.ts
- **validateFilePath()** — `file-storage:utils/validate-file-path.util.ts:9`, chains validation: safe relative path → path segments safety → filename has extension → file extension allowed. Returns ResourcePathValidationResult.

### validate-folder-path.util.ts
- **validateFolderPath()** — `file-storage:utils/validate-folder-path.util.ts:9`, chains validation: safe relative path → path segments safety → folder must not have extension. Returns ResourcePathValidationResult.

### validate-storage-path-is-within-workspace-or-throw.util.ts
- **validateStoragePathIsWithinWorkspaceOrThrow()** — `file-storage:utils/validate-storage-path-is-within-workspace-or-throw.util.ts:10`, normalizes path and expected prefix, verifies path starts with workspaceId/appIdentifier/fileFolder/, throws ACCESS_DENIED if not.

---

## search - Global Full-Text Search

### search.service.ts
- **SearchService.getAllRecordsWithObjectMetadataItems()** — `search:services/search.service.ts:68`, filters object metadata items by inclusion/exclusion/searchability, chunks into OBJECT_METADATA_ITEMS_CHUNK_SIZE groups, executes search queries in parallel per object, returns all matching records with metadata.
- **SearchService.filterObjectMetadataItems()** — `search:services/search.service.ts:142`, filters by active status, applies explicit inclusion (if provided) and exclusion, filters by searchability if no explicit inclusion, excludes channel-constrained objects when explicitly included.
- **SearchService.buildSearchQueryAndGetRecordsWithFallback()** — `search:services/search.service.ts:192`, runs fast tsvector query first (GIN index), falls back to ILIKE on searchVector text if tsvector returns 0 results and not paginated and search is non-empty. Skips fallback if any tsvector results.
- **SearchService.buildSearchQueryAndGetRecords()** — `search:services/search.service.ts:246`, creates QueryBuilder for object, applies tsvector full-text search with AND/OR operators, applies filter constraints, applies pagination/ordering, executes query.
- **SearchService.buildIlikeFallbackQuery()** — `search:services/search.service.ts` (continuation), runs ILIKE-based fallback when tsvector tokenization may fail (CJK text, etc.).
- **SearchService.computeSearchObjectResults()** — `search:services/search.service.ts` (continuation), merges results from multiple object types, ranks by tsvector score, deduplicates, applies pagination with cursor encoding, formats as SearchResultConnectionDTO.

### search.resolver.ts
- **SearchResolver.search()** — `search:search.resolver.ts:30`, GraphQL Query, accepts searchInput/limit/filter/includedObjectNameSingulars/excludedObjectNameSingulars/after args, caches flat entity maps, calls searchService methods, returns SearchResultConnectionDTO with paginated results.

---

## emailing-domain - Email Domain Management

### emailing-domain.service.ts
- **EmailingDomainService.createEmailingDomain()** — `emailing-domain:services/emailing-domain.service.ts:29`, checks domain not already registered, provisions workspace on driver, verifies domain, registers domain, saves EmailingDomainEntity with verification records and status.
- **EmailingDomainService.deleteEmailingDomain()** — `emailing-domain:services/emailing-domain.service.ts:75`, finds domain, deletes remote domain via driver, deletes local entity.
- **EmailingDomainService.cleanupEmailingDomainsForWorkspace()** — `emailing-domain:services/emailing-domain.service.ts:90`, cleanups multiple domains in parallel, deprovisioned workspace after cleanup, throws if any cleanup fails.
- **EmailingDomainService.getEmailingDomains()** — `emailing-domain:services/emailing-domain.service.ts:116`, returns all emailing domains for workspace sorted by createdAt descending.
- **EmailingDomainService.verifyEmailingDomain()** — `emailing-domain:services/emailing-domain.service.ts:124`, verifies domain status, updates entity with verification records, sets verifiedAt timestamp if just became verified.
- **EmailingDomainService.sendEmail()** — `emailing-domain:services/emailing-domain.service.ts:160`, validates domain is verified and tenant status is ACTIVE, validates from address matches domain, calls driver.sendEmail.

### emailing-domain-tenant-status.service.ts
- **EmailingDomainTenantStatusService.setTenantStatusForWorkspace()** — `emailing-domain:services/emailing-domain-tenant-status.service.ts:19`, updates all non-permanently-suspended domains in workspace to target tenantStatus, logs count of affected domains.

### emailing-domain.resolver.ts
- **EmailingDomainResolver.createEmailingDomain()** — `emailing-domain:emailing-domain.resolver.ts:35`, GraphQL mutation, calls createEmailingDomain service, requires IS_EMAIL_GROUP_ENABLED feature flag and WORKSPACE permission.
- **EmailingDomainResolver.deleteEmailingDomain()** — `emailing-domain:emailing-domain.resolver.ts:52`, GraphQL mutation, calls deleteEmailingDomain service, returns boolean.
- **EmailingDomainResolver.verifyEmailingDomain()** — `emailing-domain:emailing-domain.resolver.ts:63`, GraphQL mutation, calls verifyEmailingDomain service, returns updated EmailingDomainDTO.
- **EmailingDomainResolver.sendEmailViaEmailingDomain()** — `emailing-domain:emailing-domain.resolver.ts:78`, GraphQL mutation, extracts emailingDomainId and email content, calls sendEmail service, returns {messageId}.
- **EmailingDomainResolver.getEmailingDomains()** — `emailing-domain:emailing-domain.resolver.ts:92`, GraphQL query, calls getEmailingDomains service, returns array of EmailingDomainDTO.

---

## domain - Workspace & Custom Domain Management

### subdomain-manager.service.ts
- **SubdomainManagerService.generateSubdomain()** — `domain:subdomain-manager/services/subdomain-manager.service.ts:26`, extracts subdomain from user email or workspace display name, validates and uses if valid, falls back to random subdomain, appends random suffix if collision exists.
- **SubdomainManagerService.isSubdomainAvailable()** — `domain:subdomain-manager/services/subdomain-manager.service.ts:56`, queries workspace (including deleted) by subdomain, returns true if no workspace with that subdomain exists.
- **SubdomainManagerService.validateSubdomainOrThrow()** — `domain:subdomain-manager/services/subdomain-manager.service.ts:65`, validates format with isSubdomainValid(), checks availability and is not DEFAULT_SUBDOMAIN, throws WorkspaceException if invalid/taken.

### workspace-domains.service.ts
- **WorkspaceDomainsService.buildWorkspaceURL()** — `domain:workspace-domains/services/workspace-domains.service.ts:29`, selects custom URL if enabled else subdomain URL, builds URL with pathname and searchParams.
- **WorkspaceDomainsService.computeWorkspaceRedirectErrorUrl()** — `domain:workspace-domains/services/workspace-domains.service.ts:49`, builds workspace URL with errorMessage as searchParam.
- **WorkspaceDomainsService.getDefaultWorkspace()** — `domain:workspace-domains/services/workspace-domains.service.ts:63`, in single-workspace mode, returns first workspace or SEED_APPLE_WORKSPACE_ID if exists, throws error if multi-workspace enabled.
- **WorkspaceDomainsService.getWorkspaceByOriginOrDefaultWorkspace()** — `domain:workspace-domains/services/workspace-domains.service.ts:93`, resolves workspace from origin, returns default workspace if single-workspace mode.
- **WorkspaceDomainsService.resolveWorkspaceAndPublicDomain()** — `domain:workspace-domains/services/workspace-domains.service.ts:99`, parses origin to extract subdomain/domain, resolves workspace by custom domain or subdomain or public domain, returns {workspace, publicDomain}.
- **WorkspaceDomainsService.getSubdomainAndCustomDomainFromWorkspaceFallbackOnDefaultSubdomain()** — `domain:workspace-domains/services/workspace-domains.service.ts:167`, extracts subdomain and customDomain flags from workspace, falls back to DEFAULT_SUBDOMAIN if no workspace.
- **WorkspaceDomainsService.getWorkspaceUrls()** — `domain:workspace-domains/services/workspace-domains.service.ts:189`, returns {customUrl, subdomainUrl} based on isCustomDomainEnabled flag.
- **WorkspaceDomainsService.findByCustomDomain()** — `domain:workspace-domains/services/workspace-domains.service.ts:203`, queries workspace by customDomain.

### custom-domain-manager.service.ts
- **CustomDomainManagerService.isCustomDomainEnabled()** — `domain:custom-domain-manager/services/custom-domain-manager.service.ts:36`, checks workspace has CUSTOM_DOMAIN billing entitlement, throws WorkspaceException if not.
- **CustomDomainManagerService.setCustomDomain()** — `domain:custom-domain-manager/services/custom-domain-manager.service.ts:51`, checks entitlement, validates domain not taken by other workspace or public domain, registers/updates domain via dnsManagerService.
- **CustomDomainManagerService.checkCustomDomainValidRecords()** — `domain:custom-domain-manager/services/custom-domain-manager.service.ts:93`, gets hostname with DNS records, checks if domain is working via dnsManagerService, updates workspace.isCustomDomainEnabled if status changed, logs audit event.

### domain-server-config.service.ts
- **DomainServerConfigService.getFrontUrl()** — `domain:domain-server-config/services/domain-server-config.service.ts:10`, returns URL object from FRONTEND_URL or SERVER_URL config.
- **DomainServerConfigService.getBaseUrl()** — `domain:domain-server-config/services/domain-server-config.service.ts:17`, gets front URL, prepends DEFAULT_SUBDOMAIN if multi-workspace enabled.
- **DomainServerConfigService.getPublicDomainUrl()** — `domain:domain-server-config/services/domain-server-config.service.ts:30`, returns URL from PUBLIC_DOMAIN_URL config.
- **DomainServerConfigService.buildBaseUrl()** — `domain:domain-server-config/services/domain-server-config.service.ts:34`, constructs URL with pathname and searchParams appended.
- **DomainServerConfigService.getSubdomainAndDomainFromUrl()** — `domain:domain-server-config/services/domain-server-config.service.ts:48`, parses URL hostname, extracts subdomain if matches front domain pattern, returns {subdomain, domain}.
- **DomainServerConfigService.isDefaultSubdomain()** — `domain:domain-server-config/services/domain-server-config.service.ts:66`, checks if subdomain matches DEFAULT_SUBDOMAIN config.

---

## messaging-webhooks - AWS SES/SNS Webhook Integration

### messaging-webhooks.controller.ts
- **MessagingWebhooksController.handleSesInboundWebhook()** — `messaging-webhooks:messaging-webhooks.controller.ts:33`, POST /webhooks/messaging/ses/inbound, validates rawBody exists, routes to sesInboundWebhookRouterService, returns 200.
- **MessagingWebhooksController.handleSesOutboundWebhook()** — `messaging-webhooks:messaging-webhooks.controller.ts:46`, POST /webhooks/messaging/ses/outbound, validates rawBody exists, routes to sesOutboundWebhookRouterService, returns 200.

### sns-subscription-confirmer.service.ts
- **SnsSubscriptionConfirmerService.confirm()** — `messaging-webhooks:services/sns-subscription-confirmer.service.ts:13`, validates subscribeUrl is defined and matches SNS AWS pattern, fetches URL via fetch(), throws on non-2xx response.

### sns-signature-verifier.service.ts
- **SnsSignatureVerifierService.assertAllowedAndSigned()** — `messaging-webhooks:services/sns-signature-verifier.service.ts:18`, checks TopicArn against SES_SNS_TOPIC_ARN_ALLOWLIST config, validates SNS payload signature via validator library, throws if not allowed or signature invalid.

### ses-outbound-sending-state-handler.service.ts
- **SesOutboundSendingStateHandlerService.handle()** — `messaging-webhooks:services/ses-outbound-sending-state-handler.service.ts:19`, parses 'Sending Status Enabled'/'Sending Status Disabled' detail-type event, extracts workspaceId from resource ARNs, updates emailingDomainTenantStatus accordingly (ACTIVE or PAUSED).

### ses-inbound-mail-handler.service.ts
- **SesInboundMailHandlerService.handle()** — `messaging-webhooks:services/ses-inbound-mail-handler.service.ts:21`, validates receipt.action.type is 'S3', queues MessagingInboundEmailImportJob with s3Key and envelopeRecipients using SNS messageId as job ID.

### ses-inbound-webhook-router.service.ts
- **SesInboundWebhookRouterService.route()** — `messaging-webhooks:services/ses-inbound-webhook-router.service.ts:23`, parses SNS payload JSON, verifies signature and topic allowlist, handles SubscriptionConfirmation/UnsubscribeConfirmation types, extracts and processes SesInboundNotification for Notification type.

### ses-outbound-webhook-router.service.ts
- **SesOutboundWebhookRouterService.route()** — `messaging-webhooks:services/ses-outbound-webhook-router.service.ts:23`, parses SNS payload JSON, verifies signature and topic allowlist, handles subscription confirmations, extracts and processes SesEventBridgeNotification for sending-state events.

### parse-workspace-id-from-aws-ses-resource-arn.util.ts
- **parseWorkspaceIdFromAwsSesResourceArn()** — `messaging-webhooks:utils/parse-workspace-id-from-aws-ses-resource-arn.util.ts:4`, extracts resource name from ARN after /, validates prefix matches AWS_SES_RESOURCE_NAME_PREFIX constant, returns workspaceId or null.

### get-messaging-webhook-exception-status-code.util.ts
- **getMessagingWebhookExceptionStatusCode()** — `messaging-webhooks:utils/get-messaging-webhook-exception-status-code.util.ts:6`, maps MessagingWebhookExceptionCode to HTTP status: 400 for missing/invalid payload/subscribe-url, 403 for forbidden-topic/invalid-signature, 500 for confirmation-failed/unhandled.

---

## emailing-domain — AWS SES Driver Layer

### aws-ses-driver.service.ts
- **AwsSesDriver.verifyDomain()** — `emailing-domain:drivers/aws-ses/services/aws-ses-driver.service.ts:48`, queries SES email-identity DKIM/verification state for a domain, maps AWS attributes to the driver's verification-record + status shape, runs error through AwsSesHandleErrorService.
- **AwsSesDriver.getDomainStatus()** — `emailing-domain:drivers/aws-ses/services/aws-ses-driver.service.ts:75`, fetches current SES identity status and DKIM tokens, returns EmailingDomainStatus with verification records.
- **AwsSesDriver.provisionWorkspace()** — `emailing-domain:drivers/aws-ses/services/aws-ses-driver.service.ts:114`, ensures a SES tenant exists for the workspace via `ensureTenantExists`.
- **AwsSesDriver.registerDomain()** — `emailing-domain:drivers/aws-ses/services/aws-ses-driver.service.ts:129`, delegates to AwsSesRegisterDomainService to create the email identity + MAIL FROM domain.
- **AwsSesDriver.sendEmail()** — `emailing-domain:drivers/aws-ses/services/aws-ses-driver.service.ts:133`, delegates to AwsSesSendEmailService.
- **AwsSesDriver.cleanupDomain()** — `emailing-domain:drivers/aws-ses/services/aws-ses-driver.service.ts:143`, deletes the SES email identity and associated resources for a workspace's domain.
- **AwsSesDriver.deprovisionWorkspace()** — `emailing-domain:drivers/aws-ses/services/aws-ses-driver.service.ts:166`, tears down the SES tenant after all domains for the workspace are removed.
- **AwsSesDriver.ensureTenantExists()** (private) — `:219`, creates a SES tenant named per workspace if missing, idempotent on already-exists.
- **AwsSesDriver.createOrUpdateEmailIdentity()** (private) — `:235`, upserts the SES email identity, calling createNewEmailIdentity when absent.
- **AwsSesDriver.createNewEmailIdentity()** (private) — `:267`, sends CreateEmailIdentity then enables DKIM.
- **AwsSesDriver.associateResourceWithTenant()** (private) — `:297`, associates the email identity resource ARN with the workspace tenant.
- **AwsSesDriver.enableDkimSigning()** (private) — `:323`, enables Easy DKIM signing on the identity.

### aws-ses-register-domain.service.ts
- **AwsSesRegisterDomainService.provisionWorkspaceResources()** — `emailing-domain:drivers/aws-ses/services/aws-ses-register-domain.service.ts:30`, runs the full SES setup sequence (configuration set, event destinations / SNS topic, MAIL FROM) for a workspace using the shared SES client from AwsSesClientProvider; logs each step.
- **AwsSesRegisterDomainService.registerDomain()** — `:120`, configures the MAIL FROM domain (bounce subdomain) for the given domain and logs completion.

### aws-ses-send-email.service.ts
- **AwsSesSendEmailService.sendEmail()** — `emailing-domain:drivers/aws-ses/services/aws-ses-send-email.service.ts:34`, throws CONFIGURATION_ERROR if `to` is empty, builds a SES v2 `SendEmailCommand` (Simple content: subject + text/optional-html, attachments mapped to {FileName, RawContent, ContentType}, To/Cc/Bcc/ReplyTo), sends via the SES client and returns the result.

### aws-ses-handle-error.service.ts
- **AwsSesHandleErrorService.handleAwsSesError()** — `emailing-domain:drivers/aws-ses/services/aws-ses-handle-error.service.ts:11`, `(error, context?): never`, maps AWS SDK error names/types to EmailingDomainDriverException with the appropriate EmailingDomainDriverExceptionCode and always throws (return type `never`).

### aws-ses-client.provider.ts
- **AwsSesClientProvider.getSESClient()** — `emailing-domain:drivers/aws-ses/providers/aws-ses-client.provider.ts:16`, lazily constructs/returns a configured AWS `SESClient` (v2) from TwentyConfigService region/credentials.

### emailing-domain-driver.factory.ts
- **EmailingDomainDriverFactory.buildConfigKey()** — `emailing-domain:drivers/emailing-domain-driver.factory.ts:30`, extends DriverFactoryBase; returns a cache key combining the configured driver and a config-group hash (AWS_SES settings) so the driver is rebuilt when SES config changes; throws on unsupported driver.
- **EmailingDomainDriverFactory.createDriver()** — `:44`, reads AWS_SES_REGION / ACCOUNT_ID / credentials from config and instantiates AwsSesDriver; throws on invalid driver.

### emailing-domain-workspace-cleanup.job.ts
- **EmailingDomainWorkspaceCleanupJob.handle()** — `emailing-domain:jobs/emailing-domain-workspace-cleanup.job.ts:16`, `@Processor(deleteCascadeQueue)` + `@Process`, calls EmailingDomainService cleanup for the workspace when a workspace is destroyed.

### AWS SES constants
- `emailing-domain:drivers/aws-ses/constants/*` — `AWS_SES_EVENT_BUS_NAME='default'`, `AWS_SES_MAIL_FROM_SUBDOMAIN='bounce'`, `AWS_SES_MARKETING_TOPIC_NAME='marketing'`, `AWS_SES_RESOURCE_NAME_PREFIX='twenty-workspace'` (the prefix used by `parseWorkspaceIdFromAwsSesResourceArn`).

### driver-config.interface.ts
- **AwsSesDriverConfig / BaseDriverConfig** — `emailing-domain:drivers/interfaces/driver-config.interface.ts:3`, config shapes: base `{driver}`; AWS variant adds `{region, accountId, accessKeyId?, secretAccessKey?, sessionToken?}`.

---

## file-storage — Additional Utils & Validators

### has-allowed-extension.util.ts
- **hasAllowedExtension()** — `file-storage:utils/has-allowed-extension.util.ts:3`, lowercases `extname(filePath)` and returns true only if `allowedExtensions[ext] === true` (a `Record<string,true>` lookup map).

### is-safe-relative-path.util.ts
- **isSafeRelativePath()** — `file-storage:utils/is-safe-relative-path.util.ts:3`, boolean predicate: false on empty, null-byte, absolute, backslash-containing, or `..`-segment paths (after `normalize`); otherwise true.

### validate-safe-relative-path.util.ts
- **validateSafeRelativePath()** — `file-storage:utils/validate-safe-relative-path.util.ts:7`, same checks as `isSafeRelativePath` but returns a `ResourcePathValidationResult` with a localized `t\`…\`` error message per failure (empty / null bytes / absolute / backslashes / path traversal).

### read-file-content.ts
- **readFileContent()** — `file-storage:utils/read-file-content.ts:3`, async-iterates a `Readable` stream, collects chunks into Buffers, returns the concatenated content as a UTF-8 string.

### is-safe-relative-path.validator.ts
- **IsSafeRelativePath()** — `file-storage:validators/is-safe-relative-path.validator.ts:9`, class-validator decorator whose constraint `validate(value)` delegates to `isSafeRelativePath`; used on DTO path fields.

### resource-path-validation-result.type.ts
- **ResourcePathValidationResult** — `file-storage:types/resource-path-validation-result.type.ts`, discriminated result `{isValid: true} | {isValid: false, error: string}` returned by all path validators.

### allowed-extensions-by-application-file-folder.constant.ts
- **ALLOWED_EXTENSIONS_BY_APPLICATION_FILE_FOLDER** — `file-storage:constants/allowed-extensions-by-application-file-folder.constant.ts`, per-FileFolder maps of allowed file extensions consumed by `validateFileExtension` / `hasAllowedExtension`.

---

## search — Additional Utils

### escape-for-ilike.ts
- **escapeForIlike()** — `search:utils/escape-for-ilike.ts:1`, escapes the SQL LIKE special chars `\ % _` with a leading backslash (`value.replace(/[\\%_]/g, '\\$&')`) before building the ILIKE fallback query.

### format-search-terms.ts
- **formatSearchTerms()** — `search:utils/format-search-terms.ts:1`, `(searchTerm, operator='and')`, returns '' for blank input; otherwise splits on whitespace, escapes tsquery-special chars `\ : ' & | ! ( ) @ < >`, appends `:*` (prefix match) to each word, and joins with ` & ` (and) or ` | ` (or) for a Postgres `to_tsquery` expression.

---

## domain — Subdomain & URL Utils

### subdomain-manager/utils

- **generateRandomSubdomain()** — `domain:subdomain-manager/utils/generate-random-subdomain.util.ts:1`, picks a random prefix, color, and animal suffix from fixed word lists and joins them as `prefix-color-suffix` (e.g. `brave-azure-otter`).
- **getSubdomainFromEmail()** — `domain:subdomain-manager/utils/get-subdomain-from-email.util.ts:6`, returns undefined for missing or non-work emails; otherwise takes the domain name's first label, lowercased.
- **getSubdomainNameFromDisplayName()** — `domain:subdomain-manager/utils/get-subdomain-name-from-display-name.util.ts:2`, returns undefined if no display name; otherwise matches word/digit runs, joins with `-`, strips spaces, lowercases.
- **isSubdomainValid()** — `domain:subdomain-manager/utils/is-subdomain-valid.util.ts:4`, true only if `isValidTwentySubdomain(subdomain)` and the lowercased value is not in `RESERVED_SUBDOMAINS`.

### domain-server-config/utils

- **appendSearchParamsToUrl()** — `domain:domain-server-config/utils/append-search-params-to-url.util.ts:1`, mutates a `URL` by setting each entry of a `Record<string, string|number|boolean>` as a stringified search param.
- **buildUrlWithPathnameAndSearchParams()** — `domain:domain-server-config/utils/build-url-with-pathname-and-search-params.util.ts:9`, sets `url.pathname` when a pathname is given and appends searchParams via `appendSearchParamsToUrl`, returning the URL.

---

## file — Additional Listener & Util

### files-field-deletion.listener.ts
- **FilesFieldDeletionListener.handleDestroyedEvent()** — `file:files-field/listeners/files-field-deletion.listener.ts:37`, `@OnDatabaseBatchEvent('*', DatabaseEventAction.DESTROYED)`, reacts to any record destruction and enqueues files-field file deletions for the affected FilesField values.

### extract-file-id-from-url.util.ts
- **extractFileIdFromUrl()** — `file:files-field/utils/extract-file-id-from-url.util.ts:4`, parses a URL (returns null on parse failure or if the pathname is external to `/file/{fileFolder}/`), extracts the id segment after the folder, and returns it only if it is a valid UUID, else null.

---

## NOT YET COVERED

Only genuinely-trivial leftovers remain (locale catalog files, GraphQL DTO/input/entity field-only classes, exception-code enums, plain provider/module wiring files, and AWS SES type aliases like `aws-ses-error.type.ts`, `send-email.ts`, `verifications-record.ts`).

