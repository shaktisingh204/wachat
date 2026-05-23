const fs = require('fs');
const file = 'src/app/actions/worksuite/chat.actions.ts';
let code = fs.readFileSync(file, 'utf8');

// add import
code = code.replace(
  "import { revalidatePath } from 'next/cache';",
  "import { revalidatePath } from 'next/cache';\nimport { publishWorksuiteEvent } from '@/lib/worksuite/realtime';"
);

// modify getConversationWith for cursor
code = code.replace(
  "export async function getConversationWith(\n  peerUserId: string,\n): Promise<(WsUserChat & { files?: WsUserchatFile[] })[]> {",
  "export async function getConversationWith(\n  peerUserId: string,\n  cursor?: string,\n  limit = 50\n): Promise<(WsUserChat & { files?: WsUserchatFile[] })[]> {"
);
code = code.replace(
  ".find({\n      userId: toObjectId(user._id),\n      $or: [\n        { from_user_id: user._id, to_user_id: peerUserId },\n        { from_user_id: peerUserId, to_user_id: user._id },\n      ],\n    })",
  ".find({\n      userId: toObjectId(user._id),\n      ...(cursor ? { _id: { $lt: toObjectId(cursor) } } : {}),\n      $or: [\n        { from_user_id: user._id, to_user_id: peerUserId },\n        { from_user_id: peerUserId, to_user_id: user._id },\n      ],\n    })"
);
code = code.replace(
  ".sort({ createdAt: 1 })\n    .toArray();",
  ".sort({ createdAt: -1 })\n    .limit(limit)\n    .toArray();\n  chats.reverse();"
);

// modify sendMessage
code = code.replace(
  "  revalidatePath('/dashboard/crm/messages');\n  revalidatePath(`/dashboard/crm/messages/${toUserId}`);\n  return { message: 'Message sent', id: chatId };",
  "  const finalMsg = {\n    ...chatDoc,\n    _id: chatId,\n    files: fileUrls.length > 0 ? fileUrls.map(f => ({\n      _id: new ObjectId().toString(),\n      chat_id: chatId,\n      ...f,\n    })) : [],\n  };\n  await publishWorksuiteEvent({\n    type: 'NEW_MESSAGE',\n    userId: toUserId,\n    payload: finalMsg,\n  });\n  revalidatePath('/dashboard/crm/messages');\n  revalidatePath(`/dashboard/crm/messages/${toUserId}`);\n  return { message: 'Message sent', id: chatId, finalMsg };"
);

// modify markAllChatsRead
code = code.replace(
  "  revalidatePath('/dashboard/crm/messages');\n  revalidatePath(`/dashboard/crm/messages/${fromUserId}`);\n  return { success: true };\n}",
  "  await publishWorksuiteEvent({\n    type: 'MESSAGE_READ',\n    userId: fromUserId,\n    payload: { byUserId: user._id },\n  });\n  revalidatePath('/dashboard/crm/messages');\n  revalidatePath(`/dashboard/crm/messages/${fromUserId}`);\n  return { success: true };\n}"
);

// modify notify
code = code.replace(
  "  revalidatePath('/dashboard/crm/notifications');\n  return { message: 'Notification sent', id: res.insertedId.toString() };",
  "  await publishWorksuiteEvent({\n    type: 'NEW_NOTIFICATION',\n    userId: recipientUserId,\n    payload: { notification: { _id: res.insertedId.toString(), ...payload, read_at: null, createdAt: now } },\n  });\n  revalidatePath('/dashboard/crm/notifications');\n  return { message: 'Notification sent', id: res.insertedId.toString() };"
);

// add pingTyping action
code = code.replace(
  "export async function sendMessage",
  "export async function pingTyping(toUserId: string) {\n  const user = await requireSession();\n  if (!user) return;\n  await publishWorksuiteEvent({\n    type: 'TYPING',\n    userId: toUserId,\n    payload: { fromUserId: user._id },\n  });\n}\n\nexport async function sendMessage"
);

fs.writeFileSync(file, code);
