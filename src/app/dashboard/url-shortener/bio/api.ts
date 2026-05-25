import { BioState, ApiResponse } from './types';

const STORAGE_KEY = 'url-shortener-bio-v2';

const generateMockGeoData = () => ({
  US: Math.floor(Math.random() * 500),
  UK: Math.floor(Math.random() * 300),
  IN: Math.floor(Math.random() * 800),
  DE: Math.floor(Math.random() * 200),
  FR: Math.floor(Math.random() * 150),
});

export const fetchBioData = async (): Promise<ApiResponse<BioState>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          // Add mock analytics and AB testing to existing links if missing
          parsed.links = parsed.links.map((link: any) => ({
            ...link,
            clicks: link.clicks ?? Math.floor(Math.random() * 1000),
            geoData: link.geoData ?? generateMockGeoData(),
            enableABTesting: link.enableABTesting ?? false,
            urlB: link.urlB ?? '',
            splitRatio: link.splitRatio ?? 50,
          }));
          resolve({ data: parsed, error: null });
        } else {
          resolve({
            data: {
              slug: '',
              title: '',
              bio: '',
              avatarUrl: '',
              links: [],
              theme: 'dark',
              createdAt: new Date().toISOString(),
            },
            error: null,
          });
        }
      } catch (e) {
        resolve({
          data: null,
          error: { message: 'Failed to parse bio data', code: 'PARSE_ERR' },
        });
      }
    }, 800);
  });
};

export const saveBioData = async (data: BioState): Promise<ApiResponse<BioState>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        if (data.slug === 'error') {
          return resolve({
            data: null,
            error: { message: 'Slug "error" is reserved', code: 'API_ERR' },
          });
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        resolve({ data, error: null });
      } catch (e) {
        resolve({
          data: null,
          error: { message: 'Failed to save bio data', code: 'SAVE_ERR' },
        });
      }
    }, 500);
  });
};
