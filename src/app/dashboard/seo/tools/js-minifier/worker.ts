import { minify } from 'terser';

self.onmessage = async (e: MessageEvent<{ id: number; code: string; mangle: boolean }>) => {
  const { id, code, mangle } = e.data;
  try {
    const result = await minify(code, { mangle });
    self.postMessage({ id, success: true, result: result.code });
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err.message });
  }
};
