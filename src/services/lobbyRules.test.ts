import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LOBBY_WAITING_MS,
  canStartLobby,
  isLobbyExpired,
  lobbyExpiresAt,
  seatStatusForAction
} from './lobbyRules';

describe('lobby rules', () => {
  const host = { isHost: true, status: 'joined' };

  it('drops a waiting lobby after 15 minutes', () => {
    assert.equal(LOBBY_WAITING_MS, 15 * 60 * 1000);
    const created = new Date('2026-10-05T12:00:00.000Z');
    const expires = lobbyExpiresAt(created);
    assert.equal(isLobbyExpired(expires, new Date('2026-10-05T12:14:59.000Z')), false);
    assert.equal(isLobbyExpired(expires, new Date('2026-10-05T12:15:00.000Z')), true);
  });

  it('accept joins a seat and decline marks it declined without other effects', () => {
    assert.equal(seatStatusForAction('accept'), 'joined');
    assert.equal(seatStatusForAction('decline'), 'declined');
    assert.equal(seatStatusForAction('start'), null);
  });

  it('refuses to start until an invitee has joined', () => {
    const waiting = canStartLobby({
      status: 'waiting',
      seats: [host, { isHost: false, status: 'invited' }, { isHost: false, status: 'invited' }]
    });
    assert.equal(waiting.ok, false);

    const ready = canStartLobby({
      status: 'waiting',
      seats: [host, { isHost: false, status: 'joined' }, { isHost: false, status: 'invited' }]
    });
    assert.equal(ready.ok, true);
  });

  it('refuses to start a lobby that is no longer waiting', () => {
    const started = canStartLobby({
      status: 'started',
      seats: [host, { isHost: false, status: 'joined' }]
    });
    assert.equal(started.ok, false);
  });
});
