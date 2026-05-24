import { minify } from 'terser';

self.onmessage = async (e: MessageEvent<{ id: number; code: string }>) => {
  const { id, code } = e.data;
  try {
    const result = await minify(code);
    self.postMessage({ id, success: true, result: result.code });
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err.message });
  }
};
