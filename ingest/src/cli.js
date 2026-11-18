const fs = require("node:fs");
const path = require("node:path");
const sourcesConfig = require("../config/sources.json");
const rulesConfig = require("../config/regional88-rules.json");
const postcodesConfig = require("../config/postcodes-88.json");
const { createAdzunaSource } = require("./sources/adzuna");
const { createJoobleSource } = require("./sources/jooble");
const { createPublicPagesSource } = require("./sources/public-pages");
const { runPipeline, shouldAbortRegression } = require("./pipeline");

function buildSeedSources() {
  const adzunaFixture = require("../test/fixtures/adzuna-sample.json");
  const joobleFixture = require("../test/fixtures/jooble-sample.json");
  const publicPageFixture = require("../test/fixtures/public-page-sample.json");

  return [
    createAdzunaSource({
      appId: "seed",
      appKey: "seed",
      queries: ["seed"],
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => adzunaFixture })
    }),
    createJoobleSource({
      apiKey: "seed",
      queries: ["seed"],
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => joobleFixture })
    }),
    createPublicPagesSource({
      apiKey: "seed",
      allowlist: sourcesConfig.publicPages,
      forbiddenHosts: sourcesConfig.forbiddenHosts,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: { json: publicPageFixture } })
      })
    })
  ];
}

function buildLiveSources(env, fetchImpl) {
  const sources = [];
  if (env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY) {
    sources.push(
      createAdzunaSource({
        appId: env.ADZUNA_APP_ID,
        appKey: env.ADZUNA_APP_KEY,
        queries: sourcesConfig.queries,
        fetchImpl
      })
    );
  } else {
    sources.push({ id: "adzuna", skipped: true, error: "missing credentials" });
  }

  if (env.JOOBLE_API_KEY) {
    sources.push(
      createJoobleSource({
        apiKey: env.JOOBLE_API_KEY,
        queries: sourcesConfig.queries,
        fetchImpl
      })
    );
  } else {
    sources.push({ id: "jooble", skipped: true, error: "missing credentials" });
  }

  if (env.FIRECRAWL_API_KEY) {
    sources.push(
      createPublicPagesSource({
        apiKey: env.FIRECRAWL_API_KEY,
        allowlist: sourcesConfig.publicPages,
        forbiddenHosts: sourcesConfig.forbiddenHosts,
        fetchImpl
      })
    );
  } else {
    sources.push({ id: "public-pages", skipped: true, error: "missing credentials" });
  }

  return sources;
}

function readPreviousFile(outputPath) {
  if (!fs.existsSync(outputPath)) return { jobs: [] };
  try {
    return JSON.parse(fs.readFileSync(outputPath, "utf8"));
  } catch {
    return { jobs: [] };
  }
}

function writeJsonAtomic(outputPath, payload) {
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${outputPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  fs.renameSync(tmpPath, outputPath);
}

function syncDistDirectory(cwd) {
  const distDir = path.join(cwd, "sites", "helpwhv", "dist");
  fs.mkdirSync(distDir, { recursive: true });
  for (const file of ["index.html", "app.js", "styles.css"]) {
    const src = path.join(cwd, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(distDir, file));
    }
  }
  const jobsSrc = path.join(cwd, "data", "jobs.json");
  if (fs.existsSync(jobsSrc)) {
    const distDataDir = path.join(distDir, "data");
    fs.mkdirSync(distDataDir, { recursive: true });
    fs.copyFileSync(jobsSrc, path.join(distDataDir, "jobs.json"));
  }
  return { synced: true, distDir };
}

async function runCli({
  argv = process.argv.slice(2),
  env = process.env,
  cwd = process.cwd(),
  fetchImpl = globalThis.fetch,
  now = new Date().toISOString()
} = {}) {
  if (argv.includes("--sync-dist")) {
    return syncDistDirectory(cwd);
  }

  const outputPath = path.join(cwd, "data", "jobs.json");
  const previous = readPreviousFile(outputPath);
  const isSeed = argv.includes("--seed");
  const sources = isSeed ? buildSeedSources() : buildLiveSources(env, fetchImpl);

  const payload = await runPipeline({
    sources,
    now,
    previous,
    rulesConfig,
    postcodesConfig
  });

  const previousCount = Array.isArray(previous?.jobs) ? previous.jobs.length : 0;
  const nextCount = payload.jobs.length;

  if (shouldAbortRegression(previousCount, nextCount)) {
    throw new Error(
      `Regression guard triggered: previous had ${previousCount} jobs, new run produced ${nextCount}`
    );
  }

  writeJsonAtomic(outputPath, payload);
  return { wrote: true, outputPath, payload };
}

if (require.main === module) {
  runCli().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = {
  runCli,
  syncDistDirectory
};
