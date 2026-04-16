import {
  LuGift,
  LuNewspaper,
  LuRocket,
  LuClipboardList,
  LuHouse,
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
   Marketing / sales templates
   ═══════════════════════════════════════════════════════════ */

/* ── 1. Product Recommendation ──────────────────────────── */
export const productRecommendationTemplate: TemplateDefinition = {
  id: 'product-recommendation',
  name: 'Product Recommendation',
  description: 'Asks preferences and recommends products with branching logic.',
  emoji: '🎁',
  color: 'text-pink-600',
  bgColor:
    'bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800',
  icon: LuGift,
  category: 'E-commerce',
  build: () => {
    const vCategory = variable('category');
    const vBudget = variable('budget');
    const vStyle = variable('style');

    const event = makeStartEvent();

    const intro = makeGroup('Welcome', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "Hey! 🎁 Let's find the perfect product for you. Which category are you shopping for?"),
    ]);

    const categoryItems = ['Fashion', 'Electronics', 'Home & Living', 'Beauty'].map(
      (content) => ({ id: id(), content }),
    );
    const categoryGroup = makeGroup('Pick category', { x: 340, y: 240 }, (gid) => [
      makeBlock(gid, 'choice_input', { variableId: vCategory.id }, categoryItems),
    ]);

    const budgetItems = ['Under $50', '$50 - $150', '$150 - $500', 'Over $500'].map(
      (content) => ({ id: id(), content }),
    );
    const budgetGroup = makeGroup('Budget', { x: 340, y: 440 }, (gid) => [
      textBlock(gid, "Nice choice! What's your budget range?"),
      makeBlock(gid, 'choice_input', { variableId: vBudget.id }, budgetItems),
    ]);

    const styleItems = ['Minimal', 'Classic', 'Trendy', 'Sporty'].map((content) => ({
      id: id(),
      content,
    }));
    const styleGroup = makeGroup('Style', { x: 340, y: 660 }, (gid) => [
      textBlock(gid, 'How would you describe your style?'),
      makeBlock(gid, 'choice_input', { variableId: vStyle.id }, styleItems),
    ]);

    const recommendation = makeGroup('Recommendation', { x: 340, y: 880 }, (gid) => [
      textBlock(
        gid,
        "Based on your answers — **{{category}}**, budget **{{budget}}**, style **{{style}}** — here are our top picks just for you! ✨",
      ),
      textBlock(gid, "Visit our store to explore the full collection."),
    ]);

    const categoryBlockId = categoryGroup.blocks[0].id;
    const budgetBlockId = budgetGroup.blocks[1].id;
    const styleBlockId = styleGroup.blocks[1].id;

    const groups = [intro, categoryGroup, budgetGroup, styleGroup, recommendation];
    const edges = [
      linkStartToGroup(event, intro),
      edgeBetweenGroups(intro.id, categoryGroup.id),
      ...categoryItems.map((item) =>
        edgeFromItem(categoryGroup.id, categoryBlockId, item.id, budgetGroup.id),
      ),
      ...budgetItems.map((item) =>
        edgeFromItem(budgetGroup.id, budgetBlockId, item.id, styleGroup.id),
      ),
      ...styleItems.map((item) =>
        edgeFromItem(styleGroup.id, styleBlockId, item.id, recommendation.id),
      ),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vCategory, vBudget, vStyle],
      theme: {},
      settings: {},
    };
  },
};

