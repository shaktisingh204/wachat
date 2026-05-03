/**
 * Analytics & BI Suite — public barrel.
 *
 * Import from this module rather than reaching into individual files
 * so future re-organisation is non-breaking.
 */

export * from './types';
export {
    recordMetric,
    queryMetric,
    readWindow,
} from './metrics';
export {
    createReport,
    listReports,
    getReport,
    runReport,
    runReportDefinition,
    compile as compileReport,
} from './reports';
export { computeFunnel } from './funnels';
export { computeCohort } from './cohorts';
export { attributeRevenue } from './attribution';
export {
    BigQueryAdapter,
    SnowflakeAdapter,
    PostgresAdapter,
    adapterFor,
    mirrorBatch,
    type MirrorAdapter,
    type MirrorPushResult,
} from './warehouse';
export { evaluateAlerts, upsertAlertRule } from './alerts';
export { signDashboardUrl, verifyEmbedToken } from './embedded';
