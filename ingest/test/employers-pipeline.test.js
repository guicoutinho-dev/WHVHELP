const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const gmapsFixture = require("./fixtures/gmaps-employers-sample.json");
const rulesConfig = require("../config/regional88-rules.json");
const postcodesConfig = require("../config/postcodes-88.json");
const {
  createGmapsEmployersSource,
  mapGmapsPlaceToRawEmployer,
  parseGmapsScraperOutput
} = require("../src/sources/gmaps-employers");
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

test("parseGmapsScraperOutput processa saída NDJSON real do google-maps-scraper -fast-mode e extrai data_id", () => {
  const ndjson = [
    "null",
    JSON.stringify([
      {
        data_id: "0x6ac30310c0d418e1:0xdc9ff74042f2",
        cid: "",
        title: "AgriSkills Orchard Grove Care",
        categories: ["Orchard", "Employment consultant"],
        category: "",
        address: "71B Orange Ave, Mildura VIC 3500, Australia",
        web_site: "",
        phone: "+61386927284",
        review_count: 5,
        review_rating: 4.5
      }
    ])
  ].join("\n");

  const places = parseGmapsScraperOutput(ndjson);
  assert.equal(places.length, 1);
  const mapped = mapGmapsPlaceToRawEmployer(places[0], 0);
  assert.equal(mapped.externalId, "0x6ac30310c0d418e1:0xdc9ff74042f2");
  assert.equal(mapped.title, "AgriSkills Orchard Grove Care");
  assert.equal(mapped.phone, "+61386927284");
});
