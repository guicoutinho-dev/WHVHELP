const { parseAustralianAddress } = require("./employer");
const { isPostcodeInZone } = require("./regional88");
const { normalizePostcode } = require("./normalize");

const STAY_TYPES = Object.freeze([
  "Working Hostel",
  "Backpacker Hostel",
  "Caravan & Cabin Park",
  "Farm Stay"
]);

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

function classifyStayType(raw) {
  const combined = [
    raw?.title,
    raw?.name,
    raw?.category,
    Array.isArray(raw?.categories) ? raw.categories.join(" ") : ""
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (combined.includes("working hostel") || combined.includes("harvest lodge") || combined.includes("harvest working")) {
    return "Working Hostel";
  }
  if (combined.includes("farmstay") || combined.includes("farm stay")) {
    return "Farm Stay";
  }
  if (combined.includes("caravan") || combined.includes("cabin") || combined.includes("rv park") || combined.includes("holiday park") || combined.includes("tourist park")) {
    return "Caravan & Cabin Park";
  }
  return "Backpacker Hostel";
}

function normalizeRawAccommodation(raw, postcodesConfig) {
  const externalId = cleanString(String(raw?.externalId ?? "")) || "0";
  const name = cleanString(raw?.title || raw?.name) || "";
  const address = cleanString(raw?.address);
  const parsedLoc = parseAustralianAddress(address || "");
  const location = {
    city: cleanString(raw?.city) || parsedLoc.city,
    state: cleanString(raw?.state) || parsedLoc.state,
    postcode: normalizePostcode(raw?.postcode) || parsedLoc.postcode
  };

  const stayType = classifyStayType(raw);
  const regionalRanges = postcodesConfig?.zones?.regionalAustralia || [];
  const inRegionalZone = Boolean(
    location.postcode && isPostcodeInZone(location.postcode, regionalRanges)
  );

  const ratingNum =
    typeof raw?.rating === "number" && Number.isFinite(raw.rating) && raw.rating > 0
      ? Number(raw.rating.toFixed(1))
      : null;
  const reviewCountNum =
    typeof raw?.reviewCount === "number" && Number.isFinite(raw.reviewCount) && raw.reviewCount >= 0
      ? Math.round(raw.reviewCount)
      : null;

  return {
    id: `stay:${externalId}`,
    name,
    stayType,
    address,
    location,
    phone: cleanString(raw?.phone),
    website: safeHttpUrl(raw?.website),
    googleMapsUrl:
      safeHttpUrl(raw?.googleMapsUrl) ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address].filter(Boolean).join(" "))}`,
    rating: ratingNum,
    reviewCount: reviewCountNum,
    inRegionalZone
  };
}

function normKeyToken(value) {
  if (typeof value !== "string") return "";
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function stayScore(stay) {
  let score = 0;
  if (stay?.website) score += 3;
  if (stay?.phone) score += 2;
  if (stay?.location?.postcode) score += 2;
  if (stay?.rating !== null && stay?.rating !== undefined) score += 1;
  return score;
}

function dedupeAccommodations(stays) {
  const byKey = new Map();
  for (const stay of stays || []) {
    const key = `${normKeyToken(stay?.name)}|${stay?.location?.postcode || normKeyToken(stay?.location?.city)}`;
    const existing = byKey.get(key);
    if (!existing || stayScore(stay) > stayScore(existing)) {
      byKey.set(key, stay);
    }
  }
  return Array.from(byKey.values());
}

function validateAccommodation(stay) {
  const reasons = [];
  if (!stay || typeof stay !== "object") {
    return { valid: false, reasons: ["invalid_object"] };
  }
  if (typeof stay.name !== "string" || !stay.name.trim()) {
    reasons.push("missing_name");
  }
  if (!stay.location?.city && !stay.location?.postcode && !stay.address) {
    reasons.push("missing_location");
  }
  return { valid: reasons.length === 0, reasons };
}

module.exports = {
  STAY_TYPES,
  classifyStayType,
  normalizeRawAccommodation,
  dedupeAccommodations,
  validateAccommodation
};
