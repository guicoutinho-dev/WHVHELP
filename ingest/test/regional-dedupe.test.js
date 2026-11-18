const test = require("node:test");
const assert = require("node:assert/strict");
const postcodes = require("../config/postcodes-88.json");
const rules = require("../config/regional88-rules.json");
const { assessRegionalWork } = require("../src/domain/regional88");
const { dedupeJobs } = require("../src/domain/dedupe");

test("assessRegionalWork diferencia Farm/Construction regional, Hospitality no norte/remoto, leading zero NT e postcode ausente", () => {
  const milduraFruit = assessRegionalWork({ category: "Fruit Picking", location: { state: "VIC", postcode: "3500" } }, rules, postcodes);
  assert.deepEqual({ "417": milduraFruit["417"], "462": milduraFruit["462"] }, { "417": "likely", "462": "likely" });

  const sydneyConstruction = assessRegionalWork({ category: "Construction", location: { state: "NSW", postcode: "2000" } }, rules, postcodes);
  assert.deepEqual({ "417": sydneyConstruction["417"], "462": sydneyConstruction["462"] }, { "417": "unlikely", "462": "unlikely" });

  const darwinHosp = assessRegionalWork({ category: "Hospitality", location: { state: "NT", postcode: "0800" } }, rules, postcodes);
  assert.deepEqual({ "417": darwinHosp["417"], "462": darwinHosp["462"] }, { "417": "likely", "462": "likely" });

  const melbourneHosp = assessRegionalWork({ category: "Hospitality", location: { state: "VIC", postcode: "3000" } }, rules, postcodes);
  assert.deepEqual({ "417": melbourneHosp["417"], "462": melbourneHosp["462"] }, { "417": "unlikely", "462": "unlikely" });

  const missingPostcode = assessRegionalWork({ category: "Farm", location: { state: "QLD", postcode: null } }, rules, postcodes);
  assert.deepEqual({ "417": missingPostcode["417"], "462": missingPostcode["462"] }, { "417": "unknown", "462": "unknown" });

  const retailRegional = assessRegionalWork({ category: "Sales", location: { state: "VIC", postcode: "3500" } }, rules, postcodes);
  assert.deepEqual({ "417": retailRegional["417"], "462": retailRegional["462"] }, { "417": "unlikely", "462": "unlikely" });
});

test("dedupeJobs mescla duplicatas mantendo o registro mais completo e preserva firstSeenAt anterior", () => {
  const previous = [
    { id: "adzuna:1", title: "Fruit Picker", employer: "Sun Orchards", location: { city: "Shepparton", state: "VIC", postcode: "3630" }, firstSeenAt: "2026-11-10T00:00:00.000Z" }
  ];
  const current = [
    {
      id: "jooble:99",
      title: "fruit picker!",
      employer: "Sun Orchards",
      location: { city: "Shepparton", state: "VIC", postcode: null },
      pay: null,
      summary: "Short",
      firstSeenAt: "2026-11-17T00:00:00.000Z"
    },
    {
      id: "adzuna:1",
      title: "Fruit Picker",
      employer: "Sun Orchards",
      location: { city: "Shepparton", state: "VIC", postcode: "3630" },
      pay: { min: 30, max: null, period: "hour", currency: "AUD" },
      summary: "Complete description",
      firstSeenAt: "2026-11-17T00:00:00.000Z"
    }
  ];

  const deduped = dedupeJobs(current, previous);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].id, "adzuna:1");
  assert.equal(deduped[0].firstSeenAt, "2026-11-10T00:00:00.000Z");
  assert.equal(deduped[0].pay.min, 30);
});

test("assessRegionalWork resolve cidades/estados regionais conhecidos quando a fonte não envia postcode (ex.: Adzuna)", () => {
  const saFarm = assessRegionalWork(
    { category: "Farm", location: { city: "Loxton", state: "SA", postcode: null } },
    rules,
    postcodes
  );
  assert.deepEqual(saFarm, { "417": "likely", "462": "likely" });

  const cairnsHosp = assessRegionalWork(
    { category: "Hospitality", location: { city: "Cairns Region", state: "QLD", postcode: null } },
    rules,
    postcodes
  );
  assert.deepEqual(cairnsHosp, { "417": "likely", "462": "likely" });

  const childersFarm = assessRegionalWork(
    { category: "Farm", location: { city: "Childers", state: "QLD", postcode: null } },
    rules,
    postcodes
  );
  assert.deepEqual(childersFarm, { "417": "likely", "462": "likely" });
});
