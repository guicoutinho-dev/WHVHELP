const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const gmapsFixture = require("./fixtures/gmaps-employers-sample.json");
const rulesConfig = require("../config/regional88-rules.json");
const postcodesConfig = require("../config/postcodes-88.json");
const { createGmapsEmployersSource, mapGmapsPlaceToRawEmployer } = require("../src/sources/gmaps-employers");
const { runEmployersPipeline } = require("../src/pipeline");
const { runCli } = require("../src/cli");

test("mapGmapsPlaceToRawEmployer converte item do google-maps-scraper sem aplicar regra de domínio", () => {
  const raw = mapGmapsPlaceToRawEmployer(gmapsFixture[0], 0);
  assert.equal(raw.externalId, "gm-sunraysia-citrus");
  assert.equal(raw.title, "Sunraysia Citrus & Table Grape Co-op");
  assert.equal(raw.website, "https://sunraysiacitrus.example.au");
  assert.equal(raw.rating, 4.6);
});

test("runEmployersPipeline normaliza, classifica, calcula 88 dias e deduplica empregadores", async () => {
  const source = createGmapsEmployersSource({
    runScraper: async () => gmapsFixture
  });

  const payload = await runEmployersPipeline({
    sources: [source],
    now: "2026-11-17T12:00:00.000Z",
    rulesConfig,
    postcodesConfig
  });

  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.employers.length, gmapsFixture.length);
  const mildura = payload.employers.find(e => e.location.postcode === "3500");
  assert.equal(mildura.category, "Fruit Picking");
  assert.deepEqual(mildura.regionalWork, { "417": "likely", "462": "likely" });

  const cairnsHosp = payload.employers.find(e => e.location.postcode === "4870");
  assert.equal(cairnsHosp.category, "Hospitality");
  assert.deepEqual(cairnsHosp.regionalWork, { "417": "likely", "462": "likely" });
});

test("runCli --employers --seed grava data/employers.json atomicamente", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "helpwhv-emp-"));
  const outPath = path.join(tmpDir, "data", "employers.json");

  const res = await runCli({
    argv: ["--employers", "--seed"],
    cwd: tmpDir,
    now: "2026-11-17T12:00:00.000Z"
  });

  assert.equal(res.wrote, true);
  assert.ok(fs.existsSync(outPath));
  const saved = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.equal(saved.schemaVersion, 1);
  assert.equal(saved.employers.length, gmapsFixture.length);
});
