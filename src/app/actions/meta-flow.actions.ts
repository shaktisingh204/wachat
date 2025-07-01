
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import type { Project, MetaFlow } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';


// --- META FLOW ACTIONS ---

export async function getMetaFlows(projectId: string): Promise<WithId<MetaFlow>[]> {
    if (!ObjectId.isValid(projectId)) return [];
    try {
        const { db } = await connectToDatabase();
        const flows = await db.collection('meta_flows').find({ projectId: new ObjectId(projectId) }).sort({ createdAt: -1 }).toArray();
        return JSON.parse(JSON.stringify(flows));
    } catch (e) {
        return [];
    }
}

export async function getMetaFlowById(flowId: string): Promise<WithId<MetaFlow> | null> {
    if (!ObjectId.isValid(flowId)) {
        console.error("Invalid Flow ID provided to getMetaFlowById:", flowId);
        return null;
    }

    try {
        const { db } = await connectToDatabase();
        const localFlow = await db.collection<MetaFlow>('meta_flows').findOne({ _id: new ObjectId(flowId) });
        if (!localFlow) return null;

        const project = await getProjectById(localFlow.projectId.toString());
        if (!project || !project.accessToken) {
            console.error(`User does not have access to project or project is missing access token.`);
            return JSON.parse(JSON.stringify(localFlow)); // Return local data as fallback
        }
        
        // Fetch the latest version from Meta to ensure editor has the most recent data
        const metaResponse = await axios.get(
            `https://graph.facebook.com/v22.0/${localFlow.metaId}?fields=name,categories,status,json_version,flow_json&access_token=${project.accessToken}`
        );

        if (metaResponse.data.error) {
            // It's okay if it fails (e.g. flow was deleted on Meta), just return local data.
            console.warn(`Could not sync flow ${localFlow.metaId} from Meta. Using local data. Reason: ${getErrorMessage({ response: metaResponse })}`);
            return JSON.parse(JSON.stringify(localFlow));
        }

        const metaFlowData = metaResponse.data;
        
        // Update local DB with fresh data from Meta
        const updateData: Partial<MetaFlow> = {
            name: metaFlowData.name,
            categories: metaFlowData.categories || [],
            status: metaFlowData.status,
            json_version: metaFlowData.json_version,
            flow_data: metaFlowData.flow_json ? JSON.parse(metaFlowData.flow_json) : {},
            updatedAt: new Date(),
        };

        await db.collection('meta_flows').updateOne(
            { _id: new ObjectId(flowId) },
            { $set: updateData }
        );

        const updatedFlow = await db.collection<MetaFlow>('meta_flows').findOne({ _id: new ObjectId(flowId) });
        return JSON.parse(JSON.stringify(updatedFlow));

    } catch (e) {
        console.error("Error fetching or syncing Meta Flow by ID:", getErrorMessage(e));
        const { db } = await connectToDatabase();
        const flow = await db.collection<MetaFlow>('meta_flows').findOne({ _id: new ObjectId(flowId) });
        return flow ? JSON.parse(JSON.stringify(flow)) : null;
    }
}

