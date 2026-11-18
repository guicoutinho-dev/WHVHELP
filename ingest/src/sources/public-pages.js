const DEFAULT_FORBIDDEN_HOSTS = Object.freeze([
  "facebook.com",
  "gumtree.com.au",
  "seek.com.au",
  "indeed.com",
  "linkedin.com"
]);

function assertAllowedPage(entry, forbiddenHosts = DEFAULT_FORBIDDEN_HOSTS) {
  if (!entry || typeof entry.url !== "string") {
    throw new Error("Invalid allowlist entry URL");
  }
  const parsed = new URL(entry.url);
  const host = parsed.hostname.toLowerCase();
  for (const forbidden of forbiddenHosts) {
    if (host === forbidden || host.endsWith(`.${forbidden}`)) {
      throw new Error(`Forbidden source host: ${host}`);
    }
  }
  if (entry.robotsAllowed !== true || !entry.termsCheckedAt) {
    throw new Error(`robotsAllowed and termsCheckedAt required for ${entry.url}`);
  }
}

function mapPublicPageItemToRawJob(item, boardEntry) {
  return {
    externalId: String(item.id ?? ""),
    sourceId: boardEntry.id || "public-pages",
    sourceName: boardEntry.name || "Public Job Board",
    url: item.url || boardEntry.url,
    title: item.title || "",
    employer: item.employer || null,
    city: item.city || null,
    state: item.state || null,
    postcode: item.postcode ?? null,
    payMin: typeof item.payMin === "number" ? item.payMin : null,
    payMax: typeof item.payMax === "number" ? item.payMax : null,
    payPeriod: item.payPeriod || null,
    employmentType: item.employmentType || null,
    postedAt: item.postedAt || null,
    description: item.description || ""
  };
}

function createPublicPagesSource({
  apiKey,
  fetchImpl = globalThis.fetch,
  allowlist = [],
  forbiddenHosts = DEFAULT_FORBIDDEN_HOSTS
}) {
  return {
    id: "public-pages",
    name: "Public Job Boards",
    async fetchJobs() {
      const collected = [];
      for (const entry of allowlist) {
        assertAllowedPage(entry, forbiddenHosts);
        const response = await fetchImpl("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            url: entry.url,
            formats: ["json"]
          })
        });
        if (!response.ok) {
          throw new Error(`Firecrawl HTTP ${response.status} for ${entry.id}`);
        }
        const payload = await response.json();
        const openings = payload?.data?.json?.openings || payload?.openings || [];
        for (const item of openings) {
          collected.push(mapPublicPageItemToRawJob(item, entry));
        }
      }
      return collected;
    }
  };
}

module.exports = {
  createPublicPagesSource,
  mapPublicPageItemToRawJob,
  assertAllowedPage
};
