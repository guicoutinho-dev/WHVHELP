const { EMPLOYMENT_TYPES, PAY_PERIODS } = require("./categories");

function cleanText(value) {
  if (typeof value !== "string") return null;
  const collapsed = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return collapsed || null;
}

function normalizePostcode(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return /^\d{4}$/.test(str) ? str : null;
}

function normalizeEmploymentType(rawType) {
  if (typeof rawType !== "string") return null;
  const lower = rawType.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (EMPLOYMENT_TYPES.includes(lower)) return lower;
  if (lower.includes("casual")) return "casual";
  if (lower.includes("part")) return "part_time";
  if (lower.includes("full") || lower.includes("permanent")) return "full_time";
  if (lower.includes("season") || lower.includes("harvest")) return "seasonal";
  if (lower.includes("contract") || lower.includes("temp")) return "contract";
  return null;
}

function normalizePay(raw) {
  const minNum = typeof raw.payMin === "number" && Number.isFinite(raw.payMin) && raw.payMin > 0 ? raw.payMin : null;
  const maxNum = typeof raw.payMax === "number" && Number.isFinite(raw.payMax) && raw.payMax > 0 ? raw.payMax : null;
  if (minNum === null && maxNum === null) return null;

  const baseValue = minNum ?? maxNum;
  let period = typeof raw.payPeriod === "string" ? raw.payPeriod.trim().toLowerCase() : null;
  if (!PAY_PERIODS.includes(period)) {
    if (baseValue >= 10000) {
      period = "year";
    } else if (baseValue >= 15 && baseValue <= 200) {
      period = "hour";
    } else {
      return null;
    }
  }

  return {
    min: minNum,
    max: maxNum,
    period,
    currency: (typeof raw.currency === "string" && raw.currency.trim().toUpperCase()) || "AUD"
  };
}

function normalizeIsoDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function normalizeRawJob(raw, nowIso) {
  const sourceId = cleanText(raw.sourceId) || "unknown";
  const externalId = cleanText(String(raw.externalId ?? "")) || "0";
  const title = cleanText(raw.title) || "";
  const description = cleanText(raw.description) || "";
  const summary = description.length > 300 ? description.slice(0, 300) : description;

  return {
    id: `${sourceId}:${externalId}`,
    title,
    category: "Other",
    employmentType: normalizeEmploymentType(raw.employmentType),
    employer: cleanText(raw.employer),
    location: {
      city: cleanText(raw.city),
      state: cleanText(raw.state),
      postcode: normalizePostcode(raw.postcode)
    },
    pay: normalizePay(raw),
    postedAt: normalizeIsoDate(raw.postedAt),
    firstSeenAt: normalizeIsoDate(raw.firstSeenAt) || nowIso,
    regionalWork: {
      "417": "unknown",
      "462": "unknown"
    },
    summary,
    source: {
      id: sourceId,
      name: cleanText(raw.sourceName) || sourceId,
      url: cleanText(raw.url) || ""
    }
  };
}

module.exports = {
  normalizeRawJob,
  normalizePay,
  normalizePostcode,
  normalizeEmploymentType
};
