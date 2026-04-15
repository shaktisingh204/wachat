'use server';

export async function executeMonicaCrmAction(
  actionName: string,
  inputs: Record<string, any>,
  user: any,
  logger: any
): Promise<{ output: Record<string, any> } | { error: string }> {
  const { apiToken, serverUrl, ...params } = inputs;

  if (!apiToken) return { error: 'apiToken is required' };

  const base = `${serverUrl ?? 'https://app.monicahq.com'}/api`;

  async function req(
    method: string,
    path: string,
    body?: Record<string, any>
  ) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MonicaCRM ${method} ${path} failed (${res.status}): ${text}`);
    }

    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  try {
    switch (actionName) {
      case 'listContacts': {
        const { page, sort } = params;
        const data = await req('GET', `/contacts?page=${page ?? 1}&sort=${sort ?? 'name'}`);
        return { output: data };
      }

      case 'getContact': {
        const { contactId } = params;
        if (!contactId) return { error: 'contactId is required' };
        const data = await req('GET', `/contacts/${contactId}`);
        return { output: data };
      }

      case 'createContact': {
        const { firstName, lastName, nickname, genderId, birthdate, email, phone } = params;
        if (!firstName) return { error: 'firstName is required' };

        const body: Record<string, any> = {
          first_name: firstName,
          gender_id: genderId ?? 1,
        };
        if (lastName) body.last_name = lastName;
        if (nickname) body.nickname = nickname;
        if (birthdate) body.birthdate = birthdate;
        if (email) body.email = email;
        if (phone) body.phone = phone;

        const data = await req('POST', '/contacts', body);
        return { output: data };
      }

      case 'updateContact': {
        const { contactId, firstName, lastName, description } = params;
        if (!contactId) return { error: 'contactId is required' };
        if (!firstName) return { error: 'firstName is required' };

        const body: Record<string, any> = { first_name: firstName, gender_id: 1 };
        if (lastName) body.last_name = lastName;
        if (description) body.description = description;

        const data = await req('PUT', `/contacts/${contactId}`, body);
        return { output: data };
      }

      case 'deleteContact': {
        const { contactId } = params;
        if (!contactId) return { error: 'contactId is required' };
        await req('DELETE', `/contacts/${contactId}`);
        return { output: { deleted: true } };
      }

      case 'addNote': {
        const { contactId, body: noteBody, isStarred } = params;
        if (!contactId) return { error: 'contactId is required' };
        if (!noteBody) return { error: 'body is required' };

        const data = await req('POST', '/notes', {
          contact_id: contactId,
          body: noteBody,
          is_favorited: isStarred ?? 0,
        });
        return { output: data };
      }

      case 'listNotes': {
        const { contactId } = params;
        if (!contactId) return { error: 'contactId is required' };
        const data = await req('GET', `/contacts/${contactId}/notes`);
        return { output: data };
      }

      case 'addTask': {
        const { contactId, title, description, dueAt } = params;
        if (!contactId) return { error: 'contactId is required' };
        if (!title) return { error: 'title is required' };

        const body: Record<string, any> = { contact_id: contactId, title };
        if (description) body.description = description;
        if (dueAt) body.due_at = dueAt;

        const data = await req('POST', '/tasks', body);
        return { output: data };
      }

      case 'listTasks': {
        const { contactId } = params;
        if (!contactId) return { error: 'contactId is required' };
        const data = await req('GET', `/contacts/${contactId}/tasks`);
        return { output: data };
      }

      case 'addReminder': {
        const { contactId, title, nextExpectedDate, frequency } = params;
        if (!contactId) return { error: 'contactId is required' };
        if (!title) return { error: 'title is required' };
        if (!nextExpectedDate) return { error: 'nextExpectedDate is required' };

        const data = await req('POST', '/reminders', {
          contact_id: contactId,
          title,
          next_expected_date: nextExpectedDate,
          frequency_type: frequency ?? 'one_time',
          frequency_number: 1,
        });
        return { output: data };
      }

      case 'listReminders': {
        const { contactId } = params;
        if (!contactId) return { error: 'contactId is required' };
        const data = await req('GET', `/contacts/${contactId}/reminders`);
        return { output: data };
      }

      case 'logCall': {
        const { contactId, description, calledAt, duration } = params;
        if (!contactId) return { error: 'contactId is required' };
        if (!description) return { error: 'description is required' };
        if (!calledAt) return { error: 'calledAt is required' };

        const data = await req('POST', '/calls', {
          contact_id: contactId,
          called_at: calledAt,
          description,
          duration: duration ?? 0,
        });
        return { output: data };
      }

      case 'addRelationship': {
        const { contactId, relatedContactId, relationshipTypeId } = params;
        if (!contactId) return { error: 'contactId is required' };
        if (!relatedContactId) return { error: 'relatedContactId is required' };
        if (!relationshipTypeId) return { error: 'relationshipTypeId is required' };

        const data = await req('POST', '/relationships', {
          contact_is: contactId,
          relationship_type_id: relationshipTypeId,
          of_contact: relatedContactId,
        });
        return { output: data };
      }

      default:
        return { error: `Unknown action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`MonicaCRM action error [${actionName}]:`, err.message);
    return { error: err.message ?? String(err) };
  }
}
