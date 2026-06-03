const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export const buildSignedPath = ({
  path,
  token,
}: {
  path: string;
  token: string;
}): string => {
  if (path.startsWith('https:') || path.startsWith('http:')) {
    return path;
  }

  const directories = path.split('/');

  const filename = directories.pop();

  if (!isNonEmptyString(filename)) {
    throw new Error(
      `Filename empty: cannot build signed path from folderPath '${path}'`,
    );
  }

  return `${directories.join('/')}/${token}/${filename}`;
};
