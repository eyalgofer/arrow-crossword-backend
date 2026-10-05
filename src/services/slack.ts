/**
 * Slack incoming-webhook notifications.
 *
 * Each webhook is bound to one channel, so new-users and random-play use
 * separate URLs. Keep both in Secrets Manager / .env only.
 *
 * Env:
 * - SLACK_WEBHOOK_URL — #new-users
 * - SLACK_RANDOM_PLAY_WEBHOOK_URL — #random-play
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

type RandomPlaySlackFields = {
  displayName?: string | null;
  language?: string | null;
  device?: string | null;
};

function deviceLabel(device?: string | null): string {
  return device === 'ios' || device === 'android' ? device : 'unknown';
}

async function postSlack(webhookUrl: string, text: string, label: string): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`[Slack] ${label} notify failed`, response.status, body);
      return;
    }

    console.log(`[Slack] ${label} notify sent`);
  } catch (error) {
    console.error(`[Slack] ${label} notify error`, error);
  }
}

export async function getUserNumber(): Promise<number> {
  return User.countDocuments();
}

export async function notifyNewUser(fields: NewUserSlackFields): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn('[Slack] Skipping new-user notify — set SLACK_WEBHOOK_URL');
    return;
  }

  const device = deviceLabel(fields.device);
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

  await postSlack(webhookUrl, lines.join('\n'), `new-user (#${fields.userNumber})`);
}

export async function notifyRandomPlaySearch(fields: RandomPlaySlackFields): Promise<void> {
  const webhookUrl = process.env.SLACK_RANDOM_PLAY_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn('[Slack] Skipping random-play notify — set SLACK_RANDOM_PLAY_WEBHOOK_URL');
    return;
  }

  const lines = [
    '🎲 Random play search',
    `Player: ${fields.displayName || 'unknown'}`,
    `Language: ${fields.language || 'unknown'}`,
    `Device: ${deviceLabel(fields.device)}`,
  ];

  await postSlack(webhookUrl, lines.join('\n'), 'random-play');
}