/* ── 9. Newsletter Signup ───────────────────────────────── */
export const newsletterSignupTemplate: TemplateDefinition = {
  id: 'newsletter-signup',
  name: 'Newsletter Signup',
  description: 'Email capture with interest selection and welcome message.',
  emoji: '📰',
  color: 'text-indigo-600',
  bgColor:
    'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800',
  icon: LuNewspaper,
  category: 'Marketing',
  build: () => {
    const vEmail = variable('email');
    const vName = variable('name');
    const vInterests = variable('interests');

    const event = makeStartEvent();

    const welcome = makeGroup('Welcome', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "Join our weekly newsletter — tips, updates, and exclusive offers delivered straight to your inbox. 📬"),
      textBlock(gid, "First, what should we call you?"),
      makeBlock(gid, 'text_input', { variableId: vName.id, placeholder: 'Your name…' }),
    ]);

    const emailGroup = makeGroup('Email', { x: 340, y: 300 }, (gid) => [
      textBlock(gid, 'Nice to meet you, {{name}}! What is your email?'),
      makeBlock(gid, 'email_input', {
        variableId: vEmail.id,
        placeholder: 'you@example.com',
      }),
    ]);

    const interestItems = [
      'Product updates',
      'Tips & tutorials',
      'Industry news',
      'Special offers',
    ].map((content) => ({ id: id(), content }));
    const interestsGroup = makeGroup('Interests', { x: 340, y: 520 }, (gid) => [
      textBlock(gid, "What are you most interested in? Pick all that apply:"),
      makeBlock(
        gid,
        'choice_input',
        { variableId: vInterests.id, isMultipleChoice: true },
        interestItems,
      ),
    ]);

    const thanks = makeGroup('Confirmation', { x: 340, y: 740 }, (gid) => [
      textBlock(
        gid,
        "You're in, {{name}}! 🎉 Check {{email}} for a confirmation link. Talk soon!",
      ),
    ]);

    const interestsBlockId = interestsGroup.blocks[1].id;
    const groups = [welcome, emailGroup, interestsGroup, thanks];
    const edges = [
      linkStartToGroup(event, welcome),
      edgeBetweenGroups(welcome.id, emailGroup.id),
      edgeBetweenGroups(emailGroup.id, interestsGroup.id),
      ...interestItems.map((item) =>
        edgeFromItem(interestsGroup.id, interestsBlockId, item.id, thanks.id),
      ),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vEmail, vName, vInterests],
      theme: {},
      settings: {},
    };
  },
};

/* ── 4. Customer Onboarding ─────────────────────────────── */
export const customerOnboardingTemplate: TemplateDefinition = {
  id: 'customer-onboarding',
  name: 'Customer Onboarding',
  description: 'New customer welcome flow with preferences setup.',
  emoji: '🚀',
  color: 'text-cyan-600',
  bgColor:
    'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800',
  icon: LuRocket,
  category: 'Sales',
  build: () => {
    const vName = variable('full_name');
    const vCompany = variable('company');
    const vRole = variable('role');
    const vGoal = variable('primary_goal');

    const event = makeStartEvent();

    const welcome = makeGroup('Welcome', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "Welcome aboard! 🚀 Let's set up your account in under 2 minutes."),
      textBlock(gid, "What's your full name?"),
      makeBlock(gid, 'text_input', { variableId: vName.id, placeholder: 'Jane Doe' }),
    ]);

    const company = makeGroup('Company', { x: 340, y: 300 }, (gid) => [
      textBlock(gid, "Great, {{full_name}}! Which company do you work for?"),
      makeBlock(gid, 'text_input', { variableId: vCompany.id, placeholder: 'Acme Inc.' }),
    ]);

    const roleItems = ['Founder / CEO', 'Marketing', 'Engineering', 'Sales', 'Other'].map(
      (content) => ({ id: id(), content }),
    );
    const role = makeGroup('Role', { x: 340, y: 500 }, (gid) => [
      textBlock(gid, "What's your role?"),
      makeBlock(gid, 'choice_input', { variableId: vRole.id }, roleItems),
    ]);

    const goalItems = [
      'Grow my audience',
      'Automate workflows',
      'Improve conversion',
      'Just exploring',
    ].map((content) => ({ id: id(), content }));
    const goal = makeGroup('Primary goal', { x: 340, y: 720 }, (gid) => [
      textBlock(gid, "What's your primary goal with our product?"),
      makeBlock(gid, 'choice_input', { variableId: vGoal.id }, goalItems),
    ]);

    const finish = makeGroup('All set', { x: 340, y: 940 }, (gid) => [
      textBlock(
        gid,
        "You're all set, {{full_name}}! 🎉 We've tailored your dashboard around **{{primary_goal}}**. Check your email for next steps.",
      ),
    ]);

    const roleBlockId = role.blocks[1].id;
    const goalBlockId = goal.blocks[1].id;

    const groups = [welcome, company, role, goal, finish];
    const edges = [
      linkStartToGroup(event, welcome),
      edgeBetweenGroups(welcome.id, company.id),
      edgeBetweenGroups(company.id, role.id),
      ...roleItems.map((item) =>
        edgeFromItem(role.id, roleBlockId, item.id, goal.id),
      ),
      ...goalItems.map((item) =>
        edgeFromItem(goal.id, goalBlockId, item.id, finish.id),
      ),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vName, vCompany, vRole, vGoal],
      theme: {},
      settings: {},
    };
  },
};

