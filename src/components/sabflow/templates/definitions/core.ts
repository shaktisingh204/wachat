import {
  LuUserRoundSearch,
  LuHeadphones,
  LuMessageSquareText,
  LuBrain,
} from 'react-icons/lu';
import type { TemplateDefinition } from '../types';
import {
  edgeBetweenGroups,
  edgeFromItem,
  id,
  linkStartToGroup,
  makeGroup,
  makeStartEvent,
  textBlock,
  variable,
  makeBlock,
} from '../builders';

/* ═══════════════════════════════════════════════════════════
   Core templates — the original 4 that ship with SabFlow.
   Each template's `build()` returns fresh IDs on every call so
   users get a clean copy of the graph every time.
   ═══════════════════════════════════════════════════════════ */

export const leadCaptureTemplate: TemplateDefinition = {
  id: 'lead-capture',
  name: 'Lead Capture',
  description: 'Collect name, email, and phone number from prospects.',
  emoji: '🎯',
  color: 'text-blue-600',
  bgColor:
    'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
  icon: LuUserRoundSearch,
  category: 'Marketing',
  build: () => {
    const vName = variable('name');
    const vEmail = variable('email');
    const vPhone = variable('phone');

    const event = makeStartEvent();

    const welcome = makeGroup('Welcome', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "Hi there! 👋 I'd love to learn a bit about you. What's your name?"),
      makeBlock(gid, 'text_input', {
        variableId: vName.id,
        placeholder: 'Your full name…',
      }),
    ]);

    const contact = makeGroup('Contact details', { x: 340, y: 300 }, (gid) => [
      textBlock(gid, 'Nice to meet you, {{name}}! What is your email address?'),
      makeBlock(gid, 'email_input', {
        variableId: vEmail.id,
        placeholder: 'you@example.com',
      }),
      textBlock(gid, 'And your phone number?'),
      makeBlock(gid, 'phone_input', {
        variableId: vPhone.id,
        placeholder: '+1 (555) 000-0000',
      }),
    ]);

    const thanks = makeGroup('Thank you', { x: 340, y: 560 }, (gid) => [
      textBlock(gid, 'Thanks, {{name}}! We will be in touch soon. 🎉'),
    ]);

    const groups = [welcome, contact, thanks];
    const edges = [
      linkStartToGroup(event, welcome),
      edgeBetweenGroups(welcome.id, contact.id),
      edgeBetweenGroups(contact.id, thanks.id),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vName, vEmail, vPhone],
      theme: {},
      settings: {},
    };
  },
};

export const customerSupportTemplate: TemplateDefinition = {
  id: 'customer-support',
  name: 'Customer Support',
  description: 'Route users to the right support agent or knowledge base.',
  emoji: '🎧',
  color: 'text-purple-600',
  bgColor:
    'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800',
  icon: LuHeadphones,
  category: 'Support',
  build: () => {
    const vIssue = variable('issue_type');
    const vDescription = variable('description');

    const event = makeStartEvent();

    // Prepare choice item ids up front so the outgoing edges can reference them.
    const choiceItems = [
      'Billing & Payments',
      'Technical Issue',
      'Account Management',
      'Something else',
    ].map((content) => ({ id: id(), content }));

    const greeting = makeGroup('Greeting', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, 'Hello! How can I help you today? Please choose a topic:'),
      makeBlock(gid, 'choice_input', { variableId: vIssue.id }, choiceItems),
    ]);

    const describe = makeGroup('Describe issue', { x: 340, y: 320 }, (gid) => [
      textBlock(gid, 'Please describe your issue in a few words.'),
      makeBlock(gid, 'text_input', {
        variableId: vDescription.id,
        placeholder: 'Describe your issue…',
        isLong: true,
      }),
    ]);

    const confirmation = makeGroup('Confirmation', { x: 340, y: 560 }, (gid) => [
      textBlock(
        gid,
        "Got it! Your request has been logged under **{{issue_type}}**. Our team will get back to you within 24 hours.",
      ),
    ]);

    // Point every choice at the describe group so any branch ends up there.
    const choiceBlockId = greeting.blocks[1].id;
    const edgesFromChoices = choiceItems.map((item) =>
      edgeFromItem(greeting.id, choiceBlockId, item.id, describe.id),
    );

    const groups = [greeting, describe, confirmation];
    const edges = [
      linkStartToGroup(event, greeting),
      ...edgesFromChoices,
      edgeBetweenGroups(describe.id, confirmation.id),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vIssue, vDescription],
      theme: {},
      settings: {},
    };
  },
};

