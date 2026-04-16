import {
  LuBriefcase,
  LuCalendarCheck,
  LuCalendarClock,
  LuDumbbell,
  LuScale,
  LuHeartPulse,
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
   HR / health / services templates
   ═══════════════════════════════════════════════════════════ */

/* ── 2. Job Application ─────────────────────────────────── */
export const jobApplicationTemplate: TemplateDefinition = {
  id: 'job-application',
  name: 'Job Application',
  description: 'Collect candidate info including name, email, and resume.',
  emoji: '💼',
  color: 'text-slate-600',
  bgColor:
    'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800',
  icon: LuBriefcase,
  category: 'HR',
  build: () => {
    const vName = variable('full_name');
    const vEmail = variable('email');
    const vPhone = variable('phone');
    const vResume = variable('resume');
    const vExperience = variable('years_experience');
    const vCoverLetter = variable('cover_letter');

    const event = makeStartEvent();

    const intro = makeGroup('Intro', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "💼 Thanks for your interest! Let's get a few details."),
      textBlock(gid, "What's your full name?"),
      makeBlock(gid, 'text_input', { variableId: vName.id, placeholder: 'Jane Doe' }),
    ]);

    const contact = makeGroup('Contact', { x: 340, y: 300 }, (gid) => [
      textBlock(gid, 'Email address?'),
      makeBlock(gid, 'email_input', {
        variableId: vEmail.id,
        placeholder: 'you@example.com',
      }),
      textBlock(gid, 'Phone number?'),
      makeBlock(gid, 'phone_input', {
        variableId: vPhone.id,
        placeholder: '+1 (555) 000-0000',
      }),
    ]);

    const experience = makeGroup('Experience', { x: 340, y: 540 }, (gid) => [
      textBlock(gid, 'How many years of relevant experience do you have?'),
      makeBlock(gid, 'number_input', {
        variableId: vExperience.id,
        placeholder: '5',
        min: 0,
        max: 50,
      }),
    ]);

    const resume = makeGroup('Resume', { x: 340, y: 740 }, (gid) => [
      textBlock(gid, 'Please upload your resume (PDF or DOCX):'),
      makeBlock(gid, 'file_input', {
        variableId: vResume.id,
        isRequired: true,
        allowedFileTypes: {
          isEnabled: true,
          types: ['application/pdf', '.doc', '.docx'],
        },
        labels: { button: 'Upload resume' },
      }),
    ]);

    const coverLetter = makeGroup('Cover letter', { x: 340, y: 960 }, (gid) => [
      textBlock(gid, 'Briefly tell us why you want to join us (optional):'),
      makeBlock(gid, 'text_input', {
        variableId: vCoverLetter.id,
        placeholder: 'Your message…',
        isLong: true,
      }),
    ]);

    const thanks = makeGroup('Thanks', { x: 340, y: 1160 }, (gid) => [
      textBlock(
        gid,
        "Thanks, {{full_name}}! We've received your application and will reach out to **{{email}}** soon. 🤝",
      ),
    ]);

    const groups = [intro, contact, experience, resume, coverLetter, thanks];
    const edges = [
      linkStartToGroup(event, intro),
      edgeBetweenGroups(intro.id, contact.id),
      edgeBetweenGroups(contact.id, experience.id),
      edgeBetweenGroups(experience.id, resume.id),
      edgeBetweenGroups(resume.id, coverLetter.id),
      edgeBetweenGroups(coverLetter.id, thanks.id),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vName, vEmail, vPhone, vResume, vExperience, vCoverLetter],
      theme: {},
      settings: {},
    };
  },
};

