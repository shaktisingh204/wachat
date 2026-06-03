export const getURLSafely = (url: string): URL | null => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};
