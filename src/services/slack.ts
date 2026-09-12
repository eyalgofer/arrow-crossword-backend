/**
 * Slack incoming-webhook notifications.
 *
 * Env:
 * - SLACK_WEBHOOK_URL (required to send) — keep in Secrets Manager / .env only
 */

import { User } from '../models/User';

type NewUserSlackFields = {
  displayName?: string | null;
  email: string;
  userNumber: number;
};

export async function getUserNumber(): Promise<number> {
  return User.countDocuments();
}

export async function notifyNewUser(fields: NewUserSlackFields): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn('[Slack] Skipping new-user notify — set SLACK_WEBHOOK_URL');
    return;
  }

  const name = fields.displayName?.trim() || 'not set';
  const text = [
    `🎉 New user number ${fields.userNumber}`,
    `Name: ${name}`,
    `Email: ${fields.email}`,
  ].join('\n');

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[Slack] New-user notify failed', response.status, body);
      return;
    }

    console.log(`[Slack] New-user notify sent (#${fields.userNumber})`);
  } catch (error) {
    console.error('[Slack] New-user notify error', error);
  }
}