/* ── 3. Event RSVP ──────────────────────────────────────── */
export const eventRsvpTemplate: TemplateDefinition = {
  id: 'event-rsvp',
  name: 'Event RSVP',
  description: 'Event confirmation with attendance count and dietary needs.',
  emoji: '📅',
  color: 'text-fuchsia-600',
  bgColor:
    'bg-fuchsia-50 dark:bg-fuchsia-950/30 border-fuchsia-200 dark:border-fuchsia-800',
  icon: LuCalendarCheck,
  category: 'Marketing',
  build: () => {
    const vName = variable('guest_name');
    const vAttending = variable('attending');
    const vPartySize = variable('party_size');
    const vDietary = variable('dietary');

    const event = makeStartEvent();

    const intro = makeGroup('Invitation', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "🎉 You're invited! Please RSVP below."),
      textBlock(gid, "Your full name?"),
      makeBlock(gid, 'text_input', {
        variableId: vName.id,
        placeholder: 'Your name',
      }),
    ]);

    const attendingItems = [
      'Yes, count me in! 🎉',
      "Sorry, I can't make it",
    ].map((content) => ({ id: id(), content }));
    const attending = makeGroup('Attending?', { x: 340, y: 300 }, (gid) => [
      textBlock(gid, 'Will you be attending?'),
      makeBlock(gid, 'choice_input', { variableId: vAttending.id }, attendingItems),
    ]);

    const partySize = makeGroup('Party size', { x: 540, y: 520 }, (gid) => [
      textBlock(gid, 'How many guests (including yourself)?'),
      makeBlock(gid, 'number_input', {
        variableId: vPartySize.id,
        placeholder: '1',
        min: 1,
        max: 10,
      }),
    ]);

    const dietaryItems = [
      'No restrictions',
      'Vegetarian',
      'Vegan',
      'Gluten-free',
      'Other (please note)',
    ].map((content) => ({ id: id(), content }));
    const dietary = makeGroup('Dietary', { x: 540, y: 720 }, (gid) => [
      textBlock(gid, 'Any dietary restrictions?'),
      makeBlock(gid, 'choice_input', { variableId: vDietary.id }, dietaryItems),
    ]);

    const confirmed = makeGroup('Confirmed', { x: 540, y: 940 }, (gid) => [
      textBlock(
        gid,
        "✅ You're on the list, {{guest_name}}! Party of **{{party_size}}** — we'll see you there.",
      ),
    ]);

    const declined = makeGroup('Declined', { x: 140, y: 520 }, (gid) => [
      textBlock(gid, "We'll miss you, {{guest_name}}! 💌 Thanks for letting us know."),
    ]);

    const attendingBlockId = attending.blocks[1].id;
    const dietaryBlockId = dietary.blocks[1].id;

    const groups = [intro, attending, partySize, dietary, confirmed, declined];
    const edges = [
      linkStartToGroup(event, intro),
      edgeBetweenGroups(intro.id, attending.id),
      edgeFromItem(attending.id, attendingBlockId, attendingItems[0].id, partySize.id),
      edgeFromItem(attending.id, attendingBlockId, attendingItems[1].id, declined.id),
      edgeBetweenGroups(partySize.id, dietary.id),
      ...dietaryItems.map((item) =>
        edgeFromItem(dietary.id, dietaryBlockId, item.id, confirmed.id),
      ),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vName, vAttending, vPartySize, vDietary],
      theme: {},
      settings: {},
    };
  },
};

