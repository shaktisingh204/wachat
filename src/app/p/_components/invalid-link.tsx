import { ClayCard } from '@/components/clay';

export function InvalidLinkCard({ message }: { message?: string }) {
  return (
    <ClayCard>
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="text-[15px] font-semibold text-clay-ink">
          This link is no longer available
        </p>
        <p className="text-[13px] text-clay-ink-muted">
          {message || 'The link may have expired, been revoked, or reached its use limit.'}
        </p>
      </div>
    </ClayCard>
  );
}
