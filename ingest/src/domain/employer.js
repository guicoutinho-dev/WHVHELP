const { classifyJob } = require("./classify");
const { assessRegionalWork } = require("./regional88");
const { normalizePostcode } = require("./normalize");

const AU_STATES = new Set(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "NT", "ACT"]);

function cleanString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed || null;
}

function safeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function parseAustralianAddress(address) {
  if (typeof address !== "string" || !address.trim()) {
    return { city: null, state: null, postcode: null };
  }
  const match = address.match(/(?:,\s*|^)([^,]+?)\s+(NSW|VIC|QLD|WA|SA|TAS|NT|ACT)\s+(\d{4})\b/i);
  if (!match) {
    return { city: null, state: null, postcode: null };
  }
  const city = cleanString(match[1]);
  const stateUpper = match[2].toUpperCase();
  const state = AU_STATES.has(stateUpper) ? stateUpper : null;
  const postcode = normalizePostcode(match[3]);
  return { city, state, postcode };
}

function normalizeRawEmployer(raw, rulesConfig, postcodesConfig) {
  const externalId = cleanString(String(raw?.externalId ?? "")) || "0";
  const name = cleanString(raw?.title || raw?.name) || "";
  const address = cleanString(raw?.address);
  const parsedLoc = parseAustralianAddress(address || "");
  const location = {
    city: cleanString(raw?.city) || parsedLoc.city,
    state: cleanString(raw?.state) || parsedLoc.state,
    postcode: normalizePostcode(raw?.postcode) || parsedLoc.postcode
  };

  const rawCategories = Array.isArray(raw?.categories) ? raw.categories.join(" ") : "";
  const summaryForClassifier = [raw?.category, rawCategories, raw?.description]
    .filter(Boolean)
    .join(" ");

  const category = classifyJob({ title: name, summary: summaryForClassifier });
  const regionalWork = assessRegionalWork({ category, location }, rulesConfig, postcodesConfig);

  const ratingNum =
    typeof raw?.rating === "number" && Number.isFinite(raw.rating) && raw.rating > 0
      ? Number(raw.rating.toFixed(1))
      : null;
  const reviewCountNum =
    typeof raw?.reviewCount === "number" && Number.isFinite(raw.reviewCount) && raw.reviewCount >= 0
      ? Math.round(raw.reviewCount)
      : null;

  return {
    id: `gmaps:${externalId}`,
    name,
    category,
    sourceCategory: cleanString(raw?.category),
    address,
    location,
    phone: cleanString(raw?.phone),
    website: safeHttpUrl(raw?.website),
    googleMapsUrl:
      safeHttpUrl(raw?.googleMapsUrl) ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address].filter(Boolean).join(" "))}`,
    rating: ratingNum,
    reviewCount: reviewCountNum,
    regionalWork
  };
}

function normKeyToken(value) {
  if (typeof value !== "string") return "";
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function employerCompleteness(emp) {
  let score = 0;
  if (emp?.website) score += 3;
  if (emp?.phone) score += 2;
  if (emp?.location?.postcode) score += 2;
  if (emp?.rating !== null && emp?.rating !== undefined) score += 1;
  return score;
}

function dedupeEmployers(employers) {
  const byKey = new Map();
  for (const emp of employers || []) {
    const key = `${normKeyToken(emp?.name)}|${emp?.location?.postcode || normKeyToken(emp?.location?.city)}`;
    const existing = byKey.get(key);
    if (!existing || employerCompleteness(emp) > employerCompleteness(existing)) {
      byKey.set(key, emp);
    }
  }
  return Array.from(byKey.values());
}

function validateEmployer(employer) {
  const reasons = [];
  if (!employer || typeof employer !== "object") {
    return { valid: false, reasons: ["invalid_object"] };
  }
  if (typeof employer.name !== "string" || !employer.name.trim()) {
    reasons.push("missing_name");
  }
  if (!employer.location?.city && !employer.location?.postcode && !employer.address) {
    reasons.push("missing_location");
  }
  return { valid: reasons.length === 0, reasons };
}

module.exports = {
  parseAustralianAddress,
  normalizeRawEmployer,
  dedupeEmployers,
  validateEmployer
};
