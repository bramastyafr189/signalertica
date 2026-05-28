import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { Adapter } from "next-auth/adapters";

function requiredEnv(name: string, developmentFallback: string) {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV !== "production") return developmentFallback;
  throw new Error(`${name} is required in production`);
}

export const authOptions: AuthOptions = {
  adapter: DrizzleAdapter(db) as Adapter,
  providers: [
    GoogleProvider({
      clientId: requiredEnv("GOOGLE_CLIENT_ID", "google-client-id"),
      clientSecret: requiredEnv("GOOGLE_CLIENT_SECRET", "google-client-secret"),
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
