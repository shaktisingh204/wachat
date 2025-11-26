
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';
import { connectToDatabase } from '@/lib/mongodb';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import type { Adapter } from 'next-auth/adapters';

export const { handlers, signIn, signOut, auth } = NextAuth({
    adapter: MongoDBAdapter(connectToDatabase().then(c => c.client), { databaseName: process.env.MONGODB_DB }) as Adapter,
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
            const { db } = await connectToDatabase();
            const existingUser = await db.collection('users').findOne({ email: user.email! });

            // This is a new user signing up via OAuth
            if (!existingUser?.planId) {
                const defaultPlan = await db.collection('plans').findOne({ isDefault: true });
                if (defaultPlan) {
                    await db.collection('users').updateOne(
                        { email: user.email! },
                        { 
                            $set: { 
                                planId: defaultPlan._id,
                                credits: defaultPlan.signupCredits || 0,
                            },
                            $setOnInsert: {
                                createdAt: new Date()
                            }
                        },
                        { upsert: true }
                    );
                }
            }
            return true;
        },
        async session({ session, user }) {
            const { db } = await connectToDatabase();
            const dbUser = await db.collection('users').findOne({ _id: new ObjectId(user.id) });

            if (dbUser) {
                session.user = { ...session.user, ...dbUser };
            }
            return session;
        }
    },
    pages: {
      signIn: '/login',
    },
});
