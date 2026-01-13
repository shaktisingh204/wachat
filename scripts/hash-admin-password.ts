
// scripts/hash-admin-password.ts
import bcrypt from 'bcryptjs';

// Using 10 rounds is a standard, secure practice.
const SALT_ROUNDS = 10;

async function hashPassword() {
  const password = process.argv[2];

  if (!password) {
    console.error('Please provide a password to hash.');
    console.error('Usage: tsx scripts/hash-admin-password.ts "your_password_here"');
    process.exit(1);
  }

  try {
    // Generate the salt with the '$2b$' prefix for maximum compatibility.
    const salt = await bcrypt.genSalt(SALT_ROUNDS, 'b');
    const hash = await bcrypt.hash(password, salt);
    
    console.log('\nGenerated Hash:');
    console.log(hash);
    console.log('\nIMPORTANT: Copy this entire hash and set it as the value for ADMIN_PASSWORD_HASH in your .env file.');
    console.log('Ensure you have removed the old ADMIN_PASSWORD variable.\n');

  } catch (error) {
    console.error('Error generating hash:', error);
    process.exit(1);
  }
}

hashPassword();
