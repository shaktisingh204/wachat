// scripts/set-admin-credentials.ts
// Usage: tsx scripts/set-admin-credentials.ts <email> <password>
import * as bcrypt from 'bcryptjs';
import { connectToDatabase } from '../src/lib/mongodb';

const SALT_ROUNDS = 10;

async function main() {
  const [, , email, password] = process.argv;

  if (!email || !password) {
    console.error('Usage: tsx scripts/set-admin-credentials.ts <email> <password>');
    process.exit(1);
  }

  if (!email.includes('@')) {
    console.error('Error: invalid email address.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: password must be at least 8 characters.');
    process.exit(1);
  }

  console.log('Hashing password…');
  const salt = await (bcrypt.genSalt as any)(SALT_ROUNDS, 'b');
  const passwordHash = await (bcrypt.hash as any)(password, salt);

  const { db } = await connectToDatabase();

  await db.collection('settings').updateOne(
    { key: 'admin_credentials' },
    {
      $set: {
        key: 'admin_credentials',
        email,
        passwordHash,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );

  console.log(`\nAdmin credentials saved to DB.`);
  console.log(`  Email : ${email}`);
  console.log(`  Hash  : ${passwordHash.slice(0, 20)}…`);
  console.log('\nYou can now log in at /admin-login with these credentials.\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
