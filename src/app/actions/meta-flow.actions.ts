
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
        const flow = await db.collection<MetaFlow>('meta_flows').findOne({ _id: new ObjectId(flowId) });
        if (!flow) return null;

        // Security check: ensure the current user has access to the project this flow belongs to.
        const project = await getProjectById(flow.projectId.toString());
        if (!project) {
            console.error(`User does not have access to project ${flow.projectId.toString()} for flow ${flowId}`);
            return null;
        }

        return JSON.parse(JSON.stringify(flow));
    } catch (e) {
        console.error("Error fetching Meta Flow by ID:", e);
        return null;
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
    const endpointUri = formData.get('endpoint_uri') as string | null;
    
    if (!name || !category || !flowDataStr) {
        return { error: 'Name, Category, and Flow Data are required.' };
    }

    try {
        const flow_data = JSON.parse(flowDataStr);
        const accessToken = hasAccess.accessToken;

        if (flowId && metaId) {
            // ----- UPDATE LOGIC -----
            const payload: any = {
                name,
                categories: [category],
                flow_json: JSON.stringify(flow_data),
                access_token: accessToken,
            };
            if (endpointUri) payload.endpoint_uri = endpointUri;

            // POST to /<flow_meta_id> to update
            const response = await axios.post(`https://graph.facebook.com/v22.0/${metaId}`, payload);

            if (response.data.error) {
                throw new Error(getErrorMessage({ response }));
            }

            const updatedFlow = {
                name,
                categories: [category],
                flow_data,
                ...(endpointUri && { endpointUri }),
                updatedAt: new Date(),
            };

            const { db } = await connectToDatabase();
            await db.collection('meta_flows').updateOne(
                { _id: new ObjectId(flowId) },
                { $set: updatedFlow }
            );

            revalidatePath('/dashboard/flows');
            return { message: `Flow "${name}" updated successfully!` };
            
        } else {
            // ----- CREATE LOGIC -----
            const wabaId = hasAccess.wabaId;
            const payload: any = {
                name,
                categories: [category],
                flow_json: JSON.stringify(flow_data),
                access_token: accessToken,
                publish: true,
            };
            if (endpointUri) {
                payload.endpoint_uri = endpointUri;
            }

            const response = await axios.post(`https://graph.facebook.com/v22.0/${wabaId}/flows`, payload);

            if (response.data.error) {
                throw new Error(getErrorMessage({ response }));
            }

            const newMetaFlowId = response.data?.id;
            if (!newMetaFlowId) {
                throw new Error('Meta API did not return a flow ID.');
            }

            const newFlow: Omit<MetaFlow, '_id' | 'endpointUri'> & { endpointUri?: string | null } = {
                name,
                projectId: new ObjectId(projectId),
                metaId: newMetaFlowId,
                categories: [category],
                flow_data,
                status: response.data.status || 'DRAFT',
                json_version: response.data.json_version,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
             if (endpointUri) {
                newFlow.endpointUri = endpointUri;
            }

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
                        createdAt: new Date()
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
