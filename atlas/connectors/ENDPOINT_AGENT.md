# Work Computer Agent — Spec & Compliance

The endpoint agent is a lightweight program that runs on an employee's work
computer and reports **task activity and efficiency** to Company Brain. It is
designed to be **transparent and consent-based** — not covert surveillance.

> The agent binary is platform-specific (macOS/Windows/Linux) and ships
> separately. This document is the contract it implements against the server.

## Compliance first (read this)

Employee monitoring is regulated. Before deploying:
- **Notify employees** and disclose what is captured (most US states, the EU/UK
  under GDPR, and many others legally require notice; some require consent).
- **Record consent** per employee in Company Brain — the server **rejects**
  activity for anyone not enrolled with consent on file.
- **Minimize**: leave content capture OFF (the default) unless you have explicit,
  documented consent for it. Keep sensitive categories excluded.
- Consult counsel for your jurisdictions. Company Brain enforces technical
  guardrails; it cannot provide legal advice.

## Enrollment

1. Add the employee and **record their consent** (Workforce screen).
2. **Enroll their device** → you receive a one-time `agentKey` and a `deviceId`.
3. Configure the desktop agent with those two values. The key is stored only as
   a hash server-side; it is shown once.

## Reporting activity

The agent batches activity and POSTs periodically:

```
POST /api/endpoint/activity
Headers:
  x-device-id: dev_...
  x-agent-key: ak_...
Body:
{
  "events": [
    {
      "occurred_at": "2026-06-01T15:04:00Z",
      "category": "crm",            // crm|email|docs|dev|design|support|personal|banking|health|...
      "app": "HubSpot",
      "title": "Acme renewal",      // optional, redacted on store
      "action": "task_complete",    // focus|edit|task_start|task_complete|...
      "task": "Acme renewal",
      "duration_s": 720,
      "content": "..."              // optional; DROPPED unless policy.capture_content
    }
  ]
}
```

## What the server does with it (enforced, in order)

1. **Authenticate** the device (id + key, must be `active`).
2. **Consent gate** — reject the batch unless the employee is enrolled & consented.
3. **Policy** — drop events in excluded categories/apps, outside active hours, or
   out of capture scope.
4. **Minimize** — strip `content` unless `capture_content` is enabled.
5. **Redact** — PII redactor runs on any retained text.
6. **Store & index** as normalized events (`source=endpoint`) and record
   efficiency metrics (time per category) for analytics.

Captured activity then feeds the same brain: efficiency tracking, the SOP miner
(tribal-knowledge capture), course-of-action recommendations, and standardized
onboarding.

## Agent responsibilities (client side)

- Respect a local kill switch / pause that the employee can see.
- Send only category/metadata by default; gate any content behind the server
  policy (the server drops it anyway if disabled — defense in depth).
- Back off and retry on 5xx; treat 401/403 as "stop and re-enroll / consent".
