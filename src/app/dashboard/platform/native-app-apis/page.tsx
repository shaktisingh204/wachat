import { getNativeAppAPIKeys } from '@/app/actions/platform/native-app-apis.actions';
import NativeAppAPIsClient from './client';

export const metadata = {
  title: 'Native App APIs | Platform',
};

export default async function NativeAppAPIsPage() {
  const data = await getNativeAppAPIKeys();
  return <NativeAppAPIsClient initialData={data} />;
}

