/**
 * Slack incoming-webhook notifications.
 *
 * Env:
 * - SLACK_WEBHOOK_URL (required to send) — keep in Secrets Manager / .env only
 */

import { User } from '../models/User';

type NewUserSlackFields = {
  displayName?: string | null;
  email?: string | null;
  userNumber: number;
  device?: string | null;
  kind?: 'new' | 'guest' | 'guest_upgrade';
  provider?: 'google' | 'apple';
  linkedExisting?: boolean;
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

  const device = fields.device === 'ios' || fields.device === 'android'
    ? fields.device
    : 'unknown';
  const kind = fields.kind ?? 'new';
  const lines: string[] = [];

  if (kind === 'guest') {
    lines.push(`👤 Guest user number ${fields.userNumber}`);
    lines.push(`Device: ${device}`);
  } else if (kind === 'guest_upgrade') {
    const providerLabel = fields.provider === 'apple' ? 'Apple' : 'Google';
    const suffix = fields.linkedExisting ? ' (existing account)' : '';
    lines.push(`🔗 Guest → ${providerLabel}${suffix}`);
    lines.push(`Email: ${fields.email || 'unknown'}`);
    lines.push(`Device: ${device}`);
    lines.push(`User number: ${fields.userNumber}`);
  } else {
    lines.push(`🎉 New user number ${fields.userNumber}`);
    lines.push(`Email: ${fields.email || 'unknown'}`);
    lines.push(`Device: ${device}`);
  }

  const text = lines.join('\n');

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
