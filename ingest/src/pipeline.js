const { normalizeRawJob } = require("./domain/normalize");
const { classifyJob } = require("./domain/classify");
const { assessRegionalWork } = require("./domain/regional88");
const { dedupeJobs } = require("./domain/dedupe");
const { validateJob, isExpired } = require("./domain/job");
const {
  normalizeRawEmployer,
  dedupeEmployers,
  validateEmployer
} = require("./domain/employer");

function shouldAbortRegression(previousCount, nextCount) {
  if (typeof previousCount !== "number" || previousCount < 10) return false;
  return nextCount < previousCount * 0.5;
}

async function runPipeline({
  sources = [],
  now,
  previous = { jobs: [] },
  rulesConfig,
  postcodesConfig
}) {
  const sourceReports = [];
  const processedBeforeDedupe = [];

  for (const source of sources) {
    if (source.skipped) {
      sourceReports.push({
        id: source.id,
        ok: false,
        skipped: true,
        fetched: 0,
        kept: 0,
        error: source.error || "missing credentials"
      });
      continue;
    }

    try {
      const rawItems = await source.fetchJobs();
      const fetchedCount = Array.isArray(rawItems) ? rawItems.length : 0;
      let keptForSource = 0;

      for (const raw of rawItems || []) {
        const normalized = normalizeRawJob(raw, now);
        const category = classifyJob(normalized);
        const withCategory = { ...normalized, category };
        const regionalWork = assessRegionalWork(withCategory, rulesConfig, postcodesConfig);
        const fullJob = { ...withCategory, regionalWork };

        if (validateJob(fullJob).valid && !isExpired(fullJob, now, 30)) {
          processedBeforeDedupe.push(fullJob);
          keptForSource += 1;
        }
      }

      sourceReports.push({
        id: source.id,
        ok: true,
        fetched: fetchedCount,
        kept: keptForSource,
        error: null
      });
    } catch (err) {
      sourceReports.push({
        id: source.id,
        ok: false,
        fetched: 0,
        kept: 0,
        error: err && err.message ? err.message : String(err)
      });
    }
  }

  const previousJobs = Array.isArray(previous?.jobs) ? previous.jobs : [];
  const jobs = dedupeJobs(processedBeforeDedupe, previousJobs);

  return {
    schemaVersion: 1,
    generatedAt: now,
    sources: sourceReports,
    jobs
  };
}

async function runEmployersPipeline({
  sources = [],
  now,
  rulesConfig,
  postcodesConfig
}) {
  const sourceReports = [];
  const collected = [];

  for (const source of sources) {
    try {
      const rawItems = await source.fetchEmployers();
      const fetchedCount = Array.isArray(rawItems) ? rawItems.length : 0;
      let keptCount = 0;

      for (const raw of rawItems || []) {
        const employer = normalizeRawEmployer(raw, rulesConfig, postcodesConfig);
        if (validateEmployer(employer).valid) {
          collected.push(employer);
          keptCount += 1;
        }
      }

      sourceReports.push({
        id: source.id,
        ok: true,
        fetched: fetchedCount,
        kept: keptCount,
        error: null
      });
    } catch (err) {
      sourceReports.push({
        id: source.id,
        ok: false,
        fetched: 0,
        kept: 0,
        error: err && err.message ? err.message : String(err)
      });
    }
  }

  const employers = dedupeEmployers(collected);

  return {
    schemaVersion: 1,
    generatedAt: now,
    sources: sourceReports,
    employers
  };
}

module.exports = {
  runPipeline,
  runEmployersPipeline,
  shouldAbortRegression
};
