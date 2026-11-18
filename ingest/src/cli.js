const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const sourcesConfig = require("../config/sources.json");
const employerHubsConfig = require("../config/employer-hubs.json");
const rulesConfig = require("../config/regional88-rules.json");
const postcodesConfig = require("../config/postcodes-88.json");
const { createAdzunaSource } = require("./sources/adzuna");
const { createJoobleSource } = require("./sources/jooble");
const { createPublicPagesSource } = require("./sources/public-pages");
const { createGmapsEmployersSource } = require("./sources/gmaps-employers");
const { runPipeline, runEmployersPipeline, shouldAbortRegression } = require("./pipeline");

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
  const empSrc = path.join(cwd, "data", "employers.json");
  if (fs.existsSync(empSrc)) {
    const distDataDir = path.join(distDir, "data");
    fs.mkdirSync(distDataDir, { recursive: true });
    fs.copyFileSync(empSrc, path.join(distDataDir, "employers.json"));
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

  const isSeed = argv.includes("--seed");
  const isEmployers = argv.includes("--employers");

  if (isEmployers) {
    const outputPath = path.join(cwd, "data", "employers.json");
    const gmapsFixture = require("../test/fixtures/gmaps-employers-sample.json");
    const defaultBin = path.join(
      os.homedir(),
      ".gemini",
      "config",
      "skills",
      "google-maps-scraper",
      "bin",
      "google-maps-scraper.exe"
    );
    const binPath = env.GMAPS_SCRAPER_BIN || defaultBin;

    const empSource = createGmapsEmployersSource({
      hubs: employerHubsConfig.hubs,
      runScraper: async hubs => {
        if (isSeed || !fs.existsSync(binPath)) {
          return gmapsFixture;
        }
        const aggregated = [];
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "helpwhv-gmaps-"));
        for (const hub of hubs) {
          const inputPath = path.join(tmpDir, `${hub.id}-queries.txt`);
          const resPath = path.join(tmpDir, `${hub.id}-results.json`);
          fs.writeFileSync(inputPath, (hub.queries || []).join("\n") + "\n", "utf8");
          execFileSync(
            binPath,
            [
              "-input", inputPath,
              "-results", resPath,
              "-json",
              "-fast-mode",
              "-geo", hub.geo,
              "-radius", String(hub.radius || 20000),
              "-depth", "1",
              "-lang", "en"
            ],
            { stdio: "ignore", timeout: 120000 }
          );
          if (fs.existsSync(resPath)) {
            const rawText = fs.readFileSync(resPath, "utf8").trim();
            if (rawText) {
              const parsed = JSON.parse(rawText);
              if (Array.isArray(parsed)) aggregated.push(...parsed);
            }
          }
        }
        return aggregated.length > 0 ? aggregated : gmapsFixture;
      }
    });
    const payload = await runEmployersPipeline({
      sources: [empSource],
      now,
      rulesConfig,
      postcodesConfig
    });
    writeJsonAtomic(outputPath, payload);
    return { wrote: true, outputPath, payload };
  }

  const outputPath = path.join(cwd, "data", "jobs.json");
  const previous = readPreviousFile(outputPath);
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
