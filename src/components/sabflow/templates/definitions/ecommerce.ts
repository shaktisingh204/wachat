import {
  LuPackage,
  LuUtensils,
  LuRotateCw,
  LuCircleHelp,
} from 'react-icons/lu';
import type { TemplateDefinition } from '../types';
import {
  edgeBetweenGroups,
  edgeFromItem,
  id,
  linkStartToGroup,
  makeBlock,
  makeGroup,
  makeStartEvent,
  textBlock,
  variable,
} from '../builders';

/* ═══════════════════════════════════════════════════════════
   E-commerce / support templates
   ═══════════════════════════════════════════════════════════ */

/* ── 6. Order Tracking ──────────────────────────────────── */
export const orderTrackingTemplate: TemplateDefinition = {
  id: 'order-tracking',
  name: 'Order Tracking',
  description: 'Asks for an order ID and fetches live status via webhook.',
  emoji: '📦',
  color: 'text-amber-600',
  bgColor:
    'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  icon: LuPackage,
  category: 'E-commerce',
  build: () => {
    const vOrderId = variable('order_id');
    const vEmail = variable('email');
    const vStatus = variable('order_status');

    const event = makeStartEvent();

    const intro = makeGroup('Intro', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "📦 Let's track your order!"),
      textBlock(gid, 'What is your order ID?'),
      makeBlock(gid, 'text_input', {
        variableId: vOrderId.id,
        placeholder: 'e.g. ORD-12345',
      }),
    ]);

    const emailStep = makeGroup('Verify email', { x: 340, y: 320 }, (gid) => [
      textBlock(gid, "For security, what's the email on the order?"),
      makeBlock(gid, 'email_input', {
        variableId: vEmail.id,
        placeholder: 'you@example.com',
      }),
    ]);

    const fetch = makeGroup('Fetch status', { x: 340, y: 540 }, (gid) => [
      makeBlock(gid, 'webhook', {
        url: 'https://api.example.com/orders/{{order_id}}',
        method: 'GET',
        headers: [
          { id: id(), key: 'Accept', value: 'application/json' },
        ],
        responseVariable: vStatus.id,
      }),
    ]);

    const showStatus = makeGroup('Result', { x: 340, y: 740 }, (gid) => [
      textBlock(
        gid,
        "Here's the latest on order **{{order_id}}**:\n\n{{order_status}}",
      ),
      textBlock(gid, "Need anything else? Just ask our support team."),
    ]);

    const groups = [intro, emailStep, fetch, showStatus];
    const edges = [
      linkStartToGroup(event, intro),
      edgeBetweenGroups(intro.id, emailStep.id),
      edgeBetweenGroups(emailStep.id, fetch.id),
      edgeBetweenGroups(fetch.id, showStatus.id),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vOrderId, vEmail, vStatus],
      theme: {},
      settings: {},
    };
  },
};

