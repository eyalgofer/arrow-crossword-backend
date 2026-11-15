import { createHash } from 'crypto';
import { Request, Response } from 'express';

/**
 * Apps already in production never send If-None-Match. Those requests always
 * get 200 and a JSON body. A matching validator is answered with 304 and an
 * empty body, and the response payload is not built.
 */
export function sendCachedJson(
  req: Request,
  res: Response,
  etagSource: unknown,
  buildBody: () => unknown
): void {
  const etag = entityTag(etagSource);
  if (ifNoneMatchMatches(req.headers['if-none-match'], etag)) {
    sendNotModified(res, etag);
    return;
  }
  setPrivateEtag(res, etag);
  res.json(buildBody());
}

export function setPrivateEtag(res: Response, etag: string): void {
  res.set('ETag', etag);
  res.set('Cache-Control', 'private');
}

export function sendNotModified(res: Response, etag: string): void {
  setPrivateEtag(res, etag);
  res.status(304);
  res.removeHeader('Content-Type');
  res.removeHeader('Content-Length');
  res.end();
}

/** Strong validator. Key order does not change the tag. */
export function entityTag(value: unknown): string {
  const digest = createHash('sha256').update(stableStringify(value)).digest('hex');
  return `"${digest}"`;
}

/**
 * If-None-Match uses weak comparison: W/"abc" matches "abc", and * matches
 * any current representation. A missing header never matches.
 */
export function ifNoneMatchMatches(
  header: string | string[] | undefined,
  etag: string
): boolean {
  if (header == null) return false;
  const raw = Array.isArray(header) ? header.join(',') : header;
  if (!raw.trim()) return false;
  const expected = unwrapEtag(etag);
  for (const part of raw.split(',')) {
    const tag = part.trim();
    if (!tag) continue;
    if (tag === '*') return true;
    if (unwrapEtag(tag) === expected) return true;
  }
  return false;
}

function unwrapEtag(tag: string): string {
  const withoutWeak = tag.replace(/^W\//i, '');
  if (withoutWeak.length >= 2 && withoutWeak.startsWith('"') && withoutWeak.endsWith('"')) {
    return withoutWeak.slice(1, -1);
  }
  return withoutWeak;
}

function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter(key => obj[key] !== undefined).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
}
