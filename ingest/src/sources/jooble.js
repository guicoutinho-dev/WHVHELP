function parseLocationString(locStr) {
  if (typeof locStr !== "string" || !locStr.trim()) {
    return { city: null, state: null };
  }
  const parts = locStr.split(",").map(p => p.trim()).filter(Boolean);
  return {
    city: parts[0] || null,
    state: parts[1] || null
  };
}

function parseSalaryNumber(val) {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val !== "string" || !val.trim()) return null;
  const match = val.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function mapJoobleItemToRawJob(item) {
  const { city, state } = parseLocationString(item.location);
  const salaryNum = parseSalaryNumber(item.salary);
  return {
    externalId: String(item.id ?? ""),
    sourceId: "jooble",
    sourceName: "Jooble",
    url: item.link || "",
    title: item.title || "",
    employer: item.company || null,
    city,
    state,
    postcode: item.postcode ?? null,
    payMin: salaryNum,
    payMax: null,
    payPeriod: item.salaryPeriod || null,
    employmentType: item.type || null,
    postedAt: item.updated || null,
    description: item.snippet || ""
  };
}

function createJoobleSource({ apiKey, fetchImpl = globalThis.fetch, queries = ["whv"] }) {
  return {
    id: "jooble",
    name: "Jooble",
    async fetchJobs() {
      const collected = [];
      for (const keywords of queries) {
        const url = `https://au.jooble.org/api/${encodeURIComponent(apiKey)}`;
        const response = await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords, location: "Australia" })
        });
        if (!response.ok) {
          throw new Error(`Jooble HTTP ${response.status}`);
        }
        const data = await response.json();
        const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
        for (const item of jobs) {
          collected.push(mapJoobleItemToRawJob(item));
        }
      }
      return collected;
    }
  };
}

module.exports = {
  createJoobleSource,
  mapJoobleItemToRawJob
};
