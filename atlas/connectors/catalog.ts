// The catalog of tools Company Brain can connect to. This is the menu the
// "Add a source" UI renders. An entry being listed here means the platform
// knows how to talk to it; whether a rich in-process connector exists yet is
// derived at runtime (see /api/catalog merging with the registry). Anything not
// yet hand-built can still connect via the generic Webhook / Custom API source.

export type CatalogAuthKind = "oauth2" | "api_key" | "hmac_webhook" | "token" | "none";

export interface CatalogField {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  help?: string;
}

export interface CatalogEntry {
  source: string;
  name: string;
  category: string;
  description: string;
  authKind: CatalogAuthKind;
  /** What data this source feeds into the brain. */
  provides: string[];
  /** Fields the integration UI collects to connect. */
  fields: CatalogField[];
}

export const CATEGORIES = [
  "Email",
  "Calls & Meetings",
  "CRM & Sales",
  "Finance & Billing",
  "Support",
  "Docs & Knowledge",
  "Calendar",
  "Messaging",
  "Project Management",
  "Marketing & Social",
  "Storage",
  "Workforce",
  "Custom",
] as const;

const token = (help?: string): CatalogField[] => [
  { key: "webhook_token", label: "Webhook verification token", secret: true, required: true, help },
];
const hmac = (help?: string): CatalogField[] => [
  { key: "signing_secret", label: "Signing secret", secret: true, required: true, help },
];
const apiKey = (help?: string): CatalogField[] => [
  { key: "api_key", label: "API key", secret: true, required: true, help },
];
const oauth: CatalogField[] = [
  { key: "access_token", label: "Access token", secret: true, required: true },
  { key: "refresh_token", label: "Refresh token", secret: true },
];

