
// scripts/hash-admin-password.ts
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

async function hashPassword() {
  const password = process.argv[2];

  if (!password) {
    console.error('Please provide a password to hash.');
    console.error('Usage: npm run hash:admin-password "your_password_here"');
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    console.log('Generated Hash:');
    console.log(hash);
    console.log('\nCopy this hash and set it as the value for ADMIN_PASSWORD_HASH in your .env file.');
  } catch (error) {
    console.error('Error generating hash:', error);
    process.exit(1);
  }
}

hashPassword();