export async function saveMetaFlow(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    const flowId = formData.get('flowId') as string | null;
    const metaId = formData.get('metaId') as string | null;

    if (!projectId) return { error: 'Project ID is missing.' };

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };
    
    const name = formData.get('name') as string;
    const category = formData.get('category') as string;
    const flowDataStr = formData.get('flow_data') as string;
    const shouldPublish = formData.get('publish') === 'on';
    
    if (!name || !category || !flowDataStr) {
        return { error: 'Name, Category, and Flow Data are required.' };
    }

    try {
        const flow_data = JSON.parse(flowDataStr);
        const accessToken = hasAccess.accessToken;

        if (flowId && metaId) {
            // ----- UPDATE LOGIC -----
            const updatePayload: any = {
                name,
                categories: [category],
                flow_json: JSON.stringify(flow_data),
                access_token: accessToken,
            };

            const updateResponse = await axios.post(`https://graph.facebook.com/v22.0/${metaId}`, updatePayload);

            if (updateResponse.data.error) throw new Error(getErrorMessage({ response: updateResponse }));
            
            if (shouldPublish) {
                const publishResponse = await axios.post(`https://graph.facebook.com/v22.0/${metaId}/publish?access_token=${accessToken}`);
                if (publishResponse.data.error) {
                    throw new Error(`Flow updated but failed to publish: ${getErrorMessage({ response: publishResponse })}`);
                }
            }
            
            const finalFlowData = await axios.get(`https://graph.facebook.com/v22.0/${metaId}?fields=status&access_token=${accessToken}`);

            const updatedFlowInDb = {
                name, categories: [category], flow_data, updatedAt: new Date(),
                status: finalFlowData.data.status || (shouldPublish ? 'PUBLISHED' : 'DRAFT'),
            };

            const { db } = await connectToDatabase();
            await db.collection('meta_flows').updateOne(
                { _id: new ObjectId(flowId) },
                { $set: updatedFlowInDb }
            );

            revalidatePath('/dashboard/flows');
            return { message: `Flow "${name}" ${shouldPublish ? 'updated and published' : 'updated'} successfully!` };
            
        } else {
            // ----- CREATE LOGIC -----
            const wabaId = hasAccess.wabaId;
            const createPayload: any = {
                name,
                categories: [category],
                flow_json: JSON.stringify(flow_data),
                access_token: accessToken,
            };

            const createUrl = `https://graph.facebook.com/v22.0/${wabaId}/flows`;
            const createResponse = await axios.post(createUrl, createPayload);

            if (createResponse.data.error) throw new Error(getErrorMessage({ response: createResponse }));

            const newMetaFlowId = createResponse.data?.id;
            if (!newMetaFlowId) throw new Error('Meta API did not return a flow ID.');
            
            if (shouldPublish) {
                const publishResponse = await axios.post(`https://graph.facebook.com/v22.0/${newMetaFlowId}/publish?access_token=${accessToken}`);
                if (publishResponse.data.error) {
                     console.warn(`Flow created but failed to publish: ${getErrorMessage({ response: publishResponse })}`);
                }
            }

            const finalFlowData = await axios.get(`https://graph.facebook.com/v22.0/${newMetaFlowId}?fields=status,json_version&access_token=${accessToken}`);

            const newFlow: Omit<MetaFlow, '_id'> = {
                name,
                projectId: new ObjectId(projectId),
                metaId: newMetaFlowId,
                categories: [category],
                flow_data,
                status: finalFlowData.data.status || 'DRAFT',
                json_version: finalFlowData.data.json_version,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const { db } = await connectToDatabase();
            await db.collection('meta_flows').insertOne(newFlow as any);

            revalidatePath('/dashboard/flows');
            return { message: `Meta Flow "${name}" created successfully!` };
        }

    } catch (e: any) {
        if (e instanceof SyntaxError) {
            return { error: 'Invalid JSON format for flow data.' };
        }
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}


export async function deleteMetaFlow(flowId: string, metaId: string): Promise<{ message?: string, error?: string }> {
    if (!ObjectId.isValid(flowId)) return { error: 'Invalid Flow ID.' };

    const { db } = await connectToDatabase();
    const flow = await db.collection('meta_flows').findOne({ _id: new ObjectId(flowId) });
    if (!flow) return { error: 'Flow not found in database.' };

    const project = await getProjectById(flow.projectId.toString());
    if (!project) return { error: 'Project not found.' };

    try {
        await axios.delete(`https://graph.facebook.com/v22.0/${metaId}?access_token=${project.accessToken}`);
        
        await db.collection('meta_flows').deleteOne({ _id: new ObjectId(flowId) });

        revalidatePath('/dashboard/flows');
        return { message: `Flow "${flow.name}" deleted successfully.` };
    } catch (e: any) {
        return { error: getErrorMessage(e) || 'Failed to delete flow from Meta.' };
    }
}

export async function handleSyncMetaFlows(projectId: string): Promise<{ message?: string; error?: string, count?: number }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found or you do not have access.' };

    try {
        const { db } = await connectToDatabase();
        
        const { wabaId, accessToken } = project;
        const allMetaFlows: any[] = [];
        let nextUrl: string | undefined = `https://graph.facebook.com/v22.0/${wabaId}/flows?access_token=${accessToken}&fields=id,name,status,categories,json_version&limit=100`;

        while(nextUrl) {
            const response = await fetch(nextUrl);
            const responseData = await response.json();

            if (!response.ok) {
                const errorMessage = responseData?.error?.message || 'Unknown error syncing Meta Flows.';
                return { error: `API Error: ${errorMessage}` };
            }
            
            if (responseData.data && responseData.data.length > 0) {
                allMetaFlows.push(...responseData.data);
            }
            nextUrl = responseData.paging?.next;
        }
        
        if (allMetaFlows.length === 0) {
            return { message: "No flows found in your WhatsApp Business Account to sync." }
        }

        const bulkOps = allMetaFlows.map(flow => ({
            updateOne: {
                filter: { metaId: flow.id, projectId: new ObjectId(projectId) },
                update: { 
                    $set: {
                        name: flow.name,
                        status: flow.status,
                        categories: flow.categories,
                        json_version: flow.json_version,
                        updatedAt: new Date(),
                    },
                    $setOnInsert: {
                        metaId: flow.id,
                        projectId: new ObjectId(projectId),
                        createdAt: new Date(),
                        flow_data: {}
                    }
                },
                upsert: true,
            }
        }));

        const result = await db.collection('meta_flows').bulkWrite(bulkOps);
        const syncedCount = result.upsertedCount + result.modifiedCount;
        
        revalidatePath('/dashboard/flows');
        
        return { message: `Successfully synced ${syncedCount} Meta Flow(s).`, count: syncedCount };

    } catch (e: any) {
        console.error('Meta Flow sync failed:', e);
        return { error: e.message || 'An unexpected error occurred during flow sync.' };
    }
}
