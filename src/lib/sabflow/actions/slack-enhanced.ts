'use server';

export async function executeSlackEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
  const token = inputs.token;
  const baseUrl = 'https://slack.com/api';

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    switch (actionName) {
      case 'postMessage': {
        const res = await fetch(`${baseUrl}/chat.postMessage`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            channel: inputs.channel,
            text: inputs.text,
            blocks: inputs.blocks,
            thread_ts: inputs.threadTs,
            username: inputs.username,
            icon_emoji: inputs.iconEmoji,
          }),
        });
        const data = await res.json();
        if (!data.ok) return { error: data.error || 'postMessage failed' };
        return { output: { ts: data.ts, channel: data.channel, message: data.message } };
      }

      case 'updateMessage': {
        const res = await fetch(`${baseUrl}/chat.update`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            channel: inputs.channel,
            ts: inputs.ts,
            text: inputs.text,
            blocks: inputs.blocks,
          }),
        });
        const data = await res.json();
        if (!data.ok) return { error: data.error || 'updateMessage failed' };
        return { output: { ts: data.ts, channel: data.channel, text: data.text } };
      }

      case 'deleteMessage': {
        const res = await fetch(`${baseUrl}/chat.delete`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ channel: inputs.channel, ts: inputs.ts }),
        });
        const data = await res.json();
        if (!data.ok) return { error: data.error || 'deleteMessage failed' };
        return { output: { deleted: true, channel: data.channel, ts: data.ts } };
      }

      case 'listChannels': {
        const params = new URLSearchParams({
          limit: inputs.limit || '200',
          cursor: inputs.cursor || '',
          exclude_archived: inputs.excludeArchived === false ? 'false' : 'true',
          types: inputs.types || 'public_channel,private_channel',
        });
        if (!inputs.cursor) params.delete('cursor');
        const res = await fetch(`${baseUrl}/conversations.list?${params}`, { headers });
        const data = await res.json();
        if (!data.ok) return { error: data.error || 'listChannels failed' };
        return { output: { channels: data.channels, next_cursor: data.response_metadata?.next_cursor } };
      }

      case 'getChannel': {
        const res = await fetch(`${baseUrl}/conversations.info?channel=${inputs.channel}`, { headers });
        const data = await res.json();
        if (!data.ok) return { error: data.error || 'getChannel failed' };
        return { output: { channel: data.channel } };
      }

      case 'createChannel': {
        const res = await fetch(`${baseUrl}/conversations.create`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: inputs.name, is_private: inputs.isPrivate || false }),
        });
        const data = await res.json();
        if (!data.ok) return { error: data.error || 'createChannel failed' };
        return { output: { channel: data.channel } };
      }

      case 'archiveChannel': {
        const res = await fetch(`${baseUrl}/conversations.archive`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ channel: inputs.channel }),
        });
        const data = await res.json();
        if (!data.ok) return { error: data.error || 'archiveChannel failed' };
        return { output: { archived: true } };
      }

      case 'listUsers': {
        const params = new URLSearchParams({ limit: inputs.limit || '200' });
        if (inputs.cursor) params.set('cursor', inputs.cursor);
        const res = await fetch(`${baseUrl}/users.list?${params}`, { headers });
        const data = await res.json();
        if (!data.ok) return { error: data.error || 'listUsers failed' };
        return { output: { members: data.members, next_cursor: data.response_metadata?.next_cursor } };
      }

      case 'getUser': {
        const res = await fetch(`${baseUrl}/users.info?user=${inputs.userId}`, { headers });
        const data = await res.json();
        if (!data.ok) return { error: data.error || 'getUser failed' };
        return { output: { user: data.user } };
      }

      case 'getUserByEmail': {
        const res = await fetch(`${baseUrl}/users.lookupByEmail?email=${encodeURIComponent(inputs.email)}`, { headers });
        const data = await res.json();
        if (!data.ok) return { error: data.error || 'getUserByEmail failed' };
        return { output: { user: data.user } };
      }

      case 'setPresence': {
        const res = await fetch(`${baseUrl}/users.setPresence`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ presence: inputs.presence }),
        });
        const data = await res.json();
        if (!data.ok) return { error: data.error || 'setPresence failed' };
        return { output: { presence_set: inputs.presence } };
      }

      case 'uploadFile': {
        const uploadRes = await fetch(`${baseUrl}/files.getUploadURLExternal`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            filename: inputs.filename,
            length: inputs.length || (inputs.content ? inputs.content.length : 0),
          }),
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.ok) return { error: uploadData.error || 'uploadFile getUploadURL failed' };
        const completeRes = await fetch(`${baseUrl}/files.completeUploadExternal`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            files: [{ id: uploadData.file_id, title: inputs.title || inputs.filename }],
            channel_id: inputs.channel,
          }),
        });
        const completeData = await completeRes.json();
        if (!completeData.ok) return { error: completeData.error || 'uploadFile complete failed' };
        return { output: { file: completeData.files?.[0], upload_url: uploadData.upload_url } };
      }

      case 'listFiles': {
        const params = new URLSearchParams({
          count: inputs.count || '20',
          page: inputs.page || '1',
        });
        if (inputs.channel) params.set('channel', inputs.channel);
        if (inputs.userId) params.set('user', inputs.userId);
        const res = await fetch(`${baseUrl}/files.list?${params}`, { headers });
        const data = await res.json();
        if (!data.ok) return { error: data.error || 'listFiles failed' };
        return { output: { files: data.files, paging: data.paging } };
      }

      case 'addReaction': {
        const res = await fetch(`${baseUrl}/reactions.add`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ channel: inputs.channel, name: inputs.name, timestamp: inputs.timestamp }),
        });
        const data = await res.json();
        if (!data.ok) return { error: data.error || 'addReaction failed' };
        return { output: { reacted: true, emoji: inputs.name } };
      }

      case 'scheduleMessage': {
        const res = await fetch(`${baseUrl}/chat.scheduleMessage`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            channel: inputs.channel,
            text: inputs.text,
            post_at: inputs.postAt,
            blocks: inputs.blocks,
          }),
        });
        const data = await res.json();
        if (!data.ok) return { error: data.error || 'scheduleMessage failed' };
        return { output: { scheduled_message_id: data.scheduled_message_id, post_at: data.post_at, channel: data.channel } };
      }

      default:
        return { error: `Unknown Slack Enhanced action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`SlackEnhanced error [${actionName}]: ${err.message}`);
    return { error: err.message || 'Unexpected error in Slack Enhanced action' };
  }
}
