import React, { Suspense } from 'react';
import { getTrainingCourses } from '@/app/actions/hrm-advanced/lms-training';
import TrainingCoursesClient from './components/TrainingCoursesClient';
import Loading from './loading';

export const dynamic = 'force-dynamic';


export const metadata = {
  title: 'LMS & Training | Dashboard',
  description: 'Manage corporate training courses, monitor enrollments, and track progress.',
};

export default async function LMSTrainingPage() {
  const initialCourses = await getTrainingCourses();

  return (
    <Suspense fallback={<Loading />}>
      <TrainingCoursesClient initialCourses={initialCourses} />
    </Suspense>
  );
}
