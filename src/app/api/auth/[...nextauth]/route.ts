import NextAuth from 'next-auth/next'
import GoogleProvider from 'next-auth/providers/google'

interface Token {
  accessToken?: string
  [key: string]: unknown
}

interface Account {
  access_token?: string
  [key: string]: unknown
}

interface Session {
  accessToken?: string
  [key: string]: unknown
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/analytics.readonly'
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account }: { token: Token, account: Account | null }) {
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
    async session({ session, token }: { session: Session, token: Token }) {
      session.accessToken = token.accessToken
      return session
    }
  }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }