'use client';

import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';

export function FeedbackChart({
  communication,
  teamwork,
  leadership,
  technical,
}: {
  communication?: number;
  teamwork?: number;
  leadership?: number;
  technical?: number;
}) {
  const data = [
    { subject: 'Communication', A: Number(communication) || 0, fullMark: 10 },
    { subject: 'Teamwork', A: Number(teamwork) || 0, fullMark: 10 },
    { subject: 'Leadership', A: Number(leadership) || 0, fullMark: 10 },
    { subject: 'Technical', A: Number(technical) || 0, fullMark: 10 },
  ];

  return (
    <div className="w-full h-[300px] mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" className="text-xs fill-zoru-ink-muted" />
          <PolarRadiusAxis angle={30} domain={[0, 10]} className="text-xs fill-zoru-ink-muted" />
          <Radar
            name="Rating"
            dataKey="A"
            stroke="#8884d8"
            fill="#8884d8"
            fillOpacity={0.6}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
