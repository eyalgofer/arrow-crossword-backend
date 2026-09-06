import { config } from "./config.js";
import { CommonsCandidate, ImageClueSeed } from "./types.js";
import { stripHtml } from "./utils.js";

const API = "https://commons.wikimedia.org/w/api.php";

type ExtValue = { value?: string };
type ImageInfo = {
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  width?: number;
  height?: number;
  mime?: string;
  extmetadata?: Record<string, ExtValue>;
};

function meta(info: ImageInfo, key: string): string {
  return stripHtml(info.extmetadata?.[key]?.value);
}

// Conservative allow-list for a commercial app.
// Always keep the original metadata; legal/licensing review remains your responsibility.
function licenseDecision(license: string, licenseUrl: string) {
  const normalized = `${license} ${licenseUrl}`.toLowerCase();

  const blockedMarkers = [
    "noncommercial",
    "non-commercial",
    "nc ",
    "no derivatives",
    "nd ",
    "all rights reserved",
    "fair use"
  ];

  if (blockedMarkers.some((x) => normalized.includes(x))) {
    return { allowed: false, reason: "License appears incompatible with commercial reuse" };
  }

  const allowedMarkers = [
    "public domain",
    "cc0",
    "cc by",
    "cc-by",
    "cc by-sa",
    "cc-by-sa"
  ];

  if (allowedMarkers.some((x) => normalized.includes(x))) {
    return { allowed: true };
  }

  return { allowed: false, reason: "License not recognized by conservative allow-list" };
}

function buildQueries(clue: ImageClueSeed): string[] {
  const subject = clue.subject;
  const country = clue.country?.trim();

  if (clue.type === "person") {
    return [
      subject,
      country ? `${subject} ${country}` : subject,
      `${subject} portrait`
    ];
  }

  if (clue.type === "place") {
    return [subject, `${subject} landmark`];
  }

  if (clue.type === "brand") {
    // Logo/image rights can be different from ordinary copyright.
    // Keep these candidates for manual review rather than auto-approving.
    return [subject, `${subject} logo`];
  }

  return [subject];
}

async function api(params: Record<string, string>) {
  const qs = new URLSearchParams({
    format: "json",
    origin: "*",
    ...params,
  });

  const res = await fetch(`${API}?${qs}`, {
    headers: { "User-Agent": config.userAgent },
  });

  if (!res.ok) {
    throw new Error(`Commons API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<any>;
}

async function searchFiles(query: string, limit: number) {
  const json = await api({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "720",
    iiextmetadatafilter:
      "Artist|Credit|LicenseShortName|LicenseUrl|UsageTerms|ImageDescription|AttributionRequired",
  });

  return Object.values(json?.query?.pages ?? {}) as any[];
}

export async function discoverCommonsCandidates(
  clue: ImageClueSeed,
  desiredCount: number
): Promise<CommonsCandidate[]> {
  const seen = new Set<string>();
  const out: CommonsCandidate[] = [];

  for (const query of buildQueries(clue)) {
    if (out.length >= desiredCount) break;

    const pages = await searchFiles(query, Math.max(10, desiredCount * 2));

    for (const page of pages) {
      if (out.length >= desiredCount) break;

      const info: ImageInfo | undefined = page?.imageinfo?.[0];
      if (!info?.url || !info?.thumburl) continue;
      if (seen.has(page.title)) continue;
      seen.add(page.title);

      const license = meta(info, "LicenseShortName") || meta(info, "UsageTerms");
      const licenseUrl = meta(info, "LicenseUrl");
      const decision = licenseDecision(license, licenseUrl);

      const brandManualReview = clue.type === "brand";
      const isRasterOrSvg = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(
        info.mime ?? ""
      );

      out.push({
        id: `${clue.id}:${page.pageid}`,
        clueId: clue.id,
        title: page.title,
        pageId: page.pageid,
        descriptionUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        originalUrl: info.url,
        thumbUrl: info.thumburl,
        width: info.width,
        height: info.height,
        mime: info.mime,
        author: meta(info, "Artist"),
        license,
        licenseUrl,
        credit: meta(info, "Credit"),
        description: meta(info, "ImageDescription"),
        attributionRequired:
          meta(info, "AttributionRequired").toLowerCase() !== "false",
        allowed: decision.allowed && isRasterOrSvg && !brandManualReview,
        rejectReason:
          !isRasterOrSvg
            ? `Unsupported MIME: ${info.mime ?? "unknown"}`
            : brandManualReview
              ? "Brand/logo candidate requires manual rights review"
              : decision.reason,
        searchQuery: query,
      });
    }
  }

  return out;
}