/* ── 7. Restaurant Menu ─────────────────────────────────── */
export const restaurantMenuTemplate: TemplateDefinition = {
  id: 'restaurant-menu',
  name: 'Restaurant Menu',
  description: 'Interactive menu with categories and picture choices.',
  emoji: '🍽️',
  color: 'text-red-600',
  bgColor:
    'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
  icon: LuUtensils,
  category: 'E-commerce',
  build: () => {
    const vCategory = variable('category');
    const vItem = variable('item');
    const vQuantity = variable('quantity');

    const event = makeStartEvent();

    const welcome = makeGroup('Welcome', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "🍽️ Welcome! What would you like today?"),
    ]);

    const categoryItems = [
      { id: id(), content: 'Starters', title: 'Starters', pictureSrc: 'https://placehold.co/200x200?text=Starters' },
      { id: id(), content: 'Mains', title: 'Mains', pictureSrc: 'https://placehold.co/200x200?text=Mains' },
      { id: id(), content: 'Desserts', title: 'Desserts', pictureSrc: 'https://placehold.co/200x200?text=Desserts' },
      { id: id(), content: 'Drinks', title: 'Drinks', pictureSrc: 'https://placehold.co/200x200?text=Drinks' },
    ];
    const category = makeGroup('Category', { x: 340, y: 240 }, (gid) => [
      textBlock(gid, 'Pick a category:'),
      makeBlock(
        gid,
        'picture_choice_input',
        { variableId: vCategory.id },
        categoryItems,
      ),
    ]);

    const pickItem = makeGroup('Pick dish', { x: 340, y: 460 }, (gid) => [
      textBlock(gid, 'Which **{{category}}** would you like?'),
      makeBlock(gid, 'text_input', {
        variableId: vItem.id,
        placeholder: 'e.g. Margherita Pizza',
      }),
    ]);

    const qty = makeGroup('Quantity', { x: 340, y: 660 }, (gid) => [
      textBlock(gid, 'How many?'),
      makeBlock(gid, 'number_input', {
        variableId: vQuantity.id,
        placeholder: '1',
        min: 1,
        max: 20,
      }),
    ]);

    const confirm = makeGroup('Confirmation', { x: 340, y: 860 }, (gid) => [
      textBlock(
        gid,
        "✅ **{{quantity}} × {{item}}** from **{{category}}** — coming right up! 🍕",
      ),
    ]);

    const categoryBlockId = category.blocks[1].id;
    const groups = [welcome, category, pickItem, qty, confirm];
    const edges = [
      linkStartToGroup(event, welcome),
      edgeBetweenGroups(welcome.id, category.id),
      ...categoryItems.map((item) =>
        edgeFromItem(category.id, categoryBlockId, item.id, pickItem.id),
      ),
      edgeBetweenGroups(pickItem.id, qty.id),
      edgeBetweenGroups(qty.id, confirm.id),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vCategory, vItem, vQuantity],
      theme: {},
      settings: {},
    };
  },
};

/* ── 10. Product Returns ────────────────────────────────── */
export const productReturnsTemplate: TemplateDefinition = {
  id: 'product-returns',
  name: 'Product Returns',
  description: 'Handles return requests with reason, order ID, and photos.',
  emoji: '🔁',
  color: 'text-rose-600',
  bgColor:
    'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800',
  icon: LuRotateCw,
  category: 'E-commerce',
  build: () => {
    const vOrderId = variable('order_id');
    const vReason = variable('return_reason');
    const vPhotos = variable('photos');
    const vNotes = variable('notes');

    const event = makeStartEvent();

    const intro = makeGroup('Intro', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "🔁 Sorry to hear that! Let's process your return."),
      textBlock(gid, 'What is your order ID?'),
      makeBlock(gid, 'text_input', {
        variableId: vOrderId.id,
        placeholder: 'ORD-12345',
      }),
    ]);

    const reasonItems = [
      'Item was damaged',
      'Wrong item shipped',
      "Doesn't fit / size issue",
      'Changed my mind',
      'Other',
    ].map((content) => ({ id: id(), content }));
    const reason = makeGroup('Reason', { x: 340, y: 320 }, (gid) => [
      textBlock(gid, "What's the reason for return?"),
      makeBlock(gid, 'choice_input', { variableId: vReason.id }, reasonItems),
    ]);

    const photos = makeGroup('Photos', { x: 340, y: 540 }, (gid) => [
      textBlock(gid, 'Please upload a photo of the item so we can review it:'),
      makeBlock(gid, 'file_input', {
        variableId: vPhotos.id,
        isMultipleAllowed: true,
        allowedFileTypes: { isEnabled: true, types: ['image/*'] },
        labels: { placeholder: 'Drop photos here', button: 'Upload' },
      }),
    ]);

    const notes = makeGroup('Notes', { x: 340, y: 760 }, (gid) => [
      textBlock(gid, 'Anything else you want us to know? (optional)'),
      makeBlock(gid, 'text_input', {
        variableId: vNotes.id,
        placeholder: 'Add any notes…',
        isLong: true,
      }),
    ]);

    const confirm = makeGroup('Confirmation', { x: 340, y: 960 }, (gid) => [
      textBlock(
        gid,
        "Got it! Return request for **{{order_id}}** logged under _{{return_reason}}_. We'll email you a prepaid label within 24 hours. 📨",
      ),
    ]);

    const reasonBlockId = reason.blocks[1].id;
    const groups = [intro, reason, photos, notes, confirm];
    const edges = [
      linkStartToGroup(event, intro),
      edgeBetweenGroups(intro.id, reason.id),
      ...reasonItems.map((item) =>
        edgeFromItem(reason.id, reasonBlockId, item.id, photos.id),
      ),
      edgeBetweenGroups(photos.id, notes.id),
      edgeBetweenGroups(notes.id, confirm.id),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vOrderId, vReason, vPhotos, vNotes],
      theme: {},
      settings: {},
    };
  },
};

