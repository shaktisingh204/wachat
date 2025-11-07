
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { SabFlow, SabFlowNode, SabFlowEdge, WithId as SabWithId, Project, Contact, SabChatSession, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

// Import all necessary action modules
import * as wachatActions from './whatsapp.actions';
import * as sabChatActions from './sabchat.actions';
import * as crmActions from './crm.actions';
import * as crmDealsActions from './crm-deals.actions';
import * as crmTasksActions from './crm-tasks.actions';
import * as metaActions from './facebook.actions';
import * as instagramActions from './instagram.actions';
import * as urlShortenerActions from './url-shortener.actions';
import * as qrCodeActions from './qr-code.actions';
import * as emailActions from './email.actions';
import * as smsActions from './sms.actions';
import * as crmQuotationsActions from './crm-quotations.actions';
import * as crmInvoicesActions from './crm-invoices.actions';
import * as crmSalesOrdersActions from './crm-sales-orders.actions';
import * as crmDeliveryChallansActions from './crm-delivery-challans.actions';
import * as crmCreditNotesActions from './crm-credit-notes.actions';
import * as crmVendorsActions from './crm-vendors.actions';
import * as crmPurchaseOrdersActions from './crm-purchase-orders.actions';
import * as crmProductsActions from './crm-products.actions';
import * as crmInventoryActions from './crm-inventory.actions';
import * as crmEmployeesActions from './crm-employees.actions';
import * as crmHrActions from './crm-hr.actions';
import * as crmVouchersActions from './crm-vouchers.actions';
import { sabnodeAppActions } from '@/lib/sabflow-actions';


export async function getSabFlows(): Promise<WithId<SabFlow>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const flows = await db.collection<SabFlow>('sabflows')
            .find({ userId: new ObjectId(session.user._id) })
            .project({ name: 1, trigger: 1, updatedAt: 1 })
            .sort({ updatedAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(flows));
    } catch (e) {
        return [];
    }
}

export async function getSabFlowById(flowId: string): Promise<WithId<SabFlow> | null> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(flowId)) return null;
    
    const { db } = await connectToDatabase();
    const flow = await db.collection<SabFlow>('sabflows').findOne({ 
        _id: new ObjectId(flowId),
        userId: new ObjectId(session.user._id)
    });

    return flow ? JSON.parse(JSON.stringify(flow)) : null;
}

export async function saveSabFlow(prevState: any, data: FormData): Promise<{ message?: string, error?: string, flowId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    
    const flowId = data.get('flowId') as string | undefined;
    const name = data.get('name') as string;
    const trigger = JSON.parse(data.get('trigger') as string);
    const nodes = JSON.parse(data.get('nodes') as string);
    const edges = JSON.parse(data.get('edges') as string);

    if (!name) return { error: 'Flow Name is required.' };
    
    const isNew = !flowId || flowId === 'new';
    
    const flowData: Omit<SabFlow, '_id' | 'createdAt'> = {
        name,
        userId: new ObjectId(session.user._id),
        trigger,
        nodes,
        edges,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        if (isNew) {
            const result = await db.collection('sabflows').insertOne({ ...flowData, createdAt: new Date() } as any);
            revalidatePath('/dashboard/sabflow/flow-builder');
            return { message: 'Flow created successfully.', flowId: result.insertedId.toString() };
        } else {
            await db.collection('sabflows').updateOne(
                { _id: new ObjectId(flowId), userId: new ObjectId(session.user._id) },
                { $set: flowData }
            );
            revalidatePath('/dashboard/sabflow/flow-builder');
            return { message: 'Flow updated successfully.', flowId };
        }
    } catch (e: any) {
        return { error: 'Failed to save flow.' };
    }
}

