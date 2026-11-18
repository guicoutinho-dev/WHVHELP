const test = require("node:test");
const assert = require("node:assert/strict");
const contractData = require("./data/jobs.json");
const employersData = require("./data/employers.json");
const accommodationData = require("./data/accommodation.json");
const {
  filterJobs,
  filterEmployers,
  filterStays,
  eligibleForBatch,
  toViewJob,
  toViewEmployer,
  toViewStay,
  formatPay,
  formatBatchSalary,
  formatScopeNote,
  jobMarkup,
  employerMarkup,
  stayMarkup,
  evaluateJobForProfile,
  buildApplicationPitch,
  buildMailtoHref,
  applyProfileRulesToJobs,
  DEFAULT_PROFILE,
  STAY_TYPES,
  escapeHtml,
  CATEGORIES
} = require("./app");

test("escapeHtml neutraliza tags HTML/atributos e toViewJob bloqueia URL javascript:", () => {
  assert.equal(escapeHtml(`Barista <script>alert("x")</script>`), "Barista &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  const unsafe = toViewJob({
    id: "bad:1",
    title: " Cook ",
    category: "Hospitality",
    source: { id: "bad", name: "Bad", url: "javascript:alert(1)" }
  });
  assert.equal(unsafe.sourceUrl, "#");
});

test("toViewJob mapeia registro do contrato sem inventar salário ou local ausente", () => {
  const mapped = toViewJob(contractData.jobs[0]);
  assert.equal(typeof mapped.id, "string");
  assert.ok(CATEGORIES.includes(mapped.category));
  assert.ok(mapped.sourceUrl.startsWith("https://"));

  const missing = toViewJob({
    id: "jooble:1",
    title: "Cleaner",
    category: "Cleaning",
    employmentType: null,
    employer: null,
    location: { city: null, state: "QLD", postcode: null },
    pay: null,
    postedAt: null,
    firstSeenAt: "2026-11-17T00:00:00.000Z",
    regionalWork: { "417": "unknown", "462": "unknown" },
    summary: "",
    source: { id: "jooble", name: "Jooble", url: "https://example.com/1" }
  });
  assert.equal(missing.pay, null);
  assert.equal(formatPay(missing.pay), "Salário não informado");
  assert.equal(missing.city, "Não informada");
});

test("filterJobs filtra por categorias WHV, salário (incluindo pay null quando salary=0), trabalho regional e ordena sem mutar a lista", () => {
  const viewJobs = contractData.jobs.map(toViewJob);
  const originalIds = viewJobs.map(j => j.id);

  const allWithZeroSalary = filterJobs(viewJobs, { query: "", location: "", salary: 0, categories: [], onlyRegional: false, visaSubclass: "462", sort: "recent" });
  assert.equal(allWithZeroSalary.length, viewJobs.length);

  const min30 = filterJobs(viewJobs, { query: "", location: "", salary: 30, categories: [], onlyRegional: false, visaSubclass: "462", sort: "salary" });
  assert.ok(min30.every(j => j.pay && j.pay.period === "hour" && (j.pay.max ?? j.pay.min) >= 30));

  const fruitAndFarm = filterJobs(viewJobs, { query: "", location: "", salary: 0, categories: ["Fruit Picking", "Farm"], onlyRegional: true, visaSubclass: "462", sort: "recent" });
  assert.ok(fruitAndFarm.length > 0);
  assert.ok(fruitAndFarm.every(j => ["Fruit Picking", "Farm"].includes(j.category) && j.regionalWork["462"] === "likely"));
  assert.deepEqual(viewJobs.map(j => j.id), originalIds);
});

test("lote não reenvia uma vaga já em andamento", () => {
  const list = [
    { id: "a", status: "" },
    { id: "b", status: "Em andamento" },
    { id: "c", status: "" }
  ];
  assert.deepEqual(eligibleForBatch(list, new Set(["a", "b", "c"])).map(j => j.id), ["a", "c"]);
});

test("formatBatchSalary usa pay.min real como piso e pay.max como teto em vez de duplicar o teto", () => {
  const singleRange = [
    { pay: { min: 29.33, max: 33.5, period: "hour", currency: "AUD" } }
  ];
  assert.equal(formatBatchSalary(singleRange), "A$ 29,33 – A$ 33,50/h");

  const singleExact = [
    { pay: { min: 31, max: null, period: "hour", currency: "AUD" } }
  ];
  assert.equal(formatBatchSalary(singleExact), "A$ 31,00/h");

  const empty = [{ pay: null }];
  assert.equal(formatBatchSalary(empty), "Não informado");
});

test("formatScopeNote respeita concordância singular e plural em português", () => {
  assert.equal(
    formatScopeNote(1, 1, 1),
    "A ação incluirá 1 vaga selecionada disponível. 1 vaga em andamento não será reenviada. 1 vaga selecionada fora dos resultados filtrados."
  );
  assert.equal(
    formatScopeNote(3, 2, 0),
    "A ação incluirá 3 vagas selecionadas disponíveis. 2 vagas em andamento não serão reenviadas."
  );
});

test("jobMarkup exibe employer e summary do contrato sem omitir requisitos WHV", () => {
  const viewJob = toViewJob(contractData.jobs[0]);
  const html = jobMarkup(viewJob).replace(/\u00A0/g, " ");
  assert.ok(html.includes(viewJob.employer));
  assert.ok(html.includes(viewJob.summary));
  assert.ok(html.includes(`Ver em ${viewJob.sourceName}`));
});