export const feedbackSurveyTemplate: TemplateDefinition = {
  id: 'feedback-survey',
  name: 'Feedback Survey',
  description: 'Gather product or service feedback with ratings and comments.',
  emoji: '📝',
  color: 'text-green-600',
  bgColor:
    'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
  icon: LuMessageSquareText,
  category: 'Marketing',
  build: () => {
    const vRating = variable('rating');
    const vFeedback = variable('feedback');
    const vRecommend = variable('recommend');

    const event = makeStartEvent();

    const welcome = makeGroup('Welcome', { x: 340, y: 80 }, (gid) => [
      textBlock(
        gid,
        "Thanks for using our service! We'd love to hear your feedback. It only takes 1 minute. 🙏",
      ),
    ]);

    const rating = makeGroup('Rating', { x: 340, y: 280 }, (gid) => [
      textBlock(gid, 'How would you rate your experience overall?'),
      makeBlock(gid, 'rating_input', {
        variableId: vRating.id,
        length: 5,
        buttonType: 'Icons',
      }),
    ]);

    const comments = makeGroup('Comments', { x: 340, y: 480 }, (gid) => [
      textBlock(gid, 'Any additional comments or suggestions?'),
      makeBlock(gid, 'text_input', {
        variableId: vFeedback.id,
        placeholder: 'Your feedback…',
        isLong: true,
      }),
    ]);

    const thanks = makeGroup('Thank you', { x: 340, y: 700 }, (gid) => [
      textBlock(
        gid,
        'Thank you for your feedback! You gave us **{{rating}} stars**. We really appreciate it. ⭐',
      ),
    ]);

    const groups = [welcome, rating, comments, thanks];
    const edges = [
      linkStartToGroup(event, welcome),
      edgeBetweenGroups(welcome.id, rating.id),
      edgeBetweenGroups(rating.id, comments.id),
      edgeBetweenGroups(comments.id, thanks.id),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vRating, vFeedback, vRecommend],
      theme: {},
      settings: {},
    };
  },
};

export const quizTemplate: TemplateDefinition = {
  id: 'quiz',
  name: 'Quiz',
  description: 'Engage users with a trivia or knowledge quiz.',
  emoji: '🧠',
  color: 'text-orange-600',
  bgColor:
    'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
  icon: LuBrain,
  category: 'Marketing',
  build: () => {
    const vQ1 = variable('q1_answer');
    const vQ2 = variable('q2_answer');
    const vName = variable('participant_name');

    const event = makeStartEvent();

    const intro = makeGroup('Intro', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "Welcome to the quiz! 🧠 Let's get started. What's your name?"),
      makeBlock(gid, 'text_input', { variableId: vName.id, placeholder: 'Your name…' }),
    ]);

    const q1Items = ['London', 'Berlin', 'Paris', 'Madrid'].map((content) => ({
      id: id(),
      content,
    }));
    const q1 = makeGroup('Question 1', { x: 340, y: 300 }, (gid) => [
      textBlock(gid, 'Question 1: What is the capital of France?'),
      makeBlock(gid, 'choice_input', { variableId: vQ1.id }, q1Items),
    ]);

    const q2Items = ['5', '6', '7', '8'].map((content) => ({
      id: id(),
      content,
    }));
    const q2 = makeGroup('Question 2', { x: 340, y: 540 }, (gid) => [
      textBlock(gid, 'Question 2: How many continents are there?'),
      makeBlock(gid, 'choice_input', { variableId: vQ2.id }, q2Items),
    ]);

    const results = makeGroup('Results', { x: 340, y: 780 }, (gid) => [
      textBlock(
        gid,
        'Great job, {{participant_name}}! You answered: Q1 → {{q1_answer}}, Q2 → {{q2_answer}}. Stay tuned for your score!',
      ),
    ]);

    const q1ChoiceBlockId = q1.blocks[1].id;
    const q2ChoiceBlockId = q2.blocks[1].id;

    const edgesQ1 = q1Items.map((item) =>
      edgeFromItem(q1.id, q1ChoiceBlockId, item.id, q2.id),
    );
    const edgesQ2 = q2Items.map((item) =>
      edgeFromItem(q2.id, q2ChoiceBlockId, item.id, results.id),
    );

    const groups = [intro, q1, q2, results];
    const edges = [
      linkStartToGroup(event, intro),
      edgeBetweenGroups(intro.id, q1.id),
      ...edgesQ1,
      ...edgesQ2,
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vQ1, vQ2, vName],
      theme: {},
      settings: {},
    };
  },
};
