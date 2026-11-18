const { CATEGORY_MATCH_ORDER } = require("./categories");

function matchText(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  const lower = text.toLowerCase();
  for (const { category, keywords } of CATEGORY_MATCH_ORDER) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return category;
      }
    }
  }
  return null;
}

function classifyJob(job) {
  if (!job || typeof job !== "object") return "Other";
  const fromTitle = matchText(job.title);
  if (fromTitle) return fromTitle;
  const fromSummary = matchText(job.summary);
  if (fromSummary) return fromSummary;
  return "Other";
}

module.exports = {
  classifyJob
};
