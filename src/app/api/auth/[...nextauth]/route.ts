import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';
import { connectToDatabase } from '@/lib/mongodb';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import type { Adapter } from 'next-auth/adapters';

export const { handlers, signIn, signOut, auth } = NextAuth(async (req) => {
  const { db, client } = await connectToDatabase();
  
  return {
    adapter: MongoDBAdapter(client, { databaseName: process.env.MONGODB_DB }) as Adapter,
    providers: [
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
      Facebook({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            if (!user.email) return false;

            // This is a new user signing up via OAuth
            if (!user.planId) {
                const defaultPlan = await db.collection('plans').findOne({ isDefault: true });
                if (defaultPlan) {
                    await db.collection('users').updateOne(
                        { _id: user.id },
                        { 
                            $set: { 
                                planId: defaultPlan._id,
                                credits: defaultPlan.signupCredits || 0,
                                createdAt: new Date() // Ensure createdAt is set
                            }
                        }
                    );
                }
            }
            return true;
        },
        async session({ session, user }) {
            const { db } = await connectToDatabase();
            const dbUser = await db.collection('users').findOne({ _id: user.id });

            if (dbUser) {
                session.user = { ...session.user, ...dbUser };
            }
            return session;
        }
    },
    pages: {
      signIn: '/login',
    },
  };
});
