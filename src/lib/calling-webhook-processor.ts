
'use server';

import type { Db } from 'mongodb';
import type { Project, CallingSettings } from './definitions';

/**
 * Handles the 'account_settings_update' webhook, specifically for calling configurations.
 * @param db The database instance.
 * @param project The project associated with the webhook.
 * @param value The 'value' object from the webhook payload's 'changes' array.
 */
export async function handleCallingSettingsUpdate(db: Db, project: Project, value: any) {
    if (!value.phone_number_settings || !value.phone_number_settings.calling) {
        console.warn(`[CALLING-WEBHOOK] No calling settings found in payload for project ${project._id}`);
        return;
    }

    const phoneNumberId = value.phone_number_settings.phone_number_id;
    const callingSettings: CallingSettings = value.phone_number_settings.calling;

    if (!phoneNumberId) {
        console.warn(`[CALLING-WEBHOOK] No phone_number_id found in payload for project ${project._id}`);
        return;
    }
    
    // Find the specific phone number in the project's array and update its settings
    const updateResult = await db.collection('projects').updateOne(
        { 
            _id: project._id, 
            'phoneNumbers.id': phoneNumberId 
        },
        { 
            $set: { 
                'phoneNumbers.$.callingSettings': callingSettings 
            } 
        }
    );

    if (updateResult.modifiedCount > 0) {
        console.log(`[CALLING-WEBHOOK] Updated calling settings for phone number ${phoneNumberId} in project ${project._id}`);
        
        // Create a notification for the user
        await db.collection('notifications').insertOne({
            projectId: project._id,
            wabaId: project.wabaId,
            message: `Calling settings for phone number ${phoneNumberId} were updated via webhook.`,
            link: '/dashboard/calls/settings',
            isRead: false,
            createdAt: new Date(),
            eventType: 'account_settings_update'
        });
    }
}
