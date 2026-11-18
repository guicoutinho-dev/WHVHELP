const STATE_MAP = Object.freeze({
  "new south wales": "NSW",
  "victoria": "VIC",
  "queensland": "QLD",
  "western australia": "WA",
  "south australia": "SA",
  "tasmania": "TAS",
  "northern territory": "NT",
  "australian capital territory": "ACT"
});

function extractCityAndState(locationObj) {
  if (!locationObj || typeof locationObj !== "object") {
    return { city: null, state: null };
  }
  const area = Array.isArray(locationObj.area) ? locationObj.area : [];
  const rawState = area[1] || "";
  const state = STATE_MAP[rawState.toLowerCase()] || (rawState ? rawState.toUpperCase() : null);
  const city = area[area.length - 1] || (typeof locationObj.display_name === "string" ? locationObj.display_name.split(",")[0].trim() : null);
  return { city: city || null, state };
}

function cleanAdzunaUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return "";
  try {
    const parsed = new URL(rawUrl);
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "app_id", "app_key"]) {
      parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function mapAdzunaItemToRawJob(item) {
  const { city, state } = extractCityAndState(item.location);
  return {
    externalId: String(item.id ?? ""),
    sourceId: "adzuna",
    sourceName: "Adzuna",
    url: cleanAdzunaUrl(item.redirect_url || ""),
    title: item.title || "",
    employer: item.company?.display_name || null,
    city,
    state,
    postcode: item.location?.postcode ?? null,
    payMin: typeof item.salary_min === "number" ? item.salary_min : null,
    payMax: typeof item.salary_max === "number" ? item.salary_max : null,
    payPeriod: item.salary_period || null,
    employmentType: item.contract_time || item.contract_type || null,
    postedAt: item.created || null,
    description: item.description || ""
  };
}

function createAdzunaSource({ appId, appKey, fetchImpl = globalThis.fetch, queries = ["whv"], maxPages = 3 }) {
  return {
    id: "adzuna",
    name: "Adzuna",
    async fetchJobs() {
      const collected = [];
      for (const query of queries) {
        for (let page = 1; page <= maxPages; page++) {
          const params = new URLSearchParams({
            app_id: appId,
            app_key: appKey,
            what: query,
            results_per_page: "50"
          });
          const url = `https://api.adzuna.com/v1/api/jobs/au/search/${page}?${params.toString()}`;
          const response = await fetchImpl(url);
          if (!response.ok) {
            if (response.status === 404 || response.status === 422) break;
            throw new Error(`Adzuna HTTP ${response.status}`);
          }
          const data = await response.json();
          const results = Array.isArray(data?.results) ? data.results : [];
          if (results.length === 0) break;
          for (const item of results) {
            collected.push(mapAdzunaItemToRawJob(item));
          }
        }
      }
      return collected;
    }
  };
}

module.exports = {
  createAdzunaSource,
  mapAdzunaItemToRawJob
};