/* ── 5. Booking / Appointment ───────────────────────────── */
export const bookingAppointmentTemplate: TemplateDefinition = {
  id: 'booking-appointment',
  name: 'Booking / Appointment',
  description: 'Collects date, time, and service selection for an appointment.',
  emoji: '🗓️',
  color: 'text-teal-600',
  bgColor:
    'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800',
  icon: LuCalendarClock,
  category: 'Sales',
  build: () => {
    const vName = variable('name');
    const vService = variable('service');
    const vDate = variable('date');
    const vTime = variable('time');
    const vNotes = variable('notes');

    const event = makeStartEvent();

    const intro = makeGroup('Intro', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "🗓️ Let's book your appointment!"),
      textBlock(gid, 'What is your name?'),
      makeBlock(gid, 'text_input', { variableId: vName.id, placeholder: 'Your name' }),
    ]);

    const serviceItems = [
      '30-min consultation',
      '1-hour session',
      'Initial assessment',
      'Follow-up',
    ].map((content) => ({ id: id(), content }));
    const service = makeGroup('Service', { x: 340, y: 300 }, (gid) => [
      textBlock(gid, 'Which service are you booking?'),
      makeBlock(gid, 'choice_input', { variableId: vService.id }, serviceItems),
    ]);

    const dateStep = makeGroup('Date', { x: 340, y: 520 }, (gid) => [
      textBlock(gid, 'Pick a date:'),
      makeBlock(gid, 'date_input', {
        variableId: vDate.id,
        labels: { button: 'Select' },
      }),
    ]);

    const timeStep = makeGroup('Time', { x: 340, y: 720 }, (gid) => [
      textBlock(gid, 'Pick a preferred time:'),
      makeBlock(gid, 'time_input', {
        variableId: vTime.id,
        labels: { button: 'Select' },
      }),
    ]);

    const notes = makeGroup('Notes', { x: 340, y: 900 }, (gid) => [
      textBlock(gid, 'Anything we should know? (optional)'),
      makeBlock(gid, 'text_input', {
        variableId: vNotes.id,
        placeholder: 'Add notes…',
        isLong: true,
      }),
    ]);

    const confirm = makeGroup('Confirmation', { x: 340, y: 1100 }, (gid) => [
      textBlock(
        gid,
        "✅ Booked! {{name}}, your **{{service}}** is set for **{{date}} at {{time}}**. See you then!",
      ),
    ]);

    const serviceBlockId = service.blocks[1].id;
    const groups = [intro, service, dateStep, timeStep, notes, confirm];
    const edges = [
      linkStartToGroup(event, intro),
      edgeBetweenGroups(intro.id, service.id),
      ...serviceItems.map((item) =>
        edgeFromItem(service.id, serviceBlockId, item.id, dateStep.id),
      ),
      edgeBetweenGroups(dateStep.id, timeStep.id),
      edgeBetweenGroups(timeStep.id, notes.id),
      edgeBetweenGroups(notes.id, confirm.id),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vName, vService, vDate, vTime, vNotes],
      theme: {},
      settings: {},
    };
  },
};

/* ── 13. Fitness Coach Intake ───────────────────────────── */
export const fitnessCoachTemplate: TemplateDefinition = {
  id: 'fitness-coach-intake',
  name: 'Fitness Coach Intake',
  description: 'Collects fitness goals, current level, and training schedule.',
  emoji: '💪',
  color: 'text-lime-600',
  bgColor:
    'bg-lime-50 dark:bg-lime-950/30 border-lime-200 dark:border-lime-800',
  icon: LuDumbbell,
  category: 'Health',
  build: () => {
    const vName = variable('name');
    const vGoal = variable('goal');
    const vLevel = variable('level');
    const vFrequency = variable('frequency_per_week');
    const vInjuries = variable('injuries');

    const event = makeStartEvent();

    const intro = makeGroup('Intro', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "💪 Ready to level up? Let's build your plan."),
      textBlock(gid, "What's your first name?"),
      makeBlock(gid, 'text_input', { variableId: vName.id, placeholder: 'Your name' }),
    ]);

    const goalItems = [
      'Lose weight',
      'Build muscle',
      'Improve endurance',
      'General fitness',
    ].map((content) => ({ id: id(), content }));
    const goal = makeGroup('Goal', { x: 340, y: 300 }, (gid) => [
      textBlock(gid, "What's your main goal, {{name}}?"),
      makeBlock(gid, 'choice_input', { variableId: vGoal.id }, goalItems),
    ]);

    const levelItems = ['Beginner', 'Intermediate', 'Advanced'].map((content) => ({
      id: id(),
      content,
    }));
    const level = makeGroup('Current level', { x: 340, y: 520 }, (gid) => [
      textBlock(gid, 'How would you rate your current fitness level?'),
      makeBlock(gid, 'choice_input', { variableId: vLevel.id }, levelItems),
    ]);

    const frequency = makeGroup('Frequency', { x: 340, y: 740 }, (gid) => [
      textBlock(gid, 'How many days per week can you train?'),
      makeBlock(gid, 'number_input', {
        variableId: vFrequency.id,
        placeholder: '3',
        min: 1,
        max: 7,
      }),
    ]);

    const injuries = makeGroup('Injuries', { x: 340, y: 940 }, (gid) => [
      textBlock(gid, 'Any current injuries or limitations we should know about?'),
      makeBlock(gid, 'text_input', {
        variableId: vInjuries.id,
        placeholder: 'None, or describe…',
        isLong: true,
      }),
    ]);

    const finish = makeGroup('Plan ready', { x: 340, y: 1160 }, (gid) => [
      textBlock(
        gid,
        "Awesome, {{name}}! Goal: **{{goal}}**, Level: **{{level}}**, Training **{{frequency_per_week}}×/week** — we'll email your custom plan shortly. 🏋️",
      ),
    ]);

    const goalBlockId = goal.blocks[1].id;
    const levelBlockId = level.blocks[1].id;

    const groups = [intro, goal, level, frequency, injuries, finish];
    const edges = [
      linkStartToGroup(event, intro),
      edgeBetweenGroups(intro.id, goal.id),
      ...goalItems.map((item) =>
        edgeFromItem(goal.id, goalBlockId, item.id, level.id),
      ),
      ...levelItems.map((item) =>
        edgeFromItem(level.id, levelBlockId, item.id, frequency.id),
      ),
      edgeBetweenGroups(frequency.id, injuries.id),
      edgeBetweenGroups(injuries.id, finish.id),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vName, vGoal, vLevel, vFrequency, vInjuries],
      theme: {},
      settings: {},
    };
  },
};

