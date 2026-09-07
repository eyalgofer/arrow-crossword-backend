/**
 * OneSignal push delivery.
 *
 * Env:
 * - ONESIGNAL_APP_ID (required to send)
 * - ONESIGNAL_REST_API_KEY (required to send) — keep in Secrets Manager / .env only
 */

const ONESIGNAL_API_URL = 'https://api.onesignal.com/notifications';

export const GAME_INVITE_NOTIFICATION_TYPE = 'game_invite';
export const INVITE_ACCEPTED_NOTIFICATION_TYPE = 'invite_accepted';
export const INVITE_DECLINED_NOTIFICATION_TYPE = 'invite_declined';

export type MatchKindLabel = 'quick' | 'normal' | 'unlimited time';

export function matchKindLabel(mode: string | undefined, timed: boolean | undefined): MatchKindLabel {
  if (mode === 'quick') return 'quick';
  if (timed === false) return 'unlimited time';
  return 'normal';
}

function matchKindLabelHe(kind: MatchKindLabel): string {
  switch (kind) {
    case 'quick':
      return 'מהיר';
    case 'unlimited time':
      return 'ללא הגבלת זמן';
    default:
      return 'רגיל';
  }
}

export function buildGameInviteCopy(params: {
  displayName: string;
  mode?: string;
  timed?: boolean;
}): { headings: Record<string, string>; contents: Record<string, string> } {
  const name = params.displayName.trim() || 'Someone';
  const kind = matchKindLabel(params.mode, params.timed);
  const kindHe = matchKindLabelHe(kind);

  return {
    headings: {
      en: 'Match invite',
      he: 'הזמנה למשחק',
    },
    contents: {
      en: `${name} invited you for a ${kind} match. Tap to respond.`,
      he: `${name} מזמין אותך למשחק ${kindHe}! לחצ/י להצטרפות.`,
    },
  };
}

export function buildInviteAcceptedCopy(params: {
  displayName: string;
  mode?: string;
  timed?: boolean;
}): { headings: Record<string, string>; contents: Record<string, string> } {
  const name = params.displayName.trim() || 'Your friend';
  const kind = matchKindLabel(params.mode, params.timed);
  const kindHe = matchKindLabelHe(kind);

  return {
    headings: {
      en: 'Invite accepted',
      he: 'ההזמנה התקבלה',
    },
    contents: {
      en: `${name} accepted your ${kind} match invite. Tap to play!`,
      he: `${name} קיבל/ה את ההזמנה למשחק ${kindHe}! לחצ/י כדי לשחק.`,
    },
  };
}

export function buildInviteDeclinedCopy(params: {
  displayName: string;
}): { headings: Record<string, string>; contents: Record<string, string> } {
  const name = params.displayName.trim() || 'Your friend';

  return {
    headings: {
      en: 'Invite declined',
      he: 'ההזמנה נדחתה',
    },
    contents: {
      en: `${name} declined your match invite. Maybe next time!`,
      he: `${name} דחה/תה את ההזמנה למשחק. אולי בפעם הבאה!`,
    },
  };
}

type SendPushParams = {
  /**
   * External user id — must match OneSignal.login(user.id) on the client.
   * The auth API returns `firebaseUid` as `user.id`, so pass `User.firebaseUid`
   * (the Google/Apple subject), not the MongoDB `_id`.
   */
  externalUserId: string;
  headings: Record<string, string>;
  contents: Record<string, string>;
  data?: Record<string, string>;
};

export async function sendPushToExternalUser(params: SendPushParams): Promise<boolean> {
  const appId = process.env.ONESIGNAL_APP_ID?.trim();
  const apiKey = process.env.ONESIGNAL_REST_API_KEY?.trim();

  if (!appId || !apiKey) {
    console.warn(
      '[OneSignal] Skipping push — set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY'
    );
    return false;
  }

  if (!params.externalUserId) {
    console.warn('[OneSignal] Skipping push — missing externalUserId');
    return false;
  }

  const body = {
    app_id: appId,
    target_channel: 'push',
    include_aliases: {
      external_id: [params.externalUserId],
    },
    headings: params.headings,
    contents: params.contents,
    data: params.data ?? {},
  };

  try {
    const response = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      errors?: unknown;
    };

    if (!response.ok) {
      console.error('[OneSignal] Push failed', response.status, payload);
      return false;
    }

    if (!payload.id) {
      // HTTP 200 with empty id usually means no subscribed recipients for that alias.
      console.warn('[OneSignal] Push created with no recipients', payload);
      return false;
    }

    console.log('[OneSignal] Push sent', payload.id);
    return true;
  } catch (error) {
    console.error('[OneSignal] Push request error', error);
    return false;
  }
}

export async function sendGameInvitePush(params: {
  toUserId: string;
  fromDisplayName: string;
  inviteId: string;
  mode?: string;
  timed?: boolean;
}): Promise<boolean> {
  const { headings, contents } = buildGameInviteCopy({
    displayName: params.fromDisplayName,
    mode: params.mode,
    timed: params.timed,
  });

  return sendPushToExternalUser({
    externalUserId: params.toUserId,
    headings,
    contents,
    data: {
      type: GAME_INVITE_NOTIFICATION_TYPE,
      inviteId: params.inviteId,
      screen: 'multiplayer',
    },
  });
}

/** Sent to the inviter when the invitee accepts; carries the match so the app can jump straight in. */
export async function sendInviteAcceptedPush(params: {
  toUserId: string;
  fromDisplayName: string;
  inviteId: string;
  matchId: string;
  puzzleId: string;
  mode?: string;
  timed?: boolean;
}): Promise<boolean> {
  const { headings, contents } = buildInviteAcceptedCopy({
    displayName: params.fromDisplayName,
    mode: params.mode,
    timed: params.timed,
  });

  return sendPushToExternalUser({
    externalUserId: params.toUserId,
    headings,
    contents,
    data: {
      type: INVITE_ACCEPTED_NOTIFICATION_TYPE,
      inviteId: params.inviteId,
      matchId: params.matchId,
      puzzleId: params.puzzleId,
      screen: 'multiplayer',
    },
  });
}

/** Sent to the inviter when the invitee declines. */
export async function sendInviteDeclinedPush(params: {
  toUserId: string;
  fromDisplayName: string;
  inviteId: string;
}): Promise<boolean> {
  const { headings, contents } = buildInviteDeclinedCopy({
    displayName: params.fromDisplayName,
  });

  return sendPushToExternalUser({
    externalUserId: params.toUserId,
    headings,
    contents,
    data: {
      type: INVITE_DECLINED_NOTIFICATION_TYPE,
      inviteId: params.inviteId,
      screen: 'multiplayer',
    },
  });
}
