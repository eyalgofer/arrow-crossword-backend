export async function fetchOriginal(url: string, userAgent: string): Promise<Buffer> {
  // Commons sometimes appends tracking query params; upload.wikimedia.org prefers a clean URL + Referer.
  const cleanUrl = url.split("?")[0];
  const delaysMs = [0, 4000, 10000, 20000];
  let lastError = "";
  for (const delay of delaysMs) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const response = await fetch(cleanUrl, {
      headers: {
        "User-Agent": userAgent,
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        Referer: "https://commons.wikimedia.org/",
      },
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    lastError = `Download failed ${response.status} ${cleanUrl}`;
    if (response.status !== 429 && response.status !== 503 && response.status !== 403) break;
    console.warn(`  retry after ${response.status}`);
  }
  throw new Error(lastError);
}
