/**
 * SabCRM — Sales leaderboard (`/sabcrm/leaderboard`).
 *
 * Server entry that mounts the client surface. The board, scorecard and contest
 * data are loaded client-side through the gated gamification actions (which
 * resolve the active project + RBAC themselves), mirroring `/sabcrm/ask`.
 */

import * as React from 'react';
import type { Metadata } from 'next';

import LeaderboardClient from './leaderboard-client';

export const metadata: Metadata = {
  title: 'Leaderboard · SabCRM',
  description: 'Sales leaderboards, scorecards, quota attainment and contests.',
};

export default function LeaderboardPage(): React.ReactElement {
  return <LeaderboardClient />;
}
