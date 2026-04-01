import type { NextAuthOptions } from 'next-auth';
import FacebookProvider from 'next-auth/providers/facebook';
import LinkedInProvider from 'next-auth/providers/linkedin';

declare module 'next-auth' {
  interface Session {
    metaAccessToken?: string;
    linkedinAccessToken?: string;
    connectedProviders: string[];
    error?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    metaAccessToken?: string;
    metaTokenExpiry?: number;
    linkedinAccessToken?: string;
    linkedinTokenExpiry?: number;
    connectedProviders: string[];
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    FacebookProvider({
      clientId: process.env.META_APP_ID!,
      clientSecret: process.env.META_APP_SECRET!,
      authorization: {
        params: {
          scope: [
            'email',
            'public_profile',
            'pages_read_engagement',
            'pages_show_list',
            'read_insights',
            'ads_read',
            'instagram_basic',
            'instagram_manage_insights',
            'business_management',
          ].join(','),
        },
      },
    }),
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid profile email r_organization_social r_ads r_ads_reporting',
        },
      },
      issuer: 'https://www.linkedin.com',
      jwks_endpoint: 'https://www.linkedin.com/oauth/openid/jwks',
      async profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account }) {
      // On sign-in, store the provider's access token
      if (account) {
        if (account.provider === 'facebook') {
          token.metaAccessToken = account.access_token;
          token.metaTokenExpiry = account.expires_at;
          if (!token.connectedProviders) token.connectedProviders = [];
          if (!token.connectedProviders.includes('meta')) {
            token.connectedProviders = [...token.connectedProviders, 'meta'];
          }
        }
        if (account.provider === 'linkedin') {
          token.linkedinAccessToken = account.access_token;
          token.linkedinTokenExpiry = account.expires_at;
          if (!token.connectedProviders) token.connectedProviders = [];
          if (!token.connectedProviders.includes('linkedin')) {
            token.connectedProviders = [...token.connectedProviders, 'linkedin'];
          }
        }
      }
      if (!token.connectedProviders) token.connectedProviders = [];
      return token;
    },

    async session({ session, token }) {
      session.metaAccessToken = token.metaAccessToken;
      session.linkedinAccessToken = token.linkedinAccessToken;
      session.connectedProviders = token.connectedProviders ?? [];
      return session;
    },
  },

  pages: {
    signIn: '/',
    error: '/',
  },

  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24, // 24 hours
  },
};
