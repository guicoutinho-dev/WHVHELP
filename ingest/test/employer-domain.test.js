const test = require("node:test");
const assert = require("node:assert/strict");
const rulesConfig = require("../config/regional88-rules.json");
const postcodesConfig = require("../config/postcodes-88.json");
const {
  parseAustralianAddress,
  normalizeRawEmployer,
  dedupeEmployers,
  validateEmployer
} = require("../src/domain/employer");

test("parseAustralianAddress extrai city, state e postcode (incluindo NT 0800) e lida com formato incompleto", () => {
  assert.deepEqual(
    parseAustralianAddress("142 Twentieth St, Mildura VIC 3500, Australia"),
    { city: "Mildura", state: "VIC", postcode: "3500" }
  );
  assert.deepEqual(
    parseAustralianAddress("88 Mitchell St, Darwin City NT 0800, Australia"),
    { city: "Darwin City", state: "NT", postcode: "0800" }
  );
  assert.deepEqual(
    parseAustralianAddress("Australia"),
    { city: null, state: null, postcode: null }
  );
});

test("normalizeRawEmployer classifica categoria WHV, calcula 88 dias e sanitiza URL/telefone", () => {
  const emp = normalizeRawEmployer({
    externalId: "gm-1",
    title: "Sunraysia Citrus & Grape Orchard",
    category: "Orchard",
    categories: ["Orchard", "Fruit picking", "Agricultural service"],
    address: "210 Cureton Ave, Mildura VIC 3500, Australia",
    phone: "+61 3 5023 0100",
    website: "https://sunraysiaorchard.example.au",
    googleMapsUrl: "https://www.google.com/maps/place/?q=place_id:gm-1",
    rating: 4.5,
    reviewCount: 68
  }, rulesConfig, postcodesConfig);

  assert.equal(emp.id, "gmaps:gm-1");
  assert.equal(emp.category, "Fruit Picking");
  assert.deepEqual(emp.location, { city: "Mildura", state: "VIC", postcode: "3500" });
  assert.deepEqual(emp.regionalWork, { "417": "likely", "462": "likely" });
  assert.equal(validateEmployer(emp).valid, true);
});

test("dedupeEmployers mescla registros com mesmo nome e postcode mantendo o mais completo", () => {
  const list = [
    {
      id: "gmaps:1",
      name: "Coral Sea Backpackers Resort",
      location: { city: "Cairns", state: "QLD", postcode: "4870" },
      phone: null,
      website: null,
      rating: null
    },
    {
      id: "gmaps:2",
      name: "Coral Sea Backpackers Resort!",
      location: { city: "Cairns", state: "QLD", postcode: "4870" },
      phone: "+61 7 4051 0200",
      website: "https://coralsearesort.example.au",
      rating: 4.3
    }
  ];
  const deduped = dedupeEmployers(list);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].phone, "+61 7 4051 0200");
  assert.equal(deduped[0].website, "https://coralsearesort.example.au");
});
