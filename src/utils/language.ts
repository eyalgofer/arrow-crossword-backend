/**
 * Resolves which content language a request should be served.
 *
 * Israeli users get Hebrew content. Resolution order:
 *  1. Explicit override:   ?lang=he  or  X-App-Language: he
 *  2. Israeli country:     X-App-Country / X-App-Region / CDN geo header is IL
 *  3. Device language:     Accept-Language contains Hebrew ('he', or legacy 'iw')
 *  4. Default: English
 */

import { Request } from 'express';
import { Language, DEFAULT_LANGUAGE } from '../types';

const HEBREW_CODES = new Set(['he', 'iw', 'he-il', 'iw-il']);

const COUNTRY_HEADERS = [
  'x-app-country',
  'x-app-region',
  'cloudfront-viewer-country',
  'cf-ipcountry',
  'x-vercel-ip-country',
  'x-appengine-country',
  'x-country-code',
];

function normalizeCode(value: string | undefined): Language | null {
  if (!value) return null;
  const code = value.trim().toLowerCase();
  if (HEBREW_CODES.has(code)) return 'he';
  if (code === 'en' || code.startsWith('en-')) return 'en';
  return null;
}

export function resolveLanguage(req: Request): Language {
  // 1. Explicit override (query param, then dedicated header)
  const fromQuery = normalizeCode(
    typeof req.query?.lang === 'string' ? req.query.lang : undefined
  );
  if (fromQuery) return fromQuery;

  const fromHeader = normalizeCode(req.headers['x-app-language'] as string | undefined);
  if (fromHeader) return fromHeader;

  // 2. Israeli users (app-reported country, then CDN / load-balancer geo)
  for (const header of COUNTRY_HEADERS) {
    const country = req.headers[header];
    if (typeof country === 'string' && country.trim().toUpperCase() === 'IL') {
      return 'he';
    }
  }

  // 3. Device language (Hebrew speakers outside Israel)
  const acceptLanguage = req.headers['accept-language'];
  if (typeof acceptLanguage === 'string' && /(^|[,\s])(he|iw)(-[a-z]{2})?\s*(;|,|$)/i.test(acceptLanguage)) {
    return 'he';
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Mongo filter value for the `language` field.
 * Documents created before localization have no `language` field and are
 * English, so the English filter also matches missing values.
 */
export function languageFilter(language: Language): Language | { $in: (Language | null)[] } {
  return language === 'en' ? { $in: ['en', null] } : language;
}
