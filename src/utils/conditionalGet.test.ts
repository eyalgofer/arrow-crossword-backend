import assert from 'node:assert/strict';
import test from 'node:test';
import { Request, Response } from 'express';
import { entityTag, ifNoneMatchMatches, sendCachedJson } from './conditionalGet';

function fakeReq(ifNoneMatch?: string): Request {
  return {
    headers: ifNoneMatch == null ? {} : { 'if-none-match': ifNoneMatch },
  } as Request;
}

function fakeRes() {
  const headers = new Map<string, string>();
  const state = {
    statusCode: 200,
    body: undefined as unknown,
    ended: false,
    built: 0,
  };
  const res = {
    set(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return res;
    },
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    removeHeader(name: string) {
      headers.delete(name.toLowerCase());
    },
    end() {
      state.ended = true;
    },
    json(payload: unknown) {
      state.body = payload;
    },
  };
  return { res: res as unknown as Response, headers, state };
}

test('a request without If-None-Match gets 200 and the JSON body', () => {
  const { res, headers, state } = fakeRes();
  sendCachedJson(fakeReq(), res, { language: 'he' }, () => {
    state.built += 1;
    return { packages: [{ name: 'Getting Started' }] };
  });

  assert.equal(state.built, 1);
  assert.equal(state.statusCode, 200);
  assert.equal(state.ended, false);
  assert.deepEqual(state.body, { packages: [{ name: 'Getting Started' }] });
  assert.equal(headers.get('etag'), entityTag({ language: 'he' }));
  assert.equal(headers.get('cache-control'), 'private');
});

test('a matching If-None-Match is 304 and does not build the payload', () => {
  const etag = entityTag({ language: 'he' });
  const { res, headers, state } = fakeRes();
  sendCachedJson(fakeReq(etag), res, { language: 'he' }, () => {
    state.built += 1;
    return { packages: [] };
  });

  assert.equal(state.built, 0);
  assert.equal(state.body, undefined);
  assert.equal(state.statusCode, 304);
  assert.equal(state.ended, true);
  assert.equal(headers.get('etag'), etag);
  assert.equal(headers.get('cache-control'), 'private');
  assert.equal(headers.has('content-type'), false);
});

test('a different If-None-Match still returns 200', () => {
  const { res, state } = fakeRes();
  sendCachedJson(fakeReq('"other"'), res, { language: 'en' }, () => ({ ok: true }));
  assert.deepEqual(state.body, { ok: true });
  assert.equal(state.statusCode, 200);
});

test('If-None-Match comparison', () => {
  const etag = entityTag({ n: 1 });
  assert.equal(ifNoneMatchMatches(undefined, etag), false);
  assert.equal(ifNoneMatchMatches('', etag), false);
  assert.equal(ifNoneMatchMatches('   ', etag), false);
  assert.equal(ifNoneMatchMatches(etag, etag), true);
  assert.equal(ifNoneMatchMatches(`W/${etag}`, etag), true);
  assert.equal(ifNoneMatchMatches(`"missing", ${etag}`, etag), true);
  assert.equal(ifNoneMatchMatches('*', etag), true);
  assert.equal(ifNoneMatchMatches('"different"', etag), false);
});

test('entity tags ignore key order and change when the value changes', () => {
  assert.equal(entityTag({ b: 1, a: 2 }), entityTag({ a: 2, b: 1 }));
  assert.notEqual(entityTag({ a: 1 }), entityTag({ a: 2 }));
  assert.match(entityTag({ a: 1 }), /^"[0-9a-f]{64}"$/);
});
