const test = require("node:test");
const assert = require("node:assert/strict");
const adzunaFixture = require("./fixtures/adzuna-sample.json");
const joobleFixture = require("./fixtures/jooble-sample.json");
const publicPageFixture = require("./fixtures/public-page-sample.json");
const sourcesConfig = require("../config/sources.json");
const { createAdzunaSource, mapAdzunaItemToRawJob } = require("../src/sources/adzuna");
const { createJoobleSource } = require("../src/sources/jooble");
const { createPublicPagesSource } = require("../src/sources/public-pages");

test("createAdzunaSource busca endpoint AU com credenciais e mapeia para RawJob sem classificar", async () => {
  const calls = [];
  const fetchStub = async url => {
    calls.push(String(url));
    return { ok: true, status: 200, json: async () => adzunaFixture };
  };

  const source = createAdzunaSource({
    appId: "test-id",
    appKey: "test-key",
    fetchImpl: fetchStub,
    queries: ["fruit picker"]
  });

  const jobs = await source.fetchJobs();
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes("api.adzuna.com/v1/api/jobs/au/search/1"));
  assert.ok(calls[0].includes("app_id=test-id"));
  assert.equal(jobs.length, adzunaFixture.results.length);
  assert.equal(jobs[0].sourceId, "adzuna");
  assert.equal(jobs[0].externalId, "4810201");
  assert.equal(jobs[0].postcode, "3500");
  assert.equal(jobs[0].category, undefined);
});

test("createJoobleSource envia POST para Jooble API e mapeia jobs para RawJob", async () => {
  let capturedInit = null;
  const fetchStub = async (url, init) => {
    capturedInit = { url: String(url), init };
    return { ok: true, status: 200, json: async () => joobleFixture };
  };

  const source = createJoobleSource({
    apiKey: "jooble-secret",
    fetchImpl: fetchStub,
    queries: ["barista"]
  });

  const jobs = await source.fetchJobs();
  assert.ok(capturedInit.url.includes("jooble.org/api/"));
  assert.equal(capturedInit.init.method, "POST");
  assert.equal(jobs.length, joobleFixture.jobs.length);
  assert.equal(jobs[0].sourceId, "jooble");
  assert.equal(jobs[0].city, "Sydney");
  assert.equal(jobs[0].state, "NSW");
});

test("createPublicPagesSource rejeita domínios proibidos ou entradas sem robotsAllowed/termsCheckedAt", async () => {
  const fetchStub = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: { json: publicPageFixture } })
  });

  await assert.rejects(
    async () => {
      const badSource = createPublicPagesSource({
        apiKey: "fc-key",
        fetchImpl: fetchStub,
        allowlist: [
          {
            id: "fb",
            name: "Facebook Group",
            url: "https://www.facebook.com/groups/whvjobs",
            robotsAllowed: true,
            termsCheckedAt: "2026-11-17"
          }
        ],
        forbiddenHosts: sourcesConfig.forbiddenHosts
      });
      await badSource.fetchJobs();
    },
    /Forbidden source host/
  );

  await assert.rejects(
    async () => {
      const uncheckedSource = createPublicPagesSource({
        apiKey: "fc-key",
        fetchImpl: fetchStub,
        allowlist: [
          {
            id: "unchecked",
            name: "Unchecked Board",
            url: "https://jobs.example.au/list",
            robotsAllowed: false,
            termsCheckedAt: null
          }
        ],
        forbiddenHosts: sourcesConfig.forbiddenHosts
      });
      await uncheckedSource.fetchJobs();
    },
    /robotsAllowed and termsCheckedAt required/
  );

  const validSource = createPublicPagesSource({
    apiKey: "fc-key",
    fetchImpl: fetchStub,
    allowlist: sourcesConfig.publicPages,
    forbiddenHosts: sourcesConfig.forbiddenHosts
  });
  const jobs = await validSource.fetchJobs();
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].postcode, "2450");
});

test("mapAdzunaItemToRawJob remove utm_source, app_id e app_key da redirect_url para nunca vazar credenciais no jobs.json", () => {
  const raw = mapAdzunaItemToRawJob({
    id: "5968641283",
    title: "Fruit Picker",
    redirect_url: "https://www.adzuna.com.au/details/5968641283?utm_medium=api&utm_source=secret123&app_id=secret123&app_key=key456",
    location: { area: ["Australia", "Victoria", "Mildura"] }
  });
  assert.equal(raw.url, "https://www.adzuna.com.au/details/5968641283");
  assert.equal(raw.url.includes("secret123"), false);
});
