'use server';

export async function executeGoogleClassroomAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://classroom.googleapis.com/v1';
        const authHeader = `Bearer ${inputs.accessToken}`;

        const gcFetch = async (path: string, method = 'GET', body?: any) => {
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || `Google Classroom API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listCourses': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.teacherId) params.set('teacherId', inputs.teacherId);
                if (inputs.studentId) params.set('studentId', inputs.studentId);
                if (inputs.courseStates) params.set('courseStates', inputs.courseStates);
                const data = await gcFetch(`/courses?${params.toString()}`);
                return { output: { courses: data.courses || [], nextPageToken: data.nextPageToken } };
            }
            case 'getCourse': {
                const data = await gcFetch(`/courses/${inputs.courseId}`);
                return { output: { course: data } };
            }
            case 'createCourse': {
                const data = await gcFetch('/courses', 'POST', {
                    name: inputs.name,
                    section: inputs.section,
                    descriptionHeading: inputs.descriptionHeading,
                    description: inputs.description,
                    room: inputs.room,
                    ownerId: inputs.ownerId || 'me',
                    courseState: inputs.courseState || 'PROVISIONED',
                });
                return { output: { course: data } };
            }
            case 'updateCourse': {
                const updateMask = inputs.updateMask || 'name,section,description,room,courseState';
                const data = await gcFetch(`/courses/${inputs.courseId}?updateMask=${updateMask}`, 'PATCH', {
                    name: inputs.name,
                    section: inputs.section,
                    description: inputs.description,
                    room: inputs.room,
                    courseState: inputs.courseState,
                });
                return { output: { course: data } };
            }
            case 'deleteCourse': {
                const data = await gcFetch(`/courses/${inputs.courseId}`, 'DELETE');
                return { output: { success: true } };
            }
            case 'listStudents': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const data = await gcFetch(`/courses/${inputs.courseId}/students?${params.toString()}`);
                return { output: { students: data.students || [], nextPageToken: data.nextPageToken } };
            }
            case 'addStudent': {
                const data = await gcFetch(`/courses/${inputs.courseId}/students`, 'POST', {
                    userId: inputs.userId,
                });
                return { output: { student: data } };
            }
            case 'deleteStudent': {
                await gcFetch(`/courses/${inputs.courseId}/students/${inputs.userId}`, 'DELETE');
                return { output: { success: true } };
            }
            case 'listTeachers': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const data = await gcFetch(`/courses/${inputs.courseId}/teachers?${params.toString()}`);
                return { output: { teachers: data.teachers || [], nextPageToken: data.nextPageToken } };
            }
            case 'addTeacher': {
                const data = await gcFetch(`/courses/${inputs.courseId}/teachers`, 'POST', {
                    userId: inputs.userId,
                });
                return { output: { teacher: data } };
            }
            case 'listCourseWork': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.courseWorkStates) params.set('courseWorkStates', inputs.courseWorkStates);
                const data = await gcFetch(`/courses/${inputs.courseId}/courseWork?${params.toString()}`);
                return { output: { courseWork: data.courseWork || [], nextPageToken: data.nextPageToken } };
            }
            case 'createCourseWork': {
                const data = await gcFetch(`/courses/${inputs.courseId}/courseWork`, 'POST', {
                    title: inputs.title,
                    description: inputs.description,
                    workType: inputs.workType || 'ASSIGNMENT',
                    state: inputs.state || 'PUBLISHED',
                    dueDate: inputs.dueDate,
                    dueTime: inputs.dueTime,
                    maxPoints: inputs.maxPoints,
                    submissionModificationMode: inputs.submissionModificationMode || 'MODIFIABLE_UNTIL_TURNED_IN',
                });
                return { output: { courseWork: data } };
            }
            case 'listSubmissions': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.states) params.set('states', inputs.states);
                const data = await gcFetch(`/courses/${inputs.courseId}/courseWork/${inputs.courseWorkId}/studentSubmissions?${params.toString()}`);
                return { output: { studentSubmissions: data.studentSubmissions || [], nextPageToken: data.nextPageToken } };
            }
            case 'gradeSubmission': {
                const data = await gcFetch(
                    `/courses/${inputs.courseId}/courseWork/${inputs.courseWorkId}/studentSubmissions/${inputs.submissionId}?updateMask=assignedGrade,draftGrade`,
                    'PATCH',
                    {
                        assignedGrade: inputs.assignedGrade,
                        draftGrade: inputs.draftGrade,
                    }
                );
                return { output: { submission: data } };
            }
            case 'createAnnouncement': {
                const data = await gcFetch(`/courses/${inputs.courseId}/announcements`, 'POST', {
                    text: inputs.text,
                    state: inputs.state || 'PUBLISHED',
                    scheduledTime: inputs.scheduledTime,
                });
                return { output: { announcement: data } };
            }
            default:
                logger.log(`Google Classroom: unknown action "${actionName}"`);
                return { error: `Unknown Google Classroom action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Google Classroom action error: ${err.message}`);
        return { error: err.message || 'Google Classroom action failed' };
    }
}
