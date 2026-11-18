function isPostcodeInZone(postcode, ranges) {
  if (typeof postcode !== "string" || !/^\d{4}$/.test(postcode)) return false;
  if (!Array.isArray(ranges)) return false;
  for (const [start, end] of ranges) {
    if (postcode >= start && postcode <= end) {
      return true;
    }
  }
  return false;
}

function resolveEffectivePostcode(location, postcodesConfig) {
  const direct = location?.postcode;
  if (typeof direct === "string" && /^\d{4}$/.test(direct)) {
    return direct;
  }
  const rawCity = typeof location?.city === "string" ? location.city.trim() : "";
  const state = typeof location?.state === "string" ? location.state.trim().toUpperCase() : "";
  if (rawCity && state && postcodesConfig?.knownTownPostcodes) {
    const cleanCity = rawCity
      .toLowerCase()
      .replace(/\s+(area|region|shire|city|council)$/i, "")
      .trim();
    const mapped =
      postcodesConfig.knownTownPostcodes[`${cleanCity}|${state}`] ||
      postcodesConfig.knownTownPostcodes[`${rawCity.toLowerCase()}|${state}`];
    if (mapped) return mapped;
  }
  if (rawCity && state === "NT") return "0800";
  if (rawCity && state === "SA") return "5000";
  if (rawCity && state === "TAS") return "7000";
  return null;
}

function evaluateForSubclass(category, postcode, subclassRules, zones) {
  const zoneKey = subclassRules?.[category] || "none";
  if (zoneKey === "none") return "unlikely";
  if (typeof postcode !== "string" || !/^\d{4}$/.test(postcode)) return "unknown";
  const ranges = zones?.[zoneKey];
  if (!ranges) return "unknown";
  return isPostcodeInZone(postcode, ranges) ? "likely" : "unlikely";
}

function assessRegionalWork(job, rulesConfig, postcodesConfig) {
  const category = job?.category || "Other";
  const postcode = resolveEffectivePostcode(job?.location, postcodesConfig);
  const zones = postcodesConfig?.zones || {};
  const subclasses = rulesConfig?.subclasses || {};

  return {
    "417": evaluateForSubclass(category, postcode, subclasses["417"], zones),
    "462": evaluateForSubclass(category, postcode, subclasses["462"], zones)
  };
}

module.exports = {
  assessRegionalWork,
  isPostcodeInZone,
  resolveEffectivePostcode
};
