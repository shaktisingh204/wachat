export type BioLink = {
  id: string;
  label: string;
  url: string;
  enableABTesting?: boolean;
  urlB?: string;
  splitRatio?: number;
  clicks?: number;
  geoData?: Record<string, number>;
};

export type BioState = {
  slug: string;
  title: string;
  bio: string;
  avatarUrl: string;
  links: BioLink[];
  theme: string;
  createdAt: string;
};

export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string; code: string } };
