const test = require("node:test");
const assert = require("node:assert/strict");
const contractData = require("./data/jobs.json");
const { filterJobs, eligibleForBatch, toViewJob, formatPay, escapeHtml, CATEGORIES } = require("./app");

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

test("filterJobs filtra por categorias WHV, salário (incluindo pay null quando salary=0), 88 dias e ordena sem mutar a lista", () => {
  const viewJobs = contractData.jobs.map(toViewJob);
  const originalIds = viewJobs.map(j => j.id);

  const allWithZeroSalary = filterJobs(viewJobs, { query: "", location: "", salary: 0, categories: [], onlyRegional88: false, visaSubclass: "462", sort: "recent" });
  assert.equal(allWithZeroSalary.length, viewJobs.length);

  const min30 = filterJobs(viewJobs, { query: "", location: "", salary: 30, categories: [], onlyRegional88: false, visaSubclass: "462", sort: "salary" });
  assert.ok(min30.every(j => j.pay && j.pay.period === "hour" && (j.pay.max ?? j.pay.min) >= 30));

  const fruitAndFarm = filterJobs(viewJobs, { query: "", location: "", salary: 0, categories: ["Fruit Picking", "Farm"], onlyRegional88: true, visaSubclass: "462", sort: "recent" });
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