/* ── 14. Legal Intake ───────────────────────────────────── */
export const legalIntakeTemplate: TemplateDefinition = {
  id: 'legal-intake',
  name: 'Legal Intake',
  description: 'Gathers case details for a law firm consultation.',
  emoji: '⚖️',
  color: 'text-zinc-600',
  bgColor:
    'bg-zinc-50 dark:bg-zinc-950/30 border-zinc-200 dark:border-zinc-800',
  icon: LuScale,
  category: 'Support',
  build: () => {
    const vName = variable('full_name');
    const vEmail = variable('email');
    const vPhone = variable('phone');
    const vCaseType = variable('case_type');
    const vUrgency = variable('urgency');
    const vDescription = variable('case_description');

    const event = makeStartEvent();

    const intro = makeGroup('Intro', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "⚖️ Hi! We'll gather a few details to prepare for your consultation."),
      textBlock(gid, 'All responses are confidential. What is your full name?'),
      makeBlock(gid, 'text_input', { variableId: vName.id, placeholder: 'Your name' }),
    ]);

    const contact = makeGroup('Contact', { x: 340, y: 320 }, (gid) => [
      textBlock(gid, 'Best email to reach you?'),
      makeBlock(gid, 'email_input', {
        variableId: vEmail.id,
        placeholder: 'you@example.com',
      }),
      textBlock(gid, 'Phone number?'),
      makeBlock(gid, 'phone_input', {
        variableId: vPhone.id,
        placeholder: '+1 (555) 000-0000',
      }),
    ]);

    const caseItems = [
      'Family law',
      'Personal injury',
      'Business / Contract',
      'Employment',
      'Real estate',
      'Other',
    ].map((content) => ({ id: id(), content }));
    const caseType = makeGroup('Case type', { x: 340, y: 560 }, (gid) => [
      textBlock(gid, "Which area of law does your case fall under?"),
      makeBlock(gid, 'choice_input', { variableId: vCaseType.id }, caseItems),
    ]);

    const urgencyItems = [
      'Urgent — within days',
      'Soon — within a few weeks',
      'Planning ahead',
    ].map((content) => ({ id: id(), content }));
    const urgency = makeGroup('Urgency', { x: 340, y: 780 }, (gid) => [
      textBlock(gid, 'How urgent is your matter?'),
      makeBlock(gid, 'choice_input', { variableId: vUrgency.id }, urgencyItems),
    ]);

    const description = makeGroup('Description', { x: 340, y: 1000 }, (gid) => [
      textBlock(gid, 'Please briefly describe your situation:'),
      makeBlock(gid, 'text_input', {
        variableId: vDescription.id,
        placeholder: 'Share any details that may help…',
        isLong: true,
      }),
    ]);

    const finish = makeGroup('Received', { x: 340, y: 1220 }, (gid) => [
      textBlock(
        gid,
        "Thank you, {{full_name}}. An attorney will review your intake and contact you at **{{email}}** within 1 business day.",
      ),
    ]);

    const caseBlockId = caseType.blocks[1].id;
    const urgencyBlockId = urgency.blocks[1].id;

    const groups = [intro, contact, caseType, urgency, description, finish];
    const edges = [
      linkStartToGroup(event, intro),
      edgeBetweenGroups(intro.id, contact.id),
      edgeBetweenGroups(contact.id, caseType.id),
      ...caseItems.map((item) =>
        edgeFromItem(caseType.id, caseBlockId, item.id, urgency.id),
      ),
      ...urgencyItems.map((item) =>
        edgeFromItem(urgency.id, urgencyBlockId, item.id, description.id),
      ),
      edgeBetweenGroups(description.id, finish.id),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vName, vEmail, vPhone, vCaseType, vUrgency, vDescription],
      theme: {},
      settings: {},
    };
  },
};

