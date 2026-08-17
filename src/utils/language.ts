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

export function resolveLanguageFromValues(opts: {
  lang?: string;
  appLanguage?: string;
  country?: string;
  acceptLanguage?: string;
}): Language {
  const fromQuery = normalizeCode(opts.lang);
  if (fromQuery) return fromQuery;

  const fromHeader = normalizeCode(opts.appLanguage);
  if (fromHeader) return fromHeader;

  if (opts.country?.trim().toUpperCase() === 'IL') return 'he';

  if (opts.acceptLanguage && /(^|[,\s])(he|iw)(-[a-z]{2})?\s*(;|,|$)/i.test(opts.acceptLanguage)) {
    return 'he';
  }

  return DEFAULT_LANGUAGE;
}

export function resolveLanguage(req: Request): Language {
  let country: string | undefined;
  for (const header of COUNTRY_HEADERS) {
    const value = req.headers[header];
    if (typeof value === 'string' && value.trim()) {
      country = value;
      break;
    }
  }

  return resolveLanguageFromValues({
    lang: typeof req.query?.lang === 'string' ? req.query.lang : undefined,
    appLanguage: req.headers['x-app-language'] as string | undefined,
    country,
    acceptLanguage: typeof req.headers['accept-language'] === 'string'
      ? req.headers['accept-language']
      : undefined,
  });
}

/**
 * Mongo filter value for the `language` field.
 * Documents created before localization have no `language` field and are
 * English, so the English filter also matches missing values.
 */
export function languageFilter(language: Language): Language | { $in: (Language | null)[] } {
  return language === 'en' ? { $in: ['en', null] } : language;
}
