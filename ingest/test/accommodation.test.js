const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const postcodesConfig = require("../config/postcodes-88.json");
const {
  STAY_TYPES,
  classifyStayType,
  normalizeRawAccommodation,
  dedupeAccommodations,
  validateAccommodation
} = require("../src/domain/accommodation");
const { runCli } = require("../src/cli");

test("classifyStayType e normalizeRawAccommodation classificam Working Hostel, Backpacker Hostel, Caravan Park e Farm Stay e indicam inRegionalZone", () => {
  assert.deepEqual(STAY_TYPES, [
    "Working Hostel",
    "Backpacker Hostel",
    "Caravan & Cabin Park",
    "Farm Stay"
  ]);

  const workingHostel = normalizeRawAccommodation({
    externalId: "acc-1",
    title: "Mildura Working Hostel & Harvest Lodge",
    category: "Hostel",
    categories: ["Working hostel", "Backpackers accommodation"],
    address: "105 Deakin Ave, Mildura VIC 3500, Australia",
    phone: "+61 3 5021 1100",
    website: "https://milduraworkinghostel.example.au",
    rating: 4.4,
    reviewCount: 190
  }, postcodesConfig);

  assert.equal(workingHostel.stayType, "Working Hostel");
  assert.equal(workingHostel.inRegionalZone, true);
  assert.equal(validateAccommodation(workingHostel).valid, true);

  const cityHostel = normalizeRawAccommodation({
    externalId: "acc-2",
    title: "Harbour City Backpackers Sydney",
    category: "Hostel",
    categories: ["Hostel", "Youth hostel"],
    address: "220 George St, Sydney NSW 2000, Australia"
  }, postcodesConfig);

  assert.equal(cityHostel.stayType, "Backpacker Hostel");
  assert.equal(cityHostel.inRegionalZone, false);
});

test("dedupeAccommodations mescla duplicatas por nome + postcode e runCli --accommodation --seed grava data/accommodation.json", async () => {
  const deduped = dedupeAccommodations([
    { id: "a:1", name: "Reef Backpackers", location: { city: "Cairns", state: "QLD", postcode: "4870" }, phone: null, website: null },
    { id: "a:2", name: "Reef Backpackers!", location: { city: "Cairns", state: "QLD", postcode: "4870" }, phone: "+61 7 4051 9999", website: "https://reef.example.au" }
  ]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].phone, "+61 7 4051 9999");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "helpwhv-acc-"));
  const outPath = path.join(tmpDir, "data", "accommodation.json");
  const res = await runCli({
    argv: ["--accommodation", "--seed"],
    cwd: tmpDir,
    now: "2026-11-17T23:00:00.000Z"
  });
  assert.equal(res.wrote, true);
  assert.ok(fs.existsSync(outPath));
  const saved = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.equal(saved.schemaVersion, 1);
  assert.ok(saved.stays.length >= 8);
});