/* ── 8. FAQ Bot ─────────────────────────────────────────── */
export const faqBotTemplate: TemplateDefinition = {
  id: 'faq-bot',
  name: 'FAQ Bot',
  description: 'Answers common questions using condition branches.',
  emoji: '❓',
  color: 'text-violet-600',
  bgColor:
    'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800',
  icon: LuCircleHelp,
  category: 'Support',
  build: () => {
    const vTopic = variable('topic');

    const event = makeStartEvent();

    const intro = makeGroup('Intro', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "👋 Hi! I can answer most common questions. What are you curious about?"),
    ]);

    const topicItems = [
      'Pricing',
      'Shipping',
      'Returns',
      'Account & Login',
    ].map((content) => ({ id: id(), content }));
    const topicGroup = makeGroup('Pick topic', { x: 340, y: 240 }, (gid) => [
      makeBlock(gid, 'choice_input', { variableId: vTopic.id }, topicItems),
    ]);

    const pricing = makeGroup('Pricing', { x: 80, y: 440 }, (gid) => [
      textBlock(gid, "💰 We offer three plans: Starter ($19/mo), Pro ($49/mo), and Enterprise (custom). All plans include a 14-day free trial."),
    ]);
    const shipping = makeGroup('Shipping', { x: 300, y: 440 }, (gid) => [
      textBlock(gid, "🚚 Standard shipping takes 3-5 business days. Free shipping on orders over $50."),
    ]);
    const returns = makeGroup('Returns', { x: 520, y: 440 }, (gid) => [
      textBlock(gid, "🔁 We accept returns within 30 days of purchase. Item must be unused and in original packaging."),
    ]);
    const account = makeGroup('Account', { x: 740, y: 440 }, (gid) => [
      textBlock(gid, "🔐 Trouble logging in? Reset your password from the login page, or email support@example.com."),
    ]);

    const moreHelp = makeGroup('Still need help?', { x: 340, y: 640 }, (gid) => [
      textBlock(gid, "Anything else? Reply with your question and a human will jump in shortly."),
    ]);

    const topicBlockId = topicGroup.blocks[0].id;
    const groups = [intro, topicGroup, pricing, shipping, returns, account, moreHelp];

    const topicTargets: Record<string, { id: string }> = {
      Pricing: pricing,
      Shipping: shipping,
      Returns: returns,
      'Account & Login': account,
    };
    const topicEdges = topicItems.map((item) => {
      const target = topicTargets[item.content];
      return edgeFromItem(topicGroup.id, topicBlockId, item.id, target.id);
    });

    const edges = [
      linkStartToGroup(event, intro),
      edgeBetweenGroups(intro.id, topicGroup.id),
      ...topicEdges,
      edgeBetweenGroups(pricing.id, moreHelp.id),
      edgeBetweenGroups(shipping.id, moreHelp.id),
      edgeBetweenGroups(returns.id, moreHelp.id),
      edgeBetweenGroups(account.id, moreHelp.id),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vTopic],
      theme: {},
      settings: {},
    };
  },
};
