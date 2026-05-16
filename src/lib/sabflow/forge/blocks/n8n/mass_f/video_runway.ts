/**
 * Forge block: Video Runway Gen-3
 *
 * Generates video with Runway's Gen-3 Alpha Turbo via the
 * `https://api.dev.runwayml.com/v1/image_to_video` endpoint. The Runway API is
 * async — this block submits the task and returns the `taskId`. Use a follow-up
 * polling action or webhook to retrieve the rendered video URL once status
 * reaches `SUCCEEDED`.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const BASE = 'https://api.dev.runwayml.com/v1';

async function generate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Runway: apiKey is required');
  const promptImage = asString(ctx.options.promptImage);
  if (!promptImage) throw new Error('Runway: promptImage URL is required');
  const promptText = asString(ctx.options.promptText);
  const model = asString(ctx.options.model) || 'gen3a_turbo';
  const duration = asNumber(ctx.options.duration) ?? 5;
  const ratio = asString(ctx.options.ratio) || '1280:768';

  const body: Record<string, unknown> = {
    model,
    promptImage,
    duration,
    ratio,
  };
  if (promptText) body.promptText = promptText;

  const res = await apiRequest({
    service: 'Runway',
    method: 'POST',
    url: `${BASE}/image_to_video`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-Runway-Version': '2024-11-06',
    },
    json: body,
  });
  const data = res.data as { id?: string };
  return {
    outputs: { taskId: data?.id ?? '', url: '', raw: res.data },
    logs: [`Runway task queued → ${data?.id}`],
  };
}

async function getTask(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Runway: apiKey is required');
  const taskId = asString(ctx.options.taskId);
  if (!taskId) throw new Error('Runway: taskId is required');

  const res = await apiRequest({
    service: 'Runway',
    method: 'GET',
    url: `${BASE}/tasks/${encodeURIComponent(taskId)}`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-Runway-Version': '2024-11-06',
    },
  });
  const data = res.data as { status?: string; output?: string[]; failure?: string };
  return {
    outputs: {
      taskId,
      status: data?.status ?? '',
      url: data?.output?.[0] ?? '',
      failure: data?.failure ?? '',
      raw: res.data,
    },
    logs: [`Runway task ${taskId} → ${data?.status}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_video_runway',
  name: 'Video Runway',
  description: 'Generate video with Runway Gen-3 (image → video). Async.',
  iconName: 'LuVideo',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'generate',
      label: 'Generate video (queue task)',
      description: 'Submit an image-to-video task. Output: `taskId` to poll later.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'gen3a_turbo' },
        { id: 'promptImage', label: 'Source image URL', type: 'text', required: true },
        { id: 'promptText', label: 'Motion prompt', type: 'textarea' },
        { id: 'duration', label: 'Duration (sec)', type: 'number', defaultValue: 5 },
        { id: 'ratio', label: 'Ratio', type: 'text', defaultValue: '1280:768', placeholder: '1280:768 | 768:1280' },
      ],
      run: generate,
    },
    {
      id: 'getTask',
      label: 'Get task status',
      description: 'Poll a Runway task; once `status` is SUCCEEDED, `url` will be set.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'taskId', label: 'Task ID', type: 'text', required: true },
      ],
      run: getTask,
    },
  ],
};

registerForgeBlock(block);
export default block;
