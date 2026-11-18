const test = require("node:test");
const assert = require("node:assert/strict");
const { CATEGORIES } = require("../src/domain/categories");
const { normalizeRawJob } = require("../src/domain/normalize");
const { classifyJob } = require("../src/domain/classify");
const { validateJob, isExpired } = require("../src/domain/job");

test("CATEGORIES contém exatamente as 11 categorias WHV", () => {
  assert.deepEqual(CATEGORIES, [
    "Childcare", "Cleaning", "Construction", "Driving", "Farm",
    "Fruit Picking", "Hospitality", "Other", "Sales", "Trades", "Warehouse"
  ]);
});

test("normalizeRawJob preserva nulos, não converte salário anual em hora e trunca summary em 300 chars", () => {
  const now = "2026-11-17T12:00:00.000Z";
  const hourly = normalizeRawJob({
    externalId: "101",
    sourceId: "adzuna",
    sourceName: "Adzuna",
    url: "https://example.com/job/101",
    title: "   Citrus Fruit Picker  ",
    employer: "Sunraysia Farms",
    city: "Mildura",
    state: "VIC",
    postcode: "3500",
    payMin: 29.5,
    payMax: 32,
    payPeriod: "hour",
    employmentType: "seasonal",
    postedAt: "2026-11-15T00:00:00.000Z",
    description: "A".repeat(350)
  }, now);

  assert.equal(hourly.id, "adzuna:101");
  assert.equal(hourly.title, "Citrus Fruit Picker");
  assert.deepEqual(hourly.pay, { min: 29.5, max: 32, period: "hour", currency: "AUD" });
  assert.equal(hourly.summary.length, 300);

  const annualUnlabeled = normalizeRawJob({
    externalId: "102",
    sourceId: "adzuna",
    sourceName: "Adzuna",
    url: "https://example.com/job/102",
    title: "Venue Manager",
    payMin: 72000,
    payMax: null,
    payPeriod: null
  }, now);
  assert.deepEqual(annualUnlabeled.pay, { min: 72000, max: null, period: "year", currency: "AUD" });

  const noPay = normalizeRawJob({
    externalId: "103",
    sourceId: "jooble",
    sourceName: "Jooble",
    url: "https://example.com/job/103",
    title: "Kitchen Hand"
  }, now);
  assert.equal(noPay.pay, null);
});

test("classifyJob prioriza título sobre resumo e cai em Other quando sem correspondência", () => {
  assert.equal(classifyJob({ title: "Blueberry Picker", summary: "Farm work in Coffs Harbour" }), "Fruit Picking");
  assert.equal(classifyJob({ title: "Dairy Farm Hand", summary: "Tractor and cattle" }), "Farm");
  assert.equal(classifyJob({ title: "Barista & All Rounder", summary: "Busy cafe" }), "Hospitality");
  assert.equal(classifyJob({ title: "Pick Packer", summary: "Forklift and dispatch" }), "Warehouse");
  assert.equal(classifyJob({ title: "General Labourer", summary: "White card required on site" }), "Construction");
  assert.equal(classifyJob({ title: "Qualified Electrician", summary: "Commercial maintenance" }), "Trades");
  assert.equal(classifyJob({ title: "Early Childhood Educator", summary: "Daycare room leader" }), "Childcare");
  assert.equal(classifyJob({ title: "Commercial Cleaner", summary: "Evening office shifts" }), "Cleaning");
  assert.equal(classifyJob({ title: "Delivery Driver HR", summary: "Multi-drop local route" }), "Driving");
  assert.equal(classifyJob({ title: "Retail Sales Assistant", summary: "Customer service in store" }), "Sales");
  assert.equal(classifyJob({ title: "Mystery Shopper Coordinator", summary: "Remote admin" }), "Other");
});

test("validateJob exige title e source.url http(s); isExpired respeita 30 dias", () => {
  const valid = { id: "adzuna:1", title: "Barista", source: { id: "adzuna", name: "Adzuna", url: "https://example.com/1" } };
  assert.equal(validateJob(valid).valid, true);
  assert.equal(validateJob({ ...valid, title: "" }).valid, false);
  assert.equal(validateJob({ ...valid, source: { id: "adzuna", name: "Adzuna", url: "" } }).valid, false);

  assert.equal(isExpired({ postedAt: "2026-10-01T00:00:00.000Z" }, "2026-11-17T00:00:00.000Z", 30), true);
  assert.equal(isExpired({ postedAt: "2026-11-10T00:00:00.000Z" }, "2026-11-17T00:00:00.000Z", 30), false);
});
