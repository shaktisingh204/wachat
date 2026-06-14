/**
 * Boards — model-backed cross-filter dashboards. Each board is a grid of cards
 * (MetricQueries) with a shared, URL-synced filter bar and click-to-cross-filter.
 */
import Link from 'next/link';
import { LayoutDashboard, Sparkles } from 'lucide-react';

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import { listBoardsAction } from '@/app/actions/sabbi-boards.actions';

import { NewBoardButton } from './_components/new-board-button';

export const dynamic = 'force-dynamic';

export default async function BoardsPage() {
  let boards: Awaited<ReturnType<typeof listBoardsAction>> = [];
  try {
    boards = await listBoardsAction();
  } catch {
    boards = [];
  }
  const totalCards = boards.reduce((a, b) => a + (b.cards?.length ?? 0), 0);

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBI</PageEyebrow>
          <PageTitle>Boards</PageTitle>
          <PageDescription>
            Cross-filter dashboards built on governed models. Click any chart to
            filter the whole board.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <NewBoardButton />
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-2 gap-[var(--st-space-4)] sm:grid-cols-3">
        <StatCard label="Boards" value={boards.length} icon={LayoutDashboard} accent="var(--st-accent)" />
        <StatCard label="Cards" value={totalCards} icon={Sparkles} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard size={16} aria-hidden="true" />
            Your boards
          </CardTitle>
        </CardHeader>
        <CardBody>
          {boards.length === 0 ? (
            <EmptyState
              icon={LayoutDashboard}
              tone="info"
              title="No boards yet"
              description="Create a board, then add cards from any connected model."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th align="left">Name</Th>
                  <Th align="right">Cards</Th>
                  <Th align="left">Updated</Th>
                </Tr>
              </THead>
              <TBody>
                {boards.map((b) => (
                  <Tr key={b._id}>
                    <Td>
                      <Link href={`/dashboard/sabbi/boards/${b._id}`} className="font-medium text-[var(--st-text)] hover:underline">
                        {b.name}
                      </Link>
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {b.cards?.length ?? 0}
                    </Td>
                    <Td className="text-[var(--st-text-secondary)]">
                      {b.updatedAt ? new Date(b.updatedAt).toLocaleDateString() : '—'}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
