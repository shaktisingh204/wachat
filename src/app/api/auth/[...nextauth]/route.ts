
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';
import Credentials from 'next-auth/providers/credentials';
import { connectToDatabase } from '@/lib/mongodb';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import type { Adapter } from 'next-auth/adapters';
import { comparePassword } from '@/lib/auth';
import type { User } from '@/lib/definitions';

export const { handlers: { GET, POST }, signIn, signOut, auth } = NextAuth({
    adapter: MongoDBAdapter(connectToDatabase().then(c => c.client), { databaseName: process.env.MONGODB_DB }) as Adapter,
    session: { strategy: 'jwt' },
    providers: [
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
      Facebook({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      }),
      Credentials({
          async authorize(credentials) {
            if (!credentials?.email || !credentials.password) {
                return null;
            }
            const { db } = await connectToDatabase();
            const user = await db.collection<User>('users').findOne({ email: (credentials.email as string).toLowerCase() });

            if (!user || !user.password) {
                return null;
            }

            const passwordMatch = await comparePassword(credentials.password as string, user.password);
            if (!passwordMatch) {
                return null;
            }

            return { id: user._id.toString(), name: user.name, email: user.email, image: user.image };
          }
      })
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
        async session({ session, token }) {
            const { db } = await connectToDatabase();
            const dbUser = await db.collection('users').findOne({ email: token.email! }, { projection: { password: 0 }});

            if (dbUser) {
                session.user = { ...session.user, ...dbUser, _id: dbUser._id.toString() };
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        }
    },
    pages: {
      signIn: '/login',
    },
});
