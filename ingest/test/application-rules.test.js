const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_PROFILE,
  evaluateJobForProfile,
  buildApplicationPitch,
  buildMailtoHref
} = require("../src/domain/application-rules");

test("evaluateJobForProfile aprova vaga compatível e gera pitch com dados do perfil", () => {
  const profile = {
    ...DEFAULT_PROFILE,
    fullName: "Lucas Silva",
    visaSubclass: "462",
    availableFrom: "Imediata",
    experienceSummary: "2 anos em colheita de cítricos e trabalho rural.",
    minHourlyWage: 29,
    allowMissingSalary: false,
    requireRegional88: true,
    allowedCategories: ["Fruit Picking", "Farm"],
    rulesApproved: true
  };
  const job = {
    id: "adzuna:4810201",
    title: "Citrus Fruit Picker",
    employer: "Murray Valley Orchards",
    category: "Fruit Picking",
    city: "Mildura",
    state: "VIC",
    pay: { min: 29.33, max: 33.5, period: "hour", currency: "AUD" },
    regionalWork: { "417": "likely", "462": "likely" }
  };

  const res = evaluateJobForProfile(job, profile);
  assert.equal(res.allowed, true);
  assert.equal(res.status, "Preparada");
  assert.ok(res.pitch.includes("Lucas Silva"));
  assert.ok(res.pitch.includes("462"));
  assert.ok(res.pitch.includes("Citrus Fruit Picker"));
});

test("evaluateJobForProfile distingue bloqueio por regra de bloqueio por dado insuficiente", () => {
  const strictProfile = {
    ...DEFAULT_PROFILE,
    visaSubclass: "462",
    minHourlyWage: 30,
    allowMissingSalary: false,
    requireRegional88: true,
    allowedCategories: ["Fruit Picking", "Farm"],
    rulesApproved: true
  };

  const lowPayJob = {
    title: "Farm Hand",
    category: "Farm",
    city: "Shepparton",
    state: "VIC",
    pay: { min: 27, max: 28, period: "hour", currency: "AUD" },
    regionalWork: { "417": "likely", "462": "likely" }
  };
  const lowPayRes = evaluateJobForProfile(lowPayJob, strictProfile);
  assert.equal(lowPayRes.allowed, false);
  assert.equal(lowPayRes.status, "Não enviada · regra");

  const missingPayJob = {
    title: "Farm Hand",
    category: "Farm",
    city: "Shepparton",
    state: "VIC",
    pay: null,
    regionalWork: { "417": "likely", "462": "likely" }
  };
  const missingPayRes = evaluateJobForProfile(missingPayJob, strictProfile);
  assert.equal(missingPayRes.allowed, false);
  assert.equal(missingPayRes.status, "Não enviada · dado insuficiente");

  const unknown88Job = {
    title: "Farm Hand",
    category: "Farm",
    city: "Shepparton",
    state: "VIC",
    pay: { min: 32, max: null, period: "hour", currency: "AUD" },
    regionalWork: { "417": "unknown", "462": "unknown" }
  };
  const unknown88Res = evaluateJobForProfile(unknown88Job, strictProfile);
  assert.equal(unknown88Res.allowed, false);
  assert.equal(unknown88Res.status, "Não enviada · dado insuficiente");
});

test("buildMailtoHref monta link mailto: codificado com cargo e pitch", () => {
  const href = buildMailtoHref({
    title: "Citrus Fruit Picker",
    employer: "Murray Valley Orchards",
    pitch: "Olá! Tenho visto 462 e disponibilidade imediata."
  });
  assert.ok(href.startsWith("mailto:?subject="));
  assert.ok(href.includes(encodeURIComponent("Citrus Fruit Picker")));
  assert.ok(href.includes(encodeURIComponent("Olá! Tenho visto 462")));
});
