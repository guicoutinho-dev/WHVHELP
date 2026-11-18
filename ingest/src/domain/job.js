const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateJob(job) {
  const reasons = [];
  if (!job || typeof job !== "object") {
    return { valid: false, reasons: ["invalid_object"] };
  }
  if (typeof job.id !== "string" || !job.id.trim()) {
    reasons.push("missing_id");
  }
  if (typeof job.title !== "string" || !job.title.trim()) {
    reasons.push("missing_title");
  }
  if (!job.source || !isHttpUrl(job.source.url)) {
    reasons.push("invalid_source_url");
  }
  return { valid: reasons.length === 0, reasons };
}

function isExpired(job, nowIso, maxAgeDays = 30) {
  const refDate = job?.postedAt || job?.firstSeenAt;
  if (!refDate) return false;
  const refTime = Date.parse(refDate);
  const nowTime = Date.parse(nowIso);
  if (Number.isNaN(refTime) || Number.isNaN(nowTime)) return false;
  return (nowTime - refTime) > maxAgeDays * MS_PER_DAY;
}

module.exports = {
  validateJob,
  isExpired
};
