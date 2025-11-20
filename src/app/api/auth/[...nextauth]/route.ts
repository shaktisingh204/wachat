import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import { connectToDatabase } from '@/lib/mongodb';
import { createSessionToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_APP_ID!,
      clientSecret: process.env.FACEBOOK_APP_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) {
        return false;
      }
      try {
        const { db } = await connectToDatabase();
        let dbUser = await db.collection('users').findOne({ email: user.email });

        if (!dbUser) {
          const defaultPlan = await db.collection('plans').findOne({ isDefault: true });
          const newUser = {
            name: user.name,
            email: user.email,
            image: user.image,
            authProvider: account?.provider,
            createdAt: new Date(),
            ...(defaultPlan && { planId: defaultPlan._id, credits: defaultPlan.signupCredits || 0 }),
          };
          const result = await db.collection('users').insertOne(newUser);
          dbUser = { ...newUser, _id: result.insertedId };
        }

        const sessionToken = await createSessionToken({ 
          userId: dbUser._id.toString(), 
          email: dbUser.email 
        });

        cookies().set('session', sessionToken, { 
          httpOnly: true, 
          secure: process.env.NODE_ENV === 'production', 
          sameSite: 'lax', 
          path: '/' 
        });
        
        return true;
      } catch (error) {
        console.error('NextAuth signIn callback error:', error);
        return false;
      }
    },
    async redirect({ url, baseUrl }) {
        return baseUrl + '/dashboard';
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});

export { handler as GET, handler as POST };
