function normToken(value) {
  if (typeof value !== "string") return "";
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function makeDedupeKey(job) {
  const title = normToken(job?.title);
  const employer = normToken(job?.employer);
  const city = normToken(job?.location?.city);
  return `${title}|${employer}|${city}`;
}

function completenessScore(job) {
  let score = 0;
  if (job?.pay && (job.pay.min !== null || job.pay.max !== null)) score += 3;
  if (job?.location?.postcode) score += 2;
  if (job?.employer) score += 1;
  if (job?.postedAt) score += 1;
  if (job?.summary && job.summary.length > 20) score += 1;
  return score;
}

function dedupeJobs(jobs, previousJobs = []) {
  const prevFirstSeenById = new Map();
  const prevFirstSeenByKey = new Map();

  for (const prev of previousJobs) {
    if (!prev || !prev.firstSeenAt) continue;
    if (prev.id) prevFirstSeenById.set(prev.id, prev.firstSeenAt);
    prevFirstSeenByKey.set(makeDedupeKey(prev), prev.firstSeenAt);
  }

  const byKey = new Map();

  for (const job of jobs) {
    const key = makeDedupeKey(job);
    const preservedFirstSeen =
      prevFirstSeenById.get(job.id) ||
      prevFirstSeenByKey.get(key) ||
      job.firstSeenAt;

    const candidate = { ...job, firstSeenAt: preservedFirstSeen };
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, candidate);
      continue;
    }

    const earliestFirstSeen =
      existing.firstSeenAt && candidate.firstSeenAt
        ? (Date.parse(existing.firstSeenAt) <= Date.parse(candidate.firstSeenAt)
            ? existing.firstSeenAt
            : candidate.firstSeenAt)
        : (existing.firstSeenAt || candidate.firstSeenAt);

    const winner = completenessScore(candidate) > completenessScore(existing) ? candidate : existing;
    byKey.set(key, { ...winner, firstSeenAt: earliestFirstSeen });
  }

  return Array.from(byKey.values());
}

module.exports = {
  dedupeJobs,
  makeDedupeKey,
  completenessScore
};
