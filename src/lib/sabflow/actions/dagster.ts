'use server';

export async function executeDagsterAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const graphqlUrl = `${inputs.serverUrl}/graphql`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (inputs.userToken) {
            headers['Authorization'] = `Bearer ${inputs.userToken}`;
        }

        const gql = async (query: string, variables: Record<string, any> = {}) => {
            const res = await fetch(graphqlUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query, variables }),
            });
            if (!res.ok) throw new Error(`Dagster GraphQL request failed: ${res.status} ${await res.text()}`);
            const json = await res.json();
            if (json.errors) throw new Error(`Dagster GraphQL errors: ${JSON.stringify(json.errors)}`);
            return json.data;
        };

        switch (actionName) {
            case 'listJobs': {
                const data = await gql(`
                    query ListJobs($repositorySelector: RepositorySelector!) {
                        jobsOrError(repositorySelector: $repositorySelector) {
                            ... on Jobs { results { name description pipelineSnapshotId } }
                            ... on RepositoryNotFoundError { message }
                            ... on PythonError { message }
                        }
                    }
                `, { repositorySelector: inputs.repositorySelector || {} });
                return { output: data };
            }
            case 'getJob': {
                const data = await gql(`
                    query GetJob($selector: PipelineSelector!) {
                        pipelineOrError(params: $selector) {
                            ... on Pipeline { name description modes { name } }
                            ... on PipelineNotFoundError { message }
                            ... on PythonError { message }
                        }
                    }
                `, { selector: inputs.selector });
                return { output: data };
            }
            case 'launchRun': {
                const data = await gql(`
                    mutation LaunchRun($executionParams: ExecutionParams!) {
                        launchRun(executionParams: $executionParams) {
                            ... on LaunchRunSuccess { run { runId status } }
                            ... on RunConfigValidationInvalid { message }
                            ... on PipelineNotFoundError { message }
                            ... on PythonError { message }
                        }
                    }
                `, { executionParams: inputs.executionParams });
                return { output: data };
            }
            case 'getRun': {
                const data = await gql(`
                    query GetRun($runId: ID!) {
                        runOrError(runId: $runId) {
                            ... on Run { runId status pipelineName startTime endTime }
                            ... on RunNotFoundError { message }
                            ... on PythonError { message }
                        }
                    }
                `, { runId: inputs.runId });
                return { output: data };
            }
            case 'terminateRun': {
                const data = await gql(`
                    mutation TerminateRun($runId: String!, $terminatePolicy: TerminateRunPolicy) {
                        terminateRun(runId: $runId, terminatePolicy: $terminatePolicy) {
                            ... on TerminateRunSuccess { run { runId status } }
                            ... on TerminateRunFailure { message }
                            ... on RunNotFoundError { message }
                            ... on PythonError { message }
                        }
                    }
                `, { runId: inputs.runId, terminatePolicy: inputs.terminatePolicy || 'SAFE_TERMINATE' });
                return { output: data };
            }
            case 'deleteRun': {
                const data = await gql(`
                    mutation DeleteRun($runId: String!) {
                        deleteRun(runId: $runId) {
                            ... on DeletePipelineRunSuccess { runId }
                            ... on RunNotFoundError { message }
                            ... on PythonError { message }
                        }
                    }
                `, { runId: inputs.runId });
                return { output: data };
            }
            case 'listRuns': {
                const data = await gql(`
                    query ListRuns($filter: RunsFilter, $limit: Int, $cursor: String) {
                        runsOrError(filter: $filter, limit: $limit, cursor: $cursor) {
                            ... on Runs { results { runId status pipelineName startTime endTime } cursor }
                            ... on InvalidPipelineRunsFilterError { message }
                            ... on PythonError { message }
                        }
                    }
                `, {
                    filter: inputs.filter || {},
                    limit: inputs.limit || 20,
                    cursor: inputs.cursor,
                });
                return { output: data };
            }
            case 'listAssets': {
                const data = await gql(`
                    query ListAssets($prefix: [String!], $limit: Int, $cursor: String) {
                        assetNodes(assetKeys: $prefix ? [{ path: $prefix }] : undefined) {
                            assetKey { path }
                            description
                            jobs { name }
                        }
                    }
                `, { prefix: inputs.prefix, limit: inputs.limit, cursor: inputs.cursor });
                return { output: data };
            }
            case 'getAsset': {
                const data = await gql(`
                    query GetAsset($assetKey: AssetKeyInput!) {
                        assetOrError(assetKey: $assetKey) {
                            ... on Asset { id assetMaterializations(limit: 1) { timestamp runId } }
                            ... on AssetNotFoundError { message }
                        }
                    }
                `, { assetKey: inputs.assetKey });
                return { output: data };
            }
            case 'getAssetMaterializations': {
                const data = await gql(`
                    query GetAssetMaterializations($assetKey: AssetKeyInput!, $limit: Int, $cursor: String) {
                        assetOrError(assetKey: $assetKey) {
                            ... on Asset {
                                assetMaterializations(limit: $limit, cursor: $cursor) {
                                    timestamp runId materializationEvent { materialization { label description } }
                                }
                            }
                        }
                    }
                `, { assetKey: inputs.assetKey, limit: inputs.limit || 20, cursor: inputs.cursor });
                return { output: data };
            }
            case 'listSchedules': {
                const data = await gql(`
                    query ListSchedules($repositorySelector: RepositorySelector!) {
                        schedulesOrError(repositorySelector: $repositorySelector) {
                            ... on Schedules { results { name cronSchedule scheduleState { status } } }
                            ... on RepositoryNotFoundError { message }
                            ... on PythonError { message }
                        }
                    }
                `, { repositorySelector: inputs.repositorySelector || {} });
                return { output: data };
            }
            case 'getSchedule': {
                const data = await gql(`
                    query GetSchedule($scheduleSelector: ScheduleSelector!) {
                        scheduleOrError(scheduleSelector: $scheduleSelector) {
                            ... on Schedule { name cronSchedule scheduleState { status } }
                            ... on ScheduleNotFoundError { message }
                            ... on PythonError { message }
                        }
                    }
                `, { scheduleSelector: inputs.scheduleSelector });
                return { output: data };
            }
            case 'startSchedule': {
                const data = await gql(`
                    mutation StartSchedule($scheduleSelector: ScheduleSelector!) {
                        startSchedule(scheduleSelector: $scheduleSelector) {
                            ... on ScheduleStateResult { scheduleState { status } }
                            ... on PythonError { message }
                        }
                    }
                `, { scheduleSelector: inputs.scheduleSelector });
                return { output: data };
            }
            case 'stopSchedule': {
                const data = await gql(`
                    mutation StopRunningSchedule($scheduleOriginId: String!, $scheduleSelectorId: String!) {
                        stopRunningSchedule(scheduleOriginId: $scheduleOriginId, scheduleSelectorId: $scheduleSelectorId) {
                            ... on ScheduleStateResult { scheduleState { status } }
                            ... on PythonError { message }
                        }
                    }
                `, { scheduleOriginId: inputs.scheduleOriginId, scheduleSelectorId: inputs.scheduleSelectorId });
                return { output: data };
            }
            case 'listSensors': {
                const data = await gql(`
                    query ListSensors($repositorySelector: RepositorySelector!) {
                        sensorsOrError(repositorySelector: $repositorySelector) {
                            ... on Sensors { results { name sensorType sensorState { status } } }
                            ... on RepositoryNotFoundError { message }
                            ... on PythonError { message }
                        }
                    }
                `, { repositorySelector: inputs.repositorySelector || {} });
                return { output: data };
            }
            default:
                return { error: `Dagster: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err?.message || 'Dagster action failed' };
    }
}
