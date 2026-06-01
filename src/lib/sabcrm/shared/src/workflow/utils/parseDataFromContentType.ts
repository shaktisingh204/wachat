type InputData = Record<string, string> | string;

const parseUrlEncoded = (data: InputData): string => {
  let parsedData: Record<string, string> | string = data;
  if (typeof data === 'string') {
    try {
      parsedData = JSON.parse(data) as Record<string, string>;
    } catch {
      parsedData = data;
    }
  }
  return new URLSearchParams(parsedData as Record<string, string>).toString();
};

const parseFormData = (data: InputData): FormData => {
  const form = new FormData();
  if (typeof data === 'string') {
    try {
      const obj = JSON.parse(data) as Record<string, unknown>;

      Object.entries(obj).forEach(([key, val]) =>
        form.append(key, String(val)),
      );
    } catch {
      throw new Error('String data for FormData must be valid JSON');
    }
  } else {
    Object.entries(data).forEach(([key, val]) => form.append(key, val));
  }
  return form;
};

const parseJson = (data: InputData): string => {
  if (typeof data === 'string') {
    return data;
  }
  return JSON.stringify(data);
};

const parseText = (data: InputData): string => {
  if (typeof data === 'string') {
    return data;
  }

  return Object.entries(data)
    .map(([key, val]) => `${key}=${val}`)
    .join('\n');
};

export const parseDataFromContentType = (
  data: InputData,
  contentType?: string,
): string | FormData => {
  if (contentType === undefined) {
    return parseJson(data);
  }
  switch (contentType) {
    case 'application/x-www-form-urlencoded':
      return parseUrlEncoded(data);
    case 'multipart/form-data':
      return parseFormData(data);
    case 'application/json':
      return parseJson(data);
    case 'text/plain':
      return parseText(data);
    default:
      return parseJson(data);
  }
};