/* ── 11. SaaS Demo Request ──────────────────────────────── */
export const saasDemoRequestTemplate: TemplateDefinition = {
  id: 'saas-demo-request',
  name: 'SaaS Demo Request',
  description: 'Qualify leads with company size and use case questions.',
  emoji: '📝',
  color: 'text-sky-600',
  bgColor:
    'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800',
  icon: LuClipboardList,
  category: 'Sales',
  build: () => {
    const vEmail = variable('work_email');
    const vCompanySize = variable('company_size');
    const vUseCase = variable('use_case');
    const vTimeline = variable('timeline');

    const event = makeStartEvent();

    const intro = makeGroup('Intro', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "👋 Curious to see our product in action? Let's book a personalized demo."),
      textBlock(gid, 'First, what is your work email?'),
      makeBlock(gid, 'email_input', {
        variableId: vEmail.id,
        placeholder: 'you@company.com',
      }),
    ]);

    const sizeItems = [
      '1 - 10 employees',
      '11 - 50 employees',
      '51 - 200 employees',
      '201 - 1000 employees',
      '1000+ employees',
    ].map((content) => ({ id: id(), content }));
    const size = makeGroup('Company size', { x: 340, y: 320 }, (gid) => [
      textBlock(gid, 'How large is your company?'),
      makeBlock(gid, 'choice_input', { variableId: vCompanySize.id }, sizeItems),
    ]);

    const useCaseItems = [
      'Lead generation',
      'Customer support',
      'Internal tooling',
      'Other',
    ].map((content) => ({ id: id(), content }));
    const useCase = makeGroup('Use case', { x: 340, y: 540 }, (gid) => [
      textBlock(gid, 'What would you primarily use our product for?'),
      makeBlock(gid, 'choice_input', { variableId: vUseCase.id }, useCaseItems),
    ]);

    const timelineItems = [
      'ASAP',
      'Within a month',
      '1 - 3 months',
      'Just researching',
    ].map((content) => ({ id: id(), content }));
    const timeline = makeGroup('Timeline', { x: 340, y: 760 }, (gid) => [
      textBlock(gid, "What's your timeline for making a decision?"),
      makeBlock(gid, 'choice_input', { variableId: vTimeline.id }, timelineItems),
    ]);

    const finish = makeGroup('Thank you', { x: 340, y: 980 }, (gid) => [
      textBlock(
        gid,
        "Thanks! Our team will reach out to **{{work_email}}** within 24 hours to schedule your demo. 🗓️",
      ),
    ]);

    const sizeBlockId = size.blocks[1].id;
    const useCaseBlockId = useCase.blocks[1].id;
    const timelineBlockId = timeline.blocks[1].id;

    const groups = [intro, size, useCase, timeline, finish];
    const edges = [
      linkStartToGroup(event, intro),
      edgeBetweenGroups(intro.id, size.id),
      ...sizeItems.map((item) =>
        edgeFromItem(size.id, sizeBlockId, item.id, useCase.id),
      ),
      ...useCaseItems.map((item) =>
        edgeFromItem(useCase.id, useCaseBlockId, item.id, timeline.id),
      ),
      ...timelineItems.map((item) =>
        edgeFromItem(timeline.id, timelineBlockId, item.id, finish.id),
      ),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vEmail, vCompanySize, vUseCase, vTimeline],
      theme: {},
      settings: {},
    };
  },
};