test("toViewEmployer mapeia empregador do contrato, sanitiza URLs javascript: e preserva nulos", () => {
  const mapped = toViewEmployer(employersData.employers[0]);
  assert.equal(typeof mapped.id, "string");
  assert.ok(CATEGORIES.includes(mapped.category));
  assert.ok(mapped.googleMapsUrl.startsWith("https://"));

  const unsafe = toViewEmployer({
    id: "gmaps:bad",
    name: "Outback Farm",
    category: "Farm",
    address: "Mildura VIC 3500",
    location: { city: "Mildura", state: "VIC", postcode: "3500" },
    phone: null,
    website: "javascript:alert(1)",
    googleMapsUrl: "javascript:alert(2)",
    rating: null,
    reviewCount: null,
    regionalWork: { "417": "likely", "462": "likely" }
  });
  assert.equal(unsafe.website, null);
  assert.equal(unsafe.googleMapsUrl, "#");
});

test("filterEmployers filtra por busca, cidade, categorias WHV e trabalho regional sem mutar a lista", () => {
  const viewEmployers = employersData.employers.map(toViewEmployer);
  const originalIds = viewEmployers.map(e => e.id);

  const fruitAndFarm = filterEmployers(viewEmployers, {
    query: "",
    location: "",
    categories: ["Fruit Picking", "Farm"],
    onlyRegional: true,
    visaSubclass: "462"
  });
  assert.ok(fruitAndFarm.length > 0);
  assert.ok(fruitAndFarm.every(e => ["Fruit Picking", "Farm"].includes(e.category) && e.regionalWork["462"] === "likely"));

  const byMildura = filterEmployers(viewEmployers, {
    query: "citrus",
    location: "Mildura",
    categories: [],
    onlyRegional: false,
    visaSubclass: "462"
  });
  assert.ok(byMildura.length >= 1);
  assert.ok(byMildura.every(e => e.city === "Mildura"));
  assert.deepEqual(viewEmployers.map(e => e.id), originalIds);
});

test("employerMarkup exibe selo regional, telefone e omite botão de site quando website é null", () => {
  const withSite = toViewEmployer(employersData.employers[0]);
  const htmlWithSite = employerMarkup(withSite);
  assert.ok(htmlWithSite.includes("Site oficial ↗"));
  assert.ok(htmlWithSite.includes("Regional (462) · estimativa"));

  const withoutSite = toViewEmployer({
    ...employersData.employers[0],
    website: null
  });
  const htmlNoSite = employerMarkup(withoutSite);
  assert.equal(htmlNoSite.includes("Site oficial ↗"), false);
});

test("applyProfileRulesToJobs avalia vagas contra o perfil aprovado e eligibleForBatch permite reavaliar vagas antes bloqueadas", () => {
  const sampleJobs = [
    {
      ...toViewJob(contractData.jobs[0]),
      category: "Fruit Picking",
      pay: { min: 30.5, max: 34, period: "hour", currency: "AUD" },
      regionalWork: { "417": "likely", "462": "likely" }
    },
    {
      ...toViewJob(contractData.jobs[1]),
      pay: null
    }
  ];
  const strictProfile = {
    ...DEFAULT_PROFILE,
    fullName: "Ana Costa",
    visaSubclass: "462",
    minHourlyWage: 29,
    allowMissingSalary: false,
    requireRegional88: true,
    allowedCategories: ["Fruit Picking"],
    rulesApproved: true
  };

  const records = applyProfileRulesToJobs(sampleJobs, strictProfile, "2026-11-17T23:00:00.000Z");
  assert.equal(records.length, 2);
  assert.equal(records[0].status, "Preparada");
  assert.equal(sampleJobs[0].status, "Preparada");
  assert.ok(records[0].pitch.includes("Ana Costa"));
  assert.equal(records[1].status.startsWith("Não enviada"), true);
  assert.equal(sampleJobs[1].status.startsWith("Não enviada"), true);

  const chosen = new Set([sampleJobs[0].id, sampleJobs[1].id]);
  const eligible = eligibleForBatch(sampleJobs, chosen);
  assert.deepEqual(eligible.map(j => j.id), [sampleJobs[1].id]);
});

test("jobMarkup mantém botão de reavaliação visível quando status é Não enviada", () => {
  const blockedJob = {
    ...toViewJob(contractData.jobs[0]),
    status: "Não enviada · regra"
  };
  const html = jobMarkup(blockedJob);
  assert.ok(html.includes("Não enviada · regra"));
  assert.ok(html.includes(`data-apply="${blockedJob.id}"`));
});

test("toViewStay, filterStays e stayMarkup mapeiam, filtram e renderizam hospedagens WHV com selo de zona regional", () => {
  assert.deepEqual(STAY_TYPES, [
    "Working Hostel",
    "Backpacker Hostel",
    "Caravan & Cabin Park",
    "Farm Stay"
  ]);
  const viewStays = accommodationData.stays.map(toViewStay);
  const workingHostels = filterStays(viewStays, {
    query: "",
    location: "",
    stayTypes: ["Working Hostel"],
    onlyRegional: true
  });
  assert.ok(workingHostels.length > 0);
  assert.ok(workingHostels.every(s => s.stayType === "Working Hostel" && s.inRegionalZone === true));

  const html = stayMarkup(workingHostels[0]);
  assert.ok(html.includes("Zona regional"));
  assert.ok(html.includes("Working Hostel"));
});

test("buildMailtoHref exportado pelo app monta link mailto: seguro", () => {
  const link = buildMailtoHref({ title: "Barista", employer: "Cafe", pitch: "Olá!" });
  assert.ok(link.startsWith("mailto:?subject="));
});
