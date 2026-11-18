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
  const postcode = job?.location?.postcode ?? null;
  const zones = postcodesConfig?.zones || {};
  const subclasses = rulesConfig?.subclasses || {};

  return {
    "417": evaluateForSubclass(category, postcode, subclasses["417"], zones),
    "462": evaluateForSubclass(category, postcode, subclasses["462"], zones)
  };
}

module.exports = {
  assessRegionalWork,
  isPostcodeInZone
};