/* ── 12. Mortgage Calculator ────────────────────────────── */
export const mortgageCalculatorTemplate: TemplateDefinition = {
  id: 'mortgage-calculator',
  name: 'Mortgage Calculator',
  description: 'Collects income, loan amount, then calculates estimated payment.',
  emoji: '🏠',
  color: 'text-emerald-600',
  bgColor:
    'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  icon: LuHouse,
  category: 'Sales',
  build: () => {
    const vLoanAmount = variable('loan_amount');
    const vInterestRate = variable('interest_rate');
    const vTermYears = variable('term_years');
    const vMonthlyPayment = variable('monthly_payment');

    const event = makeStartEvent();

    const intro = makeGroup('Intro', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "🏠 Let's estimate your monthly mortgage payment. This takes about a minute."),
      textBlock(gid, 'What loan amount are you considering? (USD)'),
      makeBlock(gid, 'number_input', {
        variableId: vLoanAmount.id,
        placeholder: '300000',
        min: 1000,
      }),
    ]);

    const rate = makeGroup('Interest rate', { x: 340, y: 320 }, (gid) => [
      textBlock(gid, 'What interest rate do you expect? (annual %, e.g. 6.5)'),
      makeBlock(gid, 'number_input', {
        variableId: vInterestRate.id,
        placeholder: '6.5',
        min: 0,
        max: 30,
        step: 0.1,
      }),
    ]);

    const term = makeGroup('Term', { x: 340, y: 520 }, (gid) => [
      textBlock(gid, 'Loan term in years?'),
      makeBlock(gid, 'number_input', {
        variableId: vTermYears.id,
        placeholder: '30',
        min: 1,
        max: 40,
      }),
    ]);

    const calculate = makeGroup('Calculate', { x: 340, y: 720 }, (gid) => [
      makeBlock(gid, 'script', {
        name: 'Compute monthly payment',
        isExecutedOnClient: false,
        content: `
// Standard amortization formula: M = P * (r(1+r)^n) / ((1+r)^n - 1)
const principal = Number({{loan_amount}}) || 0;
const annualRate = Number({{interest_rate}}) || 0;
const years = Number({{term_years}}) || 0;
const monthlyRate = annualRate / 100 / 12;
const n = years * 12;
let monthly = 0;
if (monthlyRate === 0) {
  monthly = n > 0 ? principal / n : 0;
} else {
  const factor = Math.pow(1 + monthlyRate, n);
  monthly = principal * (monthlyRate * factor) / (factor - 1);
}
return { monthly_payment: monthly.toFixed(2) };
`.trim(),
      }),
    ]);

    const result = makeGroup('Estimate', { x: 340, y: 900 }, (gid) => [
      textBlock(
        gid,
        "Your estimated monthly payment on a **${{loan_amount}}** loan at **{{interest_rate}}%** over **{{term_years}} years** is roughly **${{monthly_payment}}/month**.",
      ),
      textBlock(gid, 'This is an estimate — talk to a lender for a precise quote. 🏦'),
    ]);

    const groups = [intro, rate, term, calculate, result];
    const edges = [
      linkStartToGroup(event, intro),
      edgeBetweenGroups(intro.id, rate.id),
      edgeBetweenGroups(rate.id, term.id),
      edgeBetweenGroups(term.id, calculate.id),
      edgeBetweenGroups(calculate.id, result.id),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vLoanAmount, vInterestRate, vTermYears, vMonthlyPayment],
      theme: {},
      settings: {},
    };
  },
};
