import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isMultiplayerPlayer } from './guestAuth';

describe('multiplayer players', () => {
  it('includes signed-in accounts and hides guests', () => {
    assert.equal(isMultiplayerPlayer({ isGuest: false }), true);
    assert.equal(isMultiplayerPlayer({}), true);
    assert.equal(isMultiplayerPlayer({ isGuest: true }), false);
    assert.equal(isMultiplayerPlayer(null), false);
  });
});
