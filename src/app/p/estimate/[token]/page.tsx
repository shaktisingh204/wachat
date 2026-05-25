import { resolvePublicToken } from '@/app/actions/worksuite/public.actions';
import { InvalidLinkCard } from '../../_components/invalid-link';
import { EstimateDetails, type Estimate, type Acceptance } from './_components/estimate-details';
import { EstimateAction } from './_components/estimate-action';
import { RealTimeRefresh } from './_components/realtime-refresh';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicEstimatePage({ params }: PageProps) {
  const { token } = await params;
  
  let result;
  try {
    result = await resolvePublicToken(token);
  } catch (error) {
    console.error('Failed to resolve public token:', error);
    return <InvalidLinkCard />; 
  }

  if (!result || result.resource.type !== 'estimate') {
    return <InvalidLinkCard />;
  }

  const { estimate, acceptances } = result.resource as {
    estimate: Estimate;
    acceptances: Acceptance[];
  };

  const accepted = acceptances.length > 0 || estimate.status === 'quoted';

  return (
    <>
      <RealTimeRefresh intervalMs={15000} />
      <div className="grid gap-8 lg:grid-cols-5">
        <EstimateDetails 
          estimate={estimate} 
          acceptances={acceptances} 
          accepted={accepted} 
          token={token} 
        />
        <EstimateAction 
          token={token} 
          accepted={accepted} 
        />
      </div>
    </>
  );
}
