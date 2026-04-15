'use server';

export async function executeMuralAction(actionName: string, inputs: any, user: any, logger: any) {
  const BASE_URL = 'https://app.mural.co/api/public/v1';
  const token = inputs.accessToken;

  if (!token) return { error: 'Missing required credential: accessToken' };

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    switch (actionName) {
      case 'listMurals': {
        const params = new URLSearchParams();
        if (inputs.workspaceId) params.set('workspaceId', inputs.workspaceId);
        if (inputs.roomId) params.set('roomId', inputs.roomId);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.next) params.set('next', inputs.next);
        const res = await fetch(`${BASE_URL}/murals?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listMurals failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getMural': {
        const { muralId } = inputs;
        if (!muralId) return { error: 'Missing required input: muralId' };
        const res = await fetch(`${BASE_URL}/murals/${muralId}`, { headers });
        if (!res.ok) return { error: `getMural failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createMural': {
        const { title, workspaceId } = inputs;
        if (!title || !workspaceId) return { error: 'Missing required inputs: title, workspaceId' };
        const body: any = { title, workspaceId };
        if (inputs.roomId) body.roomId = inputs.roomId;
        if (inputs.templateId) body.templateId = inputs.templateId;
        const res = await fetch(`${BASE_URL}/murals`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createMural failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'updateMural': {
        const { muralId } = inputs;
        if (!muralId) return { error: 'Missing required input: muralId' };
        const body: any = {};
        if (inputs.title) body.title = inputs.title;
        if (inputs.description) body.description = inputs.description;
        const res = await fetch(`${BASE_URL}/murals/${muralId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `updateMural failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteMural': {
        const { muralId } = inputs;
        if (!muralId) return { error: 'Missing required input: muralId' };
        const res = await fetch(`${BASE_URL}/murals/${muralId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteMural failed: ${res.status} ${await res.text()}` };
        return { output: { deleted: true, muralId } };
      }

      case 'listWorkspaces': {
        const res = await fetch(`${BASE_URL}/workspaces`, { headers });
        if (!res.ok) return { error: `listWorkspaces failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getWorkspace': {
        const { workspaceId } = inputs;
        if (!workspaceId) return { error: 'Missing required input: workspaceId' };
        const res = await fetch(`${BASE_URL}/workspaces/${workspaceId}`, { headers });
        if (!res.ok) return { error: `getWorkspace failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listRooms': {
        const { workspaceId } = inputs;
        if (!workspaceId) return { error: 'Missing required input: workspaceId' };
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.next) params.set('next', inputs.next);
        const res = await fetch(`${BASE_URL}/workspaces/${workspaceId}/rooms?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listRooms failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getRoom': {
        const { roomId } = inputs;
        if (!roomId) return { error: 'Missing required input: roomId' };
        const res = await fetch(`${BASE_URL}/rooms/${roomId}`, { headers });
        if (!res.ok) return { error: `getRoom failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createRoom': {
        const { name, workspaceId } = inputs;
        if (!name || !workspaceId) return { error: 'Missing required inputs: name, workspaceId' };
        const body: any = { name, workspaceId };
        if (inputs.description) body.description = inputs.description;
        if (inputs.type) body.type = inputs.type;
        const res = await fetch(`${BASE_URL}/rooms`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createRoom failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listMembers': {
        const { workspaceId } = inputs;
        if (!workspaceId) return { error: 'Missing required input: workspaceId' };
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${BASE_URL}/workspaces/${workspaceId}/members?${params.toString()}`, { headers });
        if (!res.ok) return { error: `listMembers failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'inviteMember': {
        const { workspaceId, email } = inputs;
        if (!workspaceId || !email) return { error: 'Missing required inputs: workspaceId, email' };
        const body: any = { email };
        if (inputs.role) body.role = inputs.role;
        const res = await fetch(`${BASE_URL}/workspaces/${workspaceId}/members/invite`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `inviteMember failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'removeMember': {
        const { workspaceId, memberId } = inputs;
        if (!workspaceId || !memberId) return { error: 'Missing required inputs: workspaceId, memberId' };
        const res = await fetch(`${BASE_URL}/workspaces/${workspaceId}/members/${memberId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `removeMember failed: ${res.status} ${await res.text()}` };
        return { output: { removed: true, memberId } };
      }

      case 'listWidgets': {
        const { muralId } = inputs;
        if (!muralId) return { error: 'Missing required input: muralId' };
        const res = await fetch(`${BASE_URL}/murals/${muralId}/widgets`, { headers });
        if (!res.ok) return { error: `listWidgets failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createStickyNote': {
        const { muralId, text } = inputs;
        if (!muralId || !text) return { error: 'Missing required inputs: muralId, text' };
        const body: any = {
          type: 'sticky note',
          text,
        };
        if (inputs.x !== undefined) body.x = inputs.x;
        if (inputs.y !== undefined) body.y = inputs.y;
        if (inputs.width) body.width = inputs.width;
        if (inputs.height) body.height = inputs.height;
        if (inputs.backgroundColor) body.backgroundColor = inputs.backgroundColor;
        const res = await fetch(`${BASE_URL}/murals/${muralId}/widgets/sticky-note`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createStickyNote failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown Mural action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`executeMuralAction error: ${err.message}`);
    return { error: err.message || 'Unknown error in executeMuralAction' };
  }
}