export async function deleteSabFlow(flowId: string): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(flowId)) return { error: 'Invalid request.' };

    const { db } = await connectToDatabase();
    const flow = await db.collection('sabflows').findOne({ 
        _id: new ObjectId(flowId),
        userId: new ObjectId(session.user._id)
    });
    
    if (!flow) return { error: 'Flow not found or access denied.' };

    try {
        await db.collection('sabflows').deleteOne({ _id: new ObjectId(flowId) });
        revalidatePath('/dashboard/sabflow/flow-builder');
        return { message: 'Flow deleted.' };
    } catch (e) {
        return { error: 'Failed to delete flow.' };
    }
}

export async function saveSabFlowConnection(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const appId = formData.get('appId') as string;
        const appName = formData.get('appName') as string;
        const connectionName = formData.get('connectionName') as string;
        
        let credentials: Record<string, any> = {};
        if (formData.get('credentials')) {
            try {
                credentials = JSON.parse(formData.get('credentials') as string);
            } catch { /* ignore invalid json */ }
        }
        
        const credentialKeysStr = formData.get('credentialKeys') as string | null;
        if(credentialKeysStr) {
             const credentialKeys = credentialKeysStr.split(',');
             for (const key of credentialKeys) {
                if (formData.has(key)) {
                    credentials[key] = formData.get(key) as string;
                }
            }
        }

        const connectionData = {
            _id: new ObjectId(),
            appId,
            appName,
            connectionName,
            credentials,
            createdAt: new Date(),
        };

        if (!connectionData.appId || !connectionData.connectionName) {
            return { error: 'Missing required connection details.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $push: { sabFlowConnections: connectionData } }
        );
        
        revalidatePath('/dashboard/sabflow/connections');
        return { message: `${connectionData.appName} account connected successfully.` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}


// --- Flow Execution Engine ---

async function executeAction(node: SabFlowNode, context: any, project: WithId<Project>, user: WithId<User>) {
    const { actionName, inputs } = node.data;
    const interpolatedInputs: Record<string, any> = {};

    // Interpolate all input values from the context
    for(const key in inputs) {
        if(typeof inputs[key] === 'string') {
            interpolatedInputs[key] = inputs[key].replace(/{{\s*([^}]+)\s*}}/g, (match: any, varName: string) => {
                const keys = varName.split('.');
                let value = context;
                for (const k of keys) {
                    if (value && typeof value === 'object' && k in value) {
                        value = value[k];
                    } else {
                        return match; 
                    }
                }
                return value;
            });
        } else {
            interpolatedInputs[key] = inputs[key];
        }
    }
    
    const actionApp = sabnodeAppActions.find(app => app.actions.some(a => a.name === actionName));
    if (!actionApp) {
        console.error(`Action app not found for action: ${actionName}`);
        return;
    }

    const formData = new FormData();
    Object.entries(interpolatedInputs).forEach(([key, value]) => {
        if (value !== undefined) {
            formData.append(key, value.toString());
        }
    });

    try {
        // Shared properties for many actions
        if(project) formData.append('projectId', project._id.toString());
        if(project.phoneNumbers?.[0]?.id) formData.append('phoneNumberId', project.phoneNumbers[0].id);

        switch (actionApp.appId) {
            case 'wachat':
                if (interpolatedInputs.recipient) formData.set('waId', interpolatedInputs.recipient);
                if (interpolatedInputs.message) formData.set('messageText', interpolatedInputs.message);
                switch(actionName) {
                    case 'send_text': case 'send_image': case 'send_video': case 'send_document': case 'send_audio': case 'send_sticker': case 'send_location': case 'send_contact': case 'send_interactive_buttons': case 'send_interactive_list': await wachatActions.handleSendMessage(null, formData); break;
                    case 'send_template': await wachatActions.handleSendTemplateMessage(null, formData); break;
                    case 'update_contact': await wachatActions.findOrCreateContact(project._id.toString(), project.phoneNumbers?.[0]?.id || '', interpolatedInputs.phone, interpolatedInputs.name, interpolatedInputs.email); break;
                    case 'add_tag': await wachatActions.addTagToContact(interpolatedInputs.phone, interpolatedInputs.tagName); break;
                    case 'remove_tag': await wachatActions.removeTagFromContact(interpolatedInputs.phone, interpolatedInputs.tagName); break;
                    case 'update_attribute': await wachatActions.updateContactAttribute(interpolatedInputs.phone, interpolatedInputs.attributeName, interpolatedInputs.attributeValue); break;
                    case 'start_broadcast': await wachatActions.handleStartBroadcast(null, formData); break;
                    case 'assign_agent': await wachatActions.assignAgentToContact(interpolatedInputs.phone, interpolatedInputs.agentEmail); break;
                    case 'resolve_conversation': await wachatActions.updateContactStatus(interpolatedInputs.phone, 'resolved'); break;
                    case 'create_template': await wachatActions.handleCreateTemplate(null, formData); break;
                    case 'opt_out_contact': await wachatActions.updateContactOptIn(interpolatedInputs.phone, false); break;
                    case 'opt_in_contact': await wachatActions.updateContactOptIn(interpolatedInputs.phone, true); break;
                    case 'create_group': await wachatActions.createGroup(formData.get('subject') as string); break;
                    case 'update_group_subject': await wachatActions.updateGroupInfo(interpolatedInputs.groupId, { subject: interpolatedInputs.newSubject }); break;
                    case 'update_group_description': await wachatActions.updateGroupInfo(interpolatedInputs.groupId, { description: interpolatedInputs.newDescription }); break;
                    case 'add_group_participant': await wachatActions.updateGroupParticipants(interpolatedInputs.groupId, [interpolatedInputs.phone], 'add'); break;
                    case 'remove_group_participant': await wachatActions.updateGroupParticipants(interpolatedInputs.groupId, [interpolatedInputs.phone], 'remove'); break;
                    case 'promote_to_admin': await wachatActions.updateGroupParticipants(interpolatedInputs.groupId, [interpolatedInputs.phone], 'promote'); break;
                    case 'demote_admin': await wachatActions.updateGroupParticipants(interpolatedInputs.groupId, [interpolatedInputs.phone], 'demote'); break;
                    case 'send_group_message': await wachatActions.sendGroupMessage(interpolatedInputs.groupId, interpolatedInputs.message); break;
                    case 'leave_group': await wachatActions.leaveGroup(interpolatedInputs.groupId); break;
                }
                break;
            case 'sabchat':
                 switch(actionName) {
                    case 'send_message': await sabChatActions.postChatMessage(interpolatedInputs.sessionId, 'agent', interpolatedInputs.content); break;
                    case 'close_session': await sabChatActions.closeChatSession(interpolatedInputs.sessionId); break;
                    case 'add_tag_to_session': await sabChatActions.addTagToSession(interpolatedInputs.sessionId, interpolatedInputs.tagName); break;
                    case 'create_crm_contact':
                        const session = await sabChatActions.getFullChatSession(interpolatedInputs.sessionId);
                        if (session && session.visitorInfo?.email) {
                            const crmFormData = new FormData();
                            crmFormData.append('name', session.visitorInfo.name || session.visitorInfo.email);
                            crmFormData.append('email', session.visitorInfo.email);
                            if(session.visitorInfo.phone) crmFormData.append('phone', session.visitorInfo.phone);
                            await crmActions.addCrmContact(null, crmFormData);
                        }
                        break;
                }
                break;
            case 'crm':
                 switch(actionName) {
                    case 'create_contact': await crmActions.addCrmContact(null, formData); break;
                    case 'create_account': await crmActions.addCrmClient(null, formData); break;
                    case 'create_deal': await crmDealsActions.createCrmDeal(null, formData); break;
                    case 'update_deal_stage': await crmDealsActions.updateCrmDealStage(interpolatedInputs.dealId, interpolatedInputs.stage); break;
                    case 'create_task': await crmTasksActions.createCrmTask(null, formData); break;
                    case 'add_note': await crmActions.addCrmNote(null, formData); break;
                    case 'create_quotation': await crmQuotationsActions.saveQuotation(null, formData); break;
                    case 'create_invoice': await crmInvoicesActions.saveInvoice(null, formData); break;
                    case 'create_sales_order': await crmSalesOrdersActions.saveSalesOrder(null, formData); break;
                    case 'create_delivery_challan': await crmDeliveryChallansActions.saveDeliveryChallan(null, formData); break;
                    case 'create_credit_note': await crmCreditNotesActions.saveCreditNote(null, formData); break;
                    case 'create_vendor': await crmVendorsActions.saveCrmVendor(null, formData); break;
                    case 'create_product': await crmProductsActions.saveCrmProduct(null, formData); break;
                    case 'add_employee': await crmEmployeesActions.saveCrmEmployee(null, formData); break;
                    case 'create_leave_request': await crmHrActions.applyForCrmLeave(null, formData); break;
                    case 'create_journal_voucher': case 'create_payment_voucher': case 'create_receipt_voucher': await crmVouchersActions.saveVoucherEntry(null, formData); break;
                 }
                break;
            case 'meta':
                switch(actionName) {
                    case 'create_text_post': case 'create_photo_post': case 'create_video_post': case 'schedule_post': await metaActions.handleCreateFacebookPost(null, formData); break;
                    case 'update_post': await metaActions.handleUpdatePost(null, formData); break;
                    case 'delete_post': await metaActions.handleDeletePost(interpolatedInputs.postId, project._id.toString()); break;
                    case 'post_comment': await metaActions.handlePostComment(null, formData); break;
                    case 'delete_comment': await metaActions.handleDeleteComment(interpolatedInputs.commentId, project._id.toString()); break;
                    case 'like_object': await metaActions.handleLikeObject(interpolatedInputs.objectId, project._id.toString()); break;
                    case 'send_messenger_message': await metaActions.sendFacebookMessage(null, formData); break;
                }
                break;
            case 'instagram':
                 switch(actionName) {
                    case 'create_image_post': await instagramActions.createInstagramImagePost(null, formData); break;
                 }
                break;
            default:
                console.log(`Action app "${actionApp.name}" is defined but not yet implemented in the executor.`);
        }
    } catch (e) {
        console.error(`Error executing action "${actionName}":`, getErrorMessage(e));
    }
}

export async function runSabFlow(flowId: string, triggerPayload: any) {
    const flow = await getSabFlowById(flowId);
    if (!flow) throw new Error("Flow not found.");

    const { db } = await connectToDatabase();
    const user = await db.collection<User>('users').findOne({ _id: flow.userId });
    
    // Find the project based on context if possible, otherwise fallback to the user's first project.
    const projectIdFromContext = triggerPayload?.projectId || triggerPayload?.project?._id;
    let project: WithId<Project> | null = null;
    if (projectIdFromContext) {
        project = await db.collection<Project>('projects').findOne({ _id: new ObjectId(projectIdFromContext), userId: flow.userId });
    }
    if (!project) {
        project = await db.collection<Project>('projects').findOne({ userId: flow.userId });
    }
    
    if (!project || !user) throw new Error("Could not find a project or user to execute this flow against.");

    let context = { ...triggerPayload };
    let currentNodeId: string | null = flow.nodes.find(n => n.type === 'trigger')?.id || null;

    if(!currentNodeId && flow.nodes.length > 0) {
        currentNodeId = flow.nodes[0].id;
    }

    while (currentNodeId) {
        const currentNode = flow.nodes.find(n => n.id === currentNodeId);
        if (!currentNode) break;

        if (currentNode.type === 'action') {
            await executeAction(currentNode, context, project, user);
        }

        const edge = flow.edges.find(e => e.source === currentNodeId);
        currentNodeId = edge ? edge.target : null;
    }
}

    