/* ── 15. Mental Health Check-in ─────────────────────────── */
export const mentalHealthCheckinTemplate: TemplateDefinition = {
  id: 'mental-health-checkin',
  name: 'Mental Health Check-in',
  description: 'Daily mood tracker with rating input and supportive messaging.',
  emoji: '🧘',
  color: 'text-purple-500',
  bgColor:
    'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800',
  icon: LuHeartPulse,
  category: 'Health',
  build: () => {
    const vMood = variable('mood_rating');
    const vSleep = variable('sleep_hours');
    const vEnergy = variable('energy_level');
    const vGratitude = variable('gratitude');

    const event = makeStartEvent();

    const intro = makeGroup('Check-in', { x: 340, y: 80 }, (gid) => [
      textBlock(gid, "🧘 Hey — thanks for checking in with yourself today."),
      textBlock(gid, 'How is your mood right now? (1 = low, 10 = great)'),
      makeBlock(gid, 'rating_input', {
        variableId: vMood.id,
        length: 10,
        buttonType: 'Numbers',
      }),
    ]);

    const sleep = makeGroup('Sleep', { x: 340, y: 300 }, (gid) => [
      textBlock(gid, 'Roughly how many hours did you sleep last night?'),
      makeBlock(gid, 'number_input', {
        variableId: vSleep.id,
        placeholder: '7',
        min: 0,
        max: 24,
        step: 0.5,
      }),
    ]);

    const energyItems = ['Very low', 'Low', 'Okay', 'Good', 'Great'].map(
      (content) => ({ id: id(), content }),
    );
    const energy = makeGroup('Energy', { x: 340, y: 500 }, (gid) => [
      textBlock(gid, "How's your energy today?"),
      makeBlock(gid, 'choice_input', { variableId: vEnergy.id }, energyItems),
    ]);

    const gratitude = makeGroup('Gratitude', { x: 340, y: 720 }, (gid) => [
      textBlock(gid, "One small thing you're grateful for today?"),
      makeBlock(gid, 'text_input', {
        variableId: vGratitude.id,
        placeholder: 'Anything at all…',
        isLong: true,
      }),
    ]);

    const finish = makeGroup('Closing', { x: 340, y: 940 }, (gid) => [
      textBlock(
        gid,
        "Thanks for showing up today. 💜 Mood: **{{mood_rating}}/10**, sleep **{{sleep_hours}}h**. Keep taking care of yourself.",
      ),
      textBlock(
        gid,
        "Remember: if you're struggling, please reach out to a professional or a trusted person.",
      ),
    ]);

    const energyBlockId = energy.blocks[1].id;
    const groups = [intro, sleep, energy, gratitude, finish];
    const edges = [
      linkStartToGroup(event, intro),
      edgeBetweenGroups(intro.id, sleep.id),
      edgeBetweenGroups(sleep.id, energy.id),
      ...energyItems.map((item) =>
        edgeFromItem(energy.id, energyBlockId, item.id, gratitude.id),
      ),
      edgeBetweenGroups(gratitude.id, finish.id),
    ];

    return {
      groups,
      edges,
      events: [event],
      variables: [vMood, vSleep, vEnergy, vGratitude],
      theme: {},
      settings: {},
    };
  },
};
