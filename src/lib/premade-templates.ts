
import type { Template } from '@/app/dashboard/page';

// Note: This is a static library of templates. The `components` array is structured
// to be compatible with the `handleCreateTemplate` action.
export const premadeTemplates: Omit<Template, 'metaId' | 'status' | 'qualityScore'>[] = [
  {
    name: 'order_confirmation_shipping',
    category: 'UTILITY',
    language: 'en_US',
    body: 'Hello {{1}}! Your order #{{2}} has been shipped and is on its way. You can track your package here: {{3}}',
    components: [
      {
        type: 'BODY',
        text: 'Hello {{1}}! Your order #{{2}} has been shipped and is on its way. You can track your package here: {{3}}',
        example: {
          body_text: [
            ['John Doe', '12345', 'https://example.com/track/xyz']
          ]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Track Order',
            url: 'https://www.example.com/track/{{1}}',
            example: ['https://www.example.com/track/abc-123']
          }
        ]
      }
    ],
  },
  {
    name: 'appointment_reminder_24hr',
    category: 'UTILITY',
    language: 'en_US',
    body: 'Hi {{1}}, this is a reminder for your appointment tomorrow at {{2}}. Please reply YES to confirm or NO to reschedule.',
    components: [
        {
            type: 'BODY',
            text: 'Hi {{1}}, this is a reminder for your appointment tomorrow at {{2}}. Please reply YES to confirm or NO to reschedule.',
            example: {
                body_text: [
                    ['Maria', '10:30 AM']
                ]
            }
        },
        {
            type: 'BUTTONS',
            buttons: [
                {
                    type: 'QUICK_REPLY',
                    text: 'Confirm'
                },
                {
                    type: 'QUICK_REPLY',
                    text: 'Reschedule'
                }
            ]
        }
    ]
  },
  {
    name: 'flash_sale_promo',
    category: 'MARKETING',
    language: 'en_US',
    body: '🚀 FLASH SALE! Get 25% off all items for the next 24 hours. Don\'t miss out on these amazing deals. Use code SALE25 at checkout!',
    headerSampleUrl: 'https://placehold.co/1024x512.png',
    components: [
        {
            type: 'HEADER',
            format: 'IMAGE',
        },
        {
            type: 'BODY',
            text: '🚀 FLASH SALE! Get 25% off all items for the next 24 hours. Don\'t miss out on these amazing deals. Use code SALE25 at checkout!',
        },
        {
            type: 'BUTTONS',
            buttons: [
                {
                    type: 'URL',
                    text: 'Shop Now',
                    url: 'https://www.example.com/sale'
                }
            ]
        }
    ],
  },
   {
    name: 'customer_feedback_survey',
    category: 'UTILITY',
    language: 'en_US',
    body: 'Hi {{1}}, thanks for your recent purchase! We\'d love to get your feedback. How would you rate your experience?',
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}, thanks for your recent purchase! We\'d love to get your feedback. How would you rate your experience?',
         example: {
            body_text: [
                ['David']
            ]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'QUICK_REPLY',
            text: '⭐ Great'
          },
          {
            type: 'QUICK_REPLY',
            text: '👍 Good'
          },
          {
            type: 'QUICK_REPLY',
            text: '😕 Okay'
          }
        ]
      }
    ]
  },
];
