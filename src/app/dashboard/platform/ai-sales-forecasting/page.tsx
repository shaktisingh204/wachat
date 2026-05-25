export const dynamic = "force-dynamic";

import { getSalesForecasts } from '@/app/actions/platform/ai-sales-forecasting.actions';
import { ClientSalesForecastingPage } from './client-page';

export default async function AISalesForecastingPage() {
  const initialData = await getSalesForecasts();

  return <ClientSalesForecastingPage initialData={initialData} />;
}
