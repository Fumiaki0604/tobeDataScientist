import NextAuth from 'next-auth/next'
import GoogleProvider from 'next-auth/providers/google'

/**
 * リフレッシュトークンを使用してアクセストークンを更新
 */
async function refreshAccessToken(token: any) {
  try {
    console.log('🔄 Refreshing access token...')

    const response = await fetch('https://oauth2.googleapis.com/token', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
      method: 'POST',
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      console.error('❌ Token refresh failed:', refreshedTokens)
      throw refreshedTokens
    }

    console.log('✅ Access token refreshed successfully')

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // 新しいリフレッシュトークンがあれば更新
    }
  } catch (error) {
    console.error('💥 Error refreshing access token:', error)

    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/analytics.manage.users.readonly https://www.googleapis.com/auth/analyticsdata.readonly',
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account }: any) {
      // 初回ログイン時にアクセストークンとリフレッシュトークンを保存
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.accessTokenExpires = account.expires_at * 1000 // 秒からミリ秒に変換
      }

      // アクセストークンがまだ有効な場合はそのまま返す
      if (Date.now() < token.accessTokenExpires) {
        return token
      }

      // アクセストークンの期限が切れている場合、リフレッシュトークンで更新
      return await refreshAccessToken(token)
    },
    async session({ session, token }: any) {
      session.accessToken = token.accessToken
      session.error = token.error
      return session
    }
  }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }