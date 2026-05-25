import { getCachedSession } from './src/lib/server-cache';
async function test() {
  const session = await getCachedSession();
  console.log(session);
}
test();
