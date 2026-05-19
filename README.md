# Social Media Analytics Dashboard

Real-time analytics dashboard for Meta (Facebook + Instagram) and LinkedIn business accounts and ad campaigns.

## Features

- **Meta**: Facebook Page fans/followers, page impressions, reach, engaged users, Instagram followers, ad campaign performance (spend, impressions, clicks, CTR, CPC, conversions)
- **LinkedIn**: Company page followers, post impressions, reactions/comments/shares, ad campaign performance
- **Charts**: 30-day trend lines for impressions, reach, and engagement
- **Auto-refresh**: Data refreshes every 5 minutes automatically
- **Date ranges**: 7-day, 30-day, or 90-day views

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in your values in `.env.local`:

```
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

META_APP_ID=...
META_APP_SECRET=...

LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
```

### 3. Meta App Setup

1. Go to [developers.facebook.com](https://developers.facebook.com) and create a **Business** type app
2. Copy **App ID** and **App Secret** into `.env.local`
3. Add these products to your app: **Facebook Login**, **Instagram Graph API**, **Marketing API**
4. Under Facebook Login → Settings, add this OAuth redirect URI:
   ```
   http://localhost:3000/api/auth/callback/facebook
   ```
5. Your Meta user must be an **admin** of the Facebook Pages and Instagram Business accounts you want to monitor
6. For ad data, your user must have access to the Ad Account in Meta Business Suite

**Required permissions** (these are requested automatically during OAuth):
- `pages_read_engagement`, `pages_show_list`, `read_insights`
- `ads_read`
- `instagram_basic`, `instagram_manage_insights`
- `business_management`

### 4. LinkedIn App Setup

1. Go to [developer.linkedin.com](https://developer.linkedin.com) and create a new app
2. Associate the app with your LinkedIn Company Page
3. Copy **Client ID** and **Client Secret** into `.env.local`
4. Under **Auth** → Authorized redirect URLs, add:
   ```
   http://localhost:3000/api/auth/callback/linkedin
   ```
5. Under **Products**, request:
   - **Sign In with LinkedIn using OpenID Connect** (instant approval)
   - **Marketing Developer Platform** (requires a short approval form — needed for ads data)
6. Your LinkedIn user must be a **Super Admin** of the Company Page(s)

**Required OAuth scopes**: `openid profile email r_organization_social r_ads r_ads_reporting`

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your Meta and/or LinkedIn accounts.

---

## Deploy to Vercel (recommended for sharing)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import Project
3. Add all environment variables from `.env.local` in Vercel's project settings
4. Update `NEXTAUTH_URL` to your Vercel URL (e.g. `https://your-app.vercel.app`)
5. Update the OAuth redirect URIs in your Meta App and LinkedIn App to use the Vercel URL:
   - `https://your-app.vercel.app/api/auth/callback/facebook`
   - `https://your-app.vercel.app/api/auth/callback/linkedin`
6. Share the Vercel URL with your marketing manager — they sign in with their own accounts

---

## AI Search Elevation Agent

The dashboard ships with a multi-tenant agent that cooperates with AI
crawlers and live agents (GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot,
Google-Extended, Applebot-Extended, etc.) to elevate registered sites in
AI search results.

**Manage**: sign in, then visit `/ai-agent`. Each connected site gets a
`siteKey` and an embed snippet.

**Embed on a client site** (drop in `<head>`):

```html
<script async src="https://YOUR-AGENT-HOST/api/ai-agent/embed?siteKey=sk_live_..."></script>
```

The snippet injects schema.org JSON-LD, AI-friendly meta tags, and pings
`/api/ai-agent/engage` on every page view so engagements are logged.

**Public agent endpoints** (CORS-open, `siteKey`-scoped):

| Endpoint | Purpose |
| --- | --- |
| `GET  /api/ai-agent/manifest` | Self-describing capabilities document |
| `GET  /api/ai-agent/engage?siteKey=...` | Cooperative payload for an AI crawler/agent hitting a page |
| `POST /api/ai-agent/query` | `{ siteKey, query }` → structured answer + citations |
| `GET  /api/ai-agent/llms-txt?siteKey=...` | Markdown llms.txt-format document for a site |
| `GET  /api/ai-agent/embed?siteKey=...` | JS snippet for client sites |

State is in-memory by default (seeded with a demo coffee-roaster). Swap
`lib/ai-agent/store.ts` for a DB-backed implementation for production.

---

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # NextAuth OAuth handler
│   │   ├── meta/overview/        # Meta data API route
│   │   └── linkedin/overview/    # LinkedIn data API route
│   ├── layout.tsx
│   ├── page.tsx                  # Main dashboard
│   └── providers.tsx
├── components/dashboard/
│   ├── Header.tsx                # Top nav with controls
│   ├── MetricCard.tsx            # KPI metric card
│   ├── PerformanceChart.tsx      # Recharts line chart
│   ├── CampaignTable.tsx         # Ad campaign table
│   └── PlatformSection.tsx       # Meta / LinkedIn sections
├── lib/
│   ├── auth.ts                   # NextAuth config
│   ├── meta.ts                   # Meta Graph API client
│   ├── linkedin.ts               # LinkedIn API client
│   └── utils.ts                  # Formatting helpers
└── types/index.ts                # TypeScript types
```
