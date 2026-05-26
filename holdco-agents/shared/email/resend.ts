import { Resend } from 'resend';
import 'dotenv/config';

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

export type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer }[];
};

export async function sendEmail(args: SendArgs): Promise<{ id: string | null; error: string | null }> {
  const from = process.env.REPORT_FROM_EMAIL;
  if (!resend || !from) {
    return {
      id: null,
      error: !resend ? 'RESEND_API_KEY missing' : 'REPORT_FROM_EMAIL missing',
    };
  }
  try {
    const result = await resend.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.replyTo,
      attachments: args.attachments,
    });
    if (result.error) return { id: null, error: result.error.message };
    return { id: result.data?.id ?? null, error: null };
  } catch (err) {
    return { id: null, error: err instanceof Error ? err.message : String(err) };
  }
}
