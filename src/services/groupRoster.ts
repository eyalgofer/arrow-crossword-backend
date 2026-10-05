import mongoose from 'mongoose';

const GROUP_NAME_MAX = 80;

export interface NamedMember {
  displayName?: string | null;
  email?: string | null;
}

export function canonicalUserId(id: unknown): string | null {
  if (id == null) {
    return null;
  }
  const value = String(id);
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }
  return new mongoose.Types.ObjectId(value).toString();
}

/** Stable identity for an owner plus the other people in the group. Order does not matter. */
export function memberKeyFor(memberIds: string[]): string {
  return [...memberIds].sort().join('|');
}

export function firstNameOf(member: NamedMember): string {
  const raw = member.displayName?.trim() || member.email?.split('@')[0]?.trim() || 'Player';
  const first = raw.split(/\s+/)[0];
  return first || 'Player';
}

export function defaultGroupName(members: NamedMember[]): string {
  return members.map(firstNameOf).join(', ');
}

export function validateMemberIds(
  memberIds: unknown,
  ownerId: string
): { ok: true; memberIds: string[] } | { ok: false; error: string } {
  if (!Array.isArray(memberIds) || memberIds.length < 1 || memberIds.length > 3) {
    return { ok: false, error: 'Choose 1 to 3 players' };
  }

  const canonical: string[] = [];
  for (const memberId of memberIds) {
    const id = canonicalUserId(memberId);
    if (!id) {
      return { ok: false, error: 'Invalid player id' };
    }
    canonical.push(id);
  }

  if (new Set(canonical).size !== canonical.length) {
    return { ok: false, error: 'Players must be distinct' };
  }

  const owner = canonicalUserId(ownerId) ?? ownerId;
  if (canonical.includes(owner)) {
    return { ok: false, error: 'You cannot include yourself' };
  }

  return { ok: true, memberIds: canonical };
}

export function parseOptionalGroupName(
  raw: unknown
): { ok: true; name?: string } | { ok: false; error: string } {
  if (raw == null) {
    return { ok: true };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: 'name must be a string' };
  }
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) {
    return { ok: true };
  }
  if (Array.from(name).length > GROUP_NAME_MAX) {
    return { ok: false, error: `name must be ${GROUP_NAME_MAX} characters or fewer` };
  }
  return { ok: true, name };
}
