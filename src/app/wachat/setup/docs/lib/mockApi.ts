import { DocArticle, WABaStatus } from './types';

const MOCK_ARTICLES: DocArticle[] = [
  {
    id: '1',
    title: 'How to verify your business',
    content: 'Business verification is required to increase your messaging limits and display your business name. Navigate to the Security Center in your Meta Business Settings to start the process.',
    updatedAt: '2023-10-01T10:00:00Z',
    category: 'setup',
  },
  {
    id: '2',
    title: 'Resolving template rejection',
    content: 'Template messages are reviewed against WhatsApp Commerce and Business Policies. Ensure your templates are formatting correctly and do not violate any rules.',
    updatedAt: '2023-10-15T12:00:00Z',
    category: 'troubleshooting',
  },
  {
    id: '3',
    title: 'Increasing message limits',
    content: 'Your messaging limit starts at 250 business-initiated conversations in a 24-hour period. Send high-quality messages to naturally upgrade your tier.',
    updatedAt: '2023-11-01T09:00:00Z',
    category: 'best-practices',
  },
  {
    id: '4',
    title: 'Setting up webhooks correctly',
    content: 'Webhooks allow you to receive real-time HTTP notifications for changes in specific objects. Ensure your webhook URL is accessible and returns a 200 OK status.',
    updatedAt: '2023-11-20T14:30:00Z',
    category: 'setup',
  },
  {
    id: '5',
    title: 'Handling rate limits',
    content: 'The WhatsApp Cloud API imposes rate limits. Implement exponential backoff in your application to handle 429 Too Many Requests errors gracefully.',
    updatedAt: '2023-12-05T08:15:00Z',
    category: 'troubleshooting',
  },
];

export async function fetchArticles(): Promise<DocArticle[]> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // For demonstration, uncomment to simulate errors:
      // if (Math.random() < 0.2) {
      //   return reject({ message: 'Failed to fetch documentation. Please try again.', code: 'FETCH_ERROR' });
      // }
      resolve([...MOCK_ARTICLES]);
    }, 1200);
  });
}

export async function fetchStatus(): Promise<WABaStatus> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: 'pending',
        lastChecked: new Date().toISOString(),
        qualityRating: 'green',
      });
    }, 800);
  });
}
