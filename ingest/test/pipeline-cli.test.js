const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const rulesConfig = require("../config/regional88-rules.json");
const postcodesConfig = require("../config/postcodes-88.json");
const { runPipeline, shouldAbortRegression } = require("../src/pipeline");
const { runCli } = require("../src/cli");

test("runPipeline isola falha de uma fonte, classifica nas 11 categorias e calcula regionalWork", async () => {
  const failingSource = {
    id: "jooble",
    name: "Jooble",
    async fetchJobs() {
      throw new Error("Jooble HTTP 503");
    }
  };
  const healthySource = {
    id: "adzuna",
    name: "Adzuna",
    async fetchJobs() {
      return [
        {
          externalId: "501",
          sourceId: "adzuna",
          sourceName: "Adzuna",
          url: "https://example.com/501",
          title: "Strawberry Fruit Picker",
          employer: "Sunny Berries",
          city: "Mildura",
          state: "VIC",
          postcode: "3500",
          payMin: 30,
          payMax: 34,
          payPeriod: "hour",
          employmentType: "seasonal",
          postedAt: "2026-11-16T00:00:00Z",
          description: "Pick strawberries in regional Victoria."
        },
        {
          externalId: "502",
          sourceId: "adzuna",
          sourceName: "Adzuna",
          url: "",
          title: "Invalid URL Job"
        }
      ];
    }
  };

  const result = await runPipeline({
    sources: [failingSource, healthySource],
    now: "2026-11-17T12:00:00.000Z",
    previous: { jobs: [] },
    rulesConfig,
    postcodesConfig
  });

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.sources.length, 2);
  assert.deepEqual(result.sources[0], {
    id: "jooble",
    ok: false,
    fetched: 0,
    kept: 0,
    error: "Jooble HTTP 503"
  });
  assert.equal(result.sources[1].ok, true);
  assert.equal(result.sources[1].fetched, 2);
  assert.equal(result.sources[1].kept, 1);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].category, "Fruit Picking");
  assert.deepEqual(result.jobs[0].regionalWork, { "417": "likely", "462": "likely" });
});

test("shouldAbortRegression dispara quando previous >= 10 e novo cai mais de 50%", () => {
  assert.equal(shouldAbortRegression(20, 9), true);
  assert.equal(shouldAbortRegression(20, 10), false);
  assert.equal(shouldAbortRegression(6, 2), false);
});

test("runCli --seed gera data/jobs.json e guarda de regressão impede sobrescrever quando queda > 50%", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "helpwhv-cli-"));
  const outPath = path.join(tmpDir, "data", "jobs.json");

  const seeded = await runCli({
    argv: ["--seed"],
    env: {},
    cwd: tmpDir,
    now: "2026-11-17T12:00:00.000Z"
  });

  assert.equal(seeded.wrote, true);
  assert.ok(fs.existsSync(outPath));
  const saved = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.equal(saved.schemaVersion, 1);
  assert.ok(saved.jobs.length >= 11);

  await assert.rejects(
    async () => {
      await runCli({
        argv: [],
        env: {},
        cwd: tmpDir,
        now: "2026-11-17T18:00:00.000Z"
      });
    },
    /Regression guard triggered/
  );

  const afterFailedRun = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.equal(afterFailedRun.jobs.length, saved.jobs.length);
});
