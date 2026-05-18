'use client';

import { ZoruCard, ZoruSkeleton, cn } from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { FolderKanban } from 'lucide-react';

import { getCrmTasks } from '@/app/actions/crm-tasks.actions';
import { getSession } from '@/app/actions/user.actions';
import { useT } from '@/lib/i18n/client';
import type { WithId,
  CrmTask,
  User } from '@/lib/definitions';
import { CrmTaskList } from '@/components/wabasimplify/crm-task-list';
import { CreateTaskDialog } from '@/components/wabasimplify/crm-create-task-dialog';

import { CrmPageHeader } from '../_components/crm-page-header';

type TabId = 'todo' | 'inProgress' | 'completed';

function TasksPageSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <ZoruSkeleton className="h-8 w-64" />
        <ZoruSkeleton className="mt-2 h-4 w-96" />
      </div>
      <ZoruSkeleton className="h-[500px] w-full rounded-xl" />
    </div>
  );
}

export default function TasksPage() {
  const { t } = useT();
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<WithId<CrmTask>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [tab, setTab] = useState<TabId>('todo');

  const fetchData = () => {
    startLoading(async () => {
      const [sessionData, tasksData] = await Promise.all([getSession(), getCrmTasks(1, 100)]);
      setUser(sessionData?.user || null);
      setTasks(tasksData.tasks);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  if ((isLoading && tasks.length === 0) || !user) {
    return <TasksPageSkeleton />;
  }

  const todoTasks = tasks.filter((t) => t.status === 'To-Do');
  const inProgressTasks = tasks.filter((t) => t.status === 'In Progress');
  const completedTasks = tasks.filter((t) => t.status === 'Completed');

  const TABS: { id: TabId; label: string }[] = [
    { id: 'todo', label: t('crm.tasks.list.tab.todo', { count: todoTasks.length }) },
    { id: 'inProgress', label: t('crm.tasks.list.tab.inProgress', { count: inProgressTasks.length }) },
    { id: 'completed', label: t('crm.tasks.list.tab.completed', { count: completedTasks.length }) },
  ];

  const visibleTasks =
    tab === 'todo'
      ? todoTasks
      : tab === 'inProgress'
        ? inProgressTasks
        : completedTasks;

  return (
    <div className="flex h-full w-full flex-col gap-6">
      <CrmPageHeader
        title={t('crm.tasks.list.title')}
        subtitle={t('crm.tasks.list.subtitle')}
        icon={FolderKanban}
        actions={<CreateTaskDialog onTaskCreated={fetchData} />}
      />

      <ZoruCard className="flex min-h-0 flex-1 flex-col p-5">
        <div className="grid w-full grid-cols-3 gap-1 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface-2 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-sm transition-colors',
                tab === t.id
                  ? 'bg-zoru-bg text-zoru-ink shadow-[var(--zoru-shadow-sm)]'
                  : 'text-zoru-ink-muted hover:text-zoru-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex-1">
          <CrmTaskList tasks={visibleTasks} onTaskUpdated={fetchData} />
        </div>
      </ZoruCard>
    </div>
  );
}
