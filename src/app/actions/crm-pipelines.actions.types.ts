/**
 * Types extracted from crm-pipelines.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface CrmPipelineKpis {
    /** Total number of pipelines for the tenant. */
    total: number;
    /** Total value of deals currently in flight across all pipelines. */
    inFlightValue: number;
    /** Average days a deal spends in pipeline (open deals only). */
    avgVelocityDays: number;
    /** Name of the pipeline with the most deals attached. */
    topPipelineName: string;
    /** Currency code observed on the bulk of in-flight deals (best-effort). */
    currency: string;
}
