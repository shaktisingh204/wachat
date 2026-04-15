'use server';

export async function executeDiscordWebhookAction(actionName: string, inputs: any, user: any, logger: any) {
  const baseUrl = 'https://discord.com/api/v10';
  const botHeaders: Record<string, string> = {
    'Authorization': `Bot ${inputs.botToken}`,
    'Content-Type': 'application/json',
  };

  try {
    switch (actionName) {
      case 'sendWebhookMessage': {
        const webhookUrl = inputs.webhookUrl;
        if (!webhookUrl) return { error: 'webhookUrl is required for sendWebhookMessage' };
        const res = await fetch(webhookUrl + (inputs.wait ? '?wait=true' : ''), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: inputs.content,
            username: inputs.username,
            avatar_url: inputs.avatarUrl,
            embeds: inputs.embeds,
            components: inputs.components,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { error: err.message || `sendWebhookMessage failed: ${res.status}` };
        }
        const data = inputs.wait ? await res.json() : { sent: true };
        return { output: data };
      }

      case 'sendMessage': {
        const res = await fetch(`${baseUrl}/channels/${inputs.channelId}/messages`, {
          method: 'POST',
          headers: botHeaders,
          body: JSON.stringify({
            content: inputs.content,
            embeds: inputs.embeds,
            components: inputs.components,
            message_reference: inputs.replyToMessageId ? { message_id: inputs.replyToMessageId } : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'sendMessage failed' };
        return { output: { id: data.id, channel_id: data.channel_id, content: data.content } };
      }

      case 'editMessage': {
        const res = await fetch(`${baseUrl}/channels/${inputs.channelId}/messages/${inputs.messageId}`, {
          method: 'PATCH',
          headers: botHeaders,
          body: JSON.stringify({ content: inputs.content, embeds: inputs.embeds }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'editMessage failed' };
        return { output: { id: data.id, content: data.content, edited_timestamp: data.edited_timestamp } };
      }

      case 'deleteMessage': {
        const res = await fetch(`${baseUrl}/channels/${inputs.channelId}/messages/${inputs.messageId}`, {
          method: 'DELETE',
          headers: botHeaders,
        });
        if (res.status === 204) return { output: { deleted: true, messageId: inputs.messageId } };
        const data = await res.json().catch(() => ({}));
        return { error: data.message || 'deleteMessage failed' };
      }

      case 'listGuilds': {
        const res = await fetch(`${baseUrl}/users/@me/guilds`, { headers: botHeaders });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'listGuilds failed' };
        return { output: { guilds: data } };
      }

      case 'getGuild': {
        const res = await fetch(`${baseUrl}/guilds/${inputs.guildId}?with_counts=${inputs.withCounts || false}`, {
          headers: botHeaders,
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'getGuild failed' };
        return { output: { guild: data } };
      }

      case 'listChannels': {
        const res = await fetch(`${baseUrl}/guilds/${inputs.guildId}/channels`, { headers: botHeaders });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'listChannels failed' };
        return { output: { channels: data } };
      }

      case 'getChannel': {
        const res = await fetch(`${baseUrl}/channels/${inputs.channelId}`, { headers: botHeaders });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'getChannel failed' };
        return { output: { channel: data } };
      }

      case 'createChannel': {
        const res = await fetch(`${baseUrl}/guilds/${inputs.guildId}/channels`, {
          method: 'POST',
          headers: botHeaders,
          body: JSON.stringify({
            name: inputs.name,
            type: inputs.type ?? 0,
            topic: inputs.topic,
            parent_id: inputs.parentId,
            position: inputs.position,
          }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'createChannel failed' };
        return { output: { channel: data } };
      }

      case 'listMembers': {
        const params = new URLSearchParams({ limit: inputs.limit || '100' });
        if (inputs.after) params.set('after', inputs.after);
        const res = await fetch(`${baseUrl}/guilds/${inputs.guildId}/members?${params}`, { headers: botHeaders });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'listMembers failed' };
        return { output: { members: data } };
      }

      case 'getMember': {
        const res = await fetch(`${baseUrl}/guilds/${inputs.guildId}/members/${inputs.userId}`, { headers: botHeaders });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'getMember failed' };
        return { output: { member: data } };
      }

      case 'addRole': {
        const res = await fetch(`${baseUrl}/guilds/${inputs.guildId}/members/${inputs.userId}/roles/${inputs.roleId}`, {
          method: 'PUT',
          headers: botHeaders,
        });
        if (res.status === 204) return { output: { added: true, roleId: inputs.roleId, userId: inputs.userId } };
        const data = await res.json().catch(() => ({}));
        return { error: data.message || 'addRole failed' };
      }

      case 'removeRole': {
        const res = await fetch(`${baseUrl}/guilds/${inputs.guildId}/members/${inputs.userId}/roles/${inputs.roleId}`, {
          method: 'DELETE',
          headers: botHeaders,
        });
        if (res.status === 204) return { output: { removed: true, roleId: inputs.roleId, userId: inputs.userId } };
        const data = await res.json().catch(() => ({}));
        return { error: data.message || 'removeRole failed' };
      }

      case 'createRole': {
        const res = await fetch(`${baseUrl}/guilds/${inputs.guildId}/roles`, {
          method: 'POST',
          headers: botHeaders,
          body: JSON.stringify({
            name: inputs.name,
            permissions: inputs.permissions,
            color: inputs.color,
            hoist: inputs.hoist || false,
            mentionable: inputs.mentionable || false,
          }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'createRole failed' };
        return { output: { role: data } };
      }

      case 'listRoles': {
        const res = await fetch(`${baseUrl}/guilds/${inputs.guildId}/roles`, { headers: botHeaders });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'listRoles failed' };
        return { output: { roles: data } };
      }

      default:
        return { error: `Unknown Discord Webhook action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`DiscordWebhook error [${actionName}]: ${err.message}`);
    return { error: err.message || 'Unexpected error in Discord Webhook action' };
  }
}