export const CATALOG: CatalogEntry[] = [
  // ─── Email ───
  { source: "gmail", name: "Gmail / Google Workspace", category: "Email", authKind: "oauth2",
    description: "Email threads, participants, and outcomes.", provides: ["email.received", "email.sent"], fields: oauth },
  { source: "ms365_mail", name: "Microsoft 365 / Outlook Mail", category: "Email", authKind: "oauth2",
    description: "Outlook email across the org.", provides: ["email.received", "email.sent"], fields: oauth },

  // ─── Calls & Meetings ───
  { source: "dialpad", name: "Dialpad", category: "Calls & Meetings", authKind: "hmac_webhook",
    description: "Calls with transcripts and dispositions.", provides: ["call.completed"], fields: hmac() },
  { source: "aircall", name: "Aircall", category: "Calls & Meetings", authKind: "hmac_webhook",
    description: "Phone calls, recordings, transcripts.", provides: ["call.completed"], fields: hmac() },
  { source: "zoom", name: "Zoom", category: "Calls & Meetings", authKind: "oauth2",
    description: "Meeting recordings and transcripts.", provides: ["meeting.completed"], fields: oauth },
  { source: "google_meet", name: "Google Meet", category: "Calls & Meetings", authKind: "oauth2",
    description: "Meeting recordings and notes.", provides: ["meeting.completed"], fields: oauth },
  { source: "gong", name: "Gong", category: "Calls & Meetings", authKind: "api_key",
    description: "Revenue-intelligence call data.", provides: ["call.completed"], fields: apiKey() },
  { source: "fireflies", name: "Fireflies.ai", category: "Calls & Meetings", authKind: "api_key",
    description: "Meeting transcripts and summaries.", provides: ["meeting.completed"], fields: apiKey() },

  // ─── CRM & Sales ───
  { source: "hubspot", name: "HubSpot", category: "CRM & Sales", authKind: "oauth2",
    description: "Deals, contacts, stages, activity.", provides: ["deal.updated", "contact.updated"], fields: oauth },
  { source: "salesforce", name: "Salesforce", category: "CRM & Sales", authKind: "oauth2",
    description: "Opportunities, accounts, activity.", provides: ["deal.updated", "account.updated"], fields: oauth },
  { source: "pipedrive", name: "Pipedrive", category: "CRM & Sales", authKind: "api_key",
    description: "Pipeline, deals, and activity.", provides: ["deal.updated"], fields: apiKey() },
  { source: "close", name: "Close", category: "CRM & Sales", authKind: "api_key",
    description: "Sales CRM activity and calls.", provides: ["deal.updated", "call.completed"], fields: apiKey() },

  // ─── Finance & Billing ───
  { source: "stripe", name: "Stripe", category: "Finance & Billing", authKind: "hmac_webhook",
    description: "Payments, invoices, MRR, churn.", provides: ["invoice.paid", "subscription.updated"], fields: hmac("From Stripe → Webhooks → signing secret") },
  { source: "quickbooks", name: "QuickBooks", category: "Finance & Billing", authKind: "oauth2",
    description: "Invoices, AR aging, quarter close.", provides: ["invoice.created", "payment.received"], fields: oauth },
  { source: "xero", name: "Xero", category: "Finance & Billing", authKind: "oauth2",
    description: "Accounting and invoicing.", provides: ["invoice.created"], fields: oauth },
  { source: "brex", name: "Brex", category: "Finance & Billing", authKind: "api_key",
    description: "Card spend and expenses.", provides: ["transaction.posted"], fields: apiKey() },
  { source: "ramp", name: "Ramp", category: "Finance & Billing", authKind: "api_key",
    description: "Spend management and bills.", provides: ["transaction.posted"], fields: apiKey() },

  // ─── Support ───
  { source: "zendesk", name: "Zendesk", category: "Support", authKind: "api_key",
    description: "Tickets, CSAT, resolution time.", provides: ["ticket.resolved", "ticket.created"], fields: apiKey() },
  { source: "intercom", name: "Intercom", category: "Support", authKind: "oauth2",
    description: "Conversations and customer messages.", provides: ["conversation.closed"], fields: oauth },
  { source: "freshdesk", name: "Freshdesk", category: "Support", authKind: "api_key",
    description: "Support tickets and SLAs.", provides: ["ticket.resolved"], fields: apiKey() },
  { source: "helpscout", name: "Help Scout", category: "Support", authKind: "api_key",
    description: "Shared inbox conversations.", provides: ["conversation.closed"], fields: apiKey() },

  // ─── Docs & Knowledge ───
  { source: "notion", name: "Notion", category: "Docs & Knowledge", authKind: "oauth2",
    description: "Docs, notes, and decision logs.", provides: ["doc.updated"], fields: oauth },
  { source: "google_drive", name: "Google Drive", category: "Docs & Knowledge", authKind: "oauth2",
    description: "Documents and files.", provides: ["doc.updated"], fields: oauth },
  { source: "confluence", name: "Confluence", category: "Docs & Knowledge", authKind: "api_key",
    description: "Wiki pages and knowledge base.", provides: ["doc.updated"], fields: apiKey() },

  // ─── Calendar ───
  { source: "google_calendar", name: "Google Calendar", category: "Calendar", authKind: "oauth2",
    description: "Meetings, attendees, no-shows.", provides: ["meeting.scheduled"], fields: oauth },
  { source: "outlook_calendar", name: "Outlook Calendar", category: "Calendar", authKind: "oauth2",
    description: "Calendar events and attendance.", provides: ["meeting.scheduled"], fields: oauth },

  // ─── Messaging ───
  { source: "slack", name: "Slack", category: "Messaging", authKind: "oauth2",
    description: "Channels, threads, decisions.", provides: ["message.posted"], fields: oauth },
  { source: "ms_teams", name: "Microsoft Teams", category: "Messaging", authKind: "oauth2",
    description: "Team chats and channels.", provides: ["message.posted"], fields: oauth },
  { source: "discord", name: "Discord", category: "Messaging", authKind: "token",
    description: "Community and team channels.", provides: ["message.posted"], fields: token() },

  // ─── Project Management ───
  { source: "linear", name: "Linear", category: "Project Management", authKind: "hmac_webhook",
    description: "Issues, cycles, velocity.", provides: ["issue.updated"], fields: hmac() },
  { source: "jira", name: "Jira", category: "Project Management", authKind: "oauth2",
    description: "Tickets, sprints, throughput.", provides: ["issue.updated"], fields: oauth },
  { source: "asana", name: "Asana", category: "Project Management", authKind: "api_key",
    description: "Tasks and projects.", provides: ["task.updated"], fields: apiKey() },
  { source: "trello", name: "Trello", category: "Project Management", authKind: "api_key",
    description: "Boards and cards.", provides: ["card.updated"], fields: apiKey() },
  { source: "monday", name: "monday.com", category: "Project Management", authKind: "api_key",
    description: "Work boards and items.", provides: ["item.updated"], fields: apiKey() },

  // ─── Marketing & Social ───
  { source: "meta", name: "Meta (Facebook + Instagram)", category: "Marketing & Social", authKind: "oauth2",
    description: "Page + ad performance, engagement.", provides: ["ad.metrics", "post.metrics"], fields: oauth },
  { source: "linkedin", name: "LinkedIn", category: "Marketing & Social", authKind: "oauth2",
    description: "Company page + ad performance.", provides: ["ad.metrics", "post.metrics"], fields: oauth },
  { source: "google_analytics", name: "Google Analytics", category: "Marketing & Social", authKind: "oauth2",
    description: "Site traffic and conversions.", provides: ["traffic.metrics"], fields: oauth },
  { source: "mailchimp", name: "Mailchimp", category: "Marketing & Social", authKind: "api_key",
    description: "Email campaign performance.", provides: ["campaign.metrics"], fields: apiKey() },

  // ─── Storage ───
  { source: "s3", name: "Amazon S3", category: "Storage", authKind: "api_key",
    description: "Files and documents in buckets.", provides: ["file.added"],
    fields: [ { key: "access_key_id", label: "Access key ID", required: true },
              { key: "secret_access_key", label: "Secret access key", secret: true, required: true },
              { key: "bucket", label: "Bucket name", required: true } ] },
  { source: "dropbox", name: "Dropbox", category: "Storage", authKind: "oauth2",
    description: "Shared files and folders.", provides: ["file.added"], fields: oauth },

  // ─── Workforce (consent-gated endpoint monitoring) ───
  { source: "endpoint", name: "Work Computer Agent", category: "Workforce", authKind: "token",
    description: "Desktop agent that reports task activity & efficiency. Consent-gated, metadata-only by default. Configure on the Workforce screen.",
    provides: ["activity.*"],
    fields: [{ key: "note", label: "Notes (enroll devices on the Workforce screen)" }] },

  // ─── Custom (connect anything) ───
  { source: "webhook", name: "Generic Webhook", category: "Custom", authKind: "token",
    description: "Connect ANY tool that can send a webhook. Map fields to events.",
    provides: ["*"], fields: token("Any value; the sender must include it as the x-atlas-webhook-token header.") },
  { source: "zapier", name: "Zapier / Make", category: "Custom", authKind: "token",
    description: "Bridge 6,000+ apps via a Zap that posts to the webhook.",
    provides: ["*"], fields: token() },
  { source: "custom_api", name: "Custom API / Direct", category: "Custom", authKind: "token",
    description: "POST normalized events straight to /api/events with the ingest secret.",
    provides: ["*"], fields: [{ key: "note", label: "Notes (optional)" }] },
];

export function catalogEntry(source: string): CatalogEntry | undefined {
  return CATALOG.find((c) => c.source === source);
}
