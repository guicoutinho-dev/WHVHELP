# HelpWHV Phase 1 (Real WHV Jobs Static Pipeline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded fictional vacancies in `app.js` with a tested Node.js ingestion pipeline (Adzuna, Jooble, allowlisted public pages) that generates `data/jobs.json` classified into the 11 WHV categories with 417/462 regional 88-day eligibility badges, and wire the static frontend to consume it.

**Architecture:** Ports & Adapters pipeline where `ingest/src/sources/` only fetches and maps external responses to `RawJob`, `ingest/src/domain/` contains pure functions (`normalize → classify → regional88 → dedupe → validate`), `ingest/src/pipeline.js` orchestrates with per-source fault isolation, and `ingest/src/cli.js` handles environment variables, atomic disk writes, regression guard, and `--seed` mode. `app.js` fetches `data/jobs.json` (or `window.HELPWHV_JOBS_URL`), maps records via `toViewJob`, and renders multi-category chips, 462/417 regional badges, dynamic city filter, and external source links.

**Tech Stack:** Node.js 24 (`node:test`, `node:assert/strict`, native `fetch`, `fs`, `path`), CommonJS (`require`/`module.exports`), zero npm dependencies, vanilla JS/HTML/CSS frontend, GitHub Actions + GitHub Pages.

**Spec:** `d:\HelpWHV\ARCHITECTURE.md` and `d:\HelpWHV\.agents\rules\GEMINI.md`

## Global Constraints

- Follow `ARCHITECTURE.md` as the single source of truth for folders, module boundaries, and the `data/jobs.json` (`schemaVersion: 1`) contract.
- `ingest/src/domain/` is strictly pure: no `fetch`, `fs`, `process.env`, or implicit clock (`now` passed as parameter).
- `ingest/src/sources/` only fetches data and maps to `RawJob`; zero business rules.
- `ingest/src/cli.js` is the only module that reads `process.env` and writes to disk.
- `app.js` only reads and displays the contract; it never reclassifies categories or recalculates regional badges.
- Zero npm dependencies; use Node 24 native APIs and CommonJS (`require`/`module.exports`).
- Never invent vacancy, salary, date, employer, or regional badge (`null` when missing; UI displays `"Salário não informado"` / `"Local não informado"`). Never convert pay periods (e.g., annual to hourly) unless declared by the source.
- Forbidden sources: Facebook, Gumtree, Seek, Indeed, LinkedIn.
- UI copy in Brazilian Portuguese (`pt-BR`); the 11 WHV category names remain in English (`Childcare`, `Cleaning`, `Construction`, `Driving`, `Farm`, `Fruit Picking`, `Hospitality`, `Other`, `Sales`, `Trades`, `Warehouse`).

## Review Focus

- **Annual/unqualified salary figures from aggregators:** Adzuna often returns annual salaries (e.g., `65000`) without an explicit period field; `normalizePay` must not label figures `> 250` as `"hour"` unless the raw period explicitly says `"hour"`, and must never divide annual figures to invent an hourly rate.
- **Leading-zero Australian postcodes (Northern Territory `0800`–`0899`):** Postcodes must remain 4-character strings (`"0800"`), never coerced with `Number()` in a way that breaks range matching, and missing postcodes (`null`) must yield `regionalWork: { "417": "unknown", "462": "unknown" }`.
- **Cross-source deduplication with partial fields and `firstSeenAt` preservation:** When two sources report the same job (same normalized title + employer + city), `dedupeJobs` must retain the record with more non-null fields while preserving the earliest `firstSeenAt` from `previous.jobs`.
- **Regression guard on sudden source drop:** When `previous.jobs.length >= 10` and the newly produced `jobs.length < previous.jobs.length * 0.5`, `cli.js` (via `shouldAbortRegression`) must keep the existing `data/jobs.json` untouched and throw/exit non-zero.
- **Frontend filtering and batch summary with `pay: null` or `pay.period !== "hour"`:** `filterJobs` with `salary: 0` must include jobs where `pay` is `null` or annual; `filterJobs` with `salary: 30` must include only hourly jobs with `(pay.max ?? pay.min) >= 30`; `summaryMarkup` must not render `NaN` or `Infinity` when selected jobs lack hourly pay.

---

### Task 1: Project Scaffolding & Domain Core (`categories.js`, `job.js`, `normalize.js`, `classify.js`)

**Files:**
- Create: `package.json`
- Create: `ingest/src/domain/categories.js`
- Create: `ingest/src/domain/job.js`
- Create: `ingest/src/domain/normalize.js`
- Create: `ingest/src/domain/classify.js`
- Test: `ingest/test/domain-core.test.js`

**Interfaces:**
- Consumes: none
- Produces:
  - `ingest/src/domain/categories.js`: `CATEGORIES` (frozen array of 11 strings), `CATEGORY_KEYWORDS` (object mapping category to array of lowercase terms), `EMPLOYMENT_TYPES` (`["casual", "part_time", "full_time", "seasonal", "contract"]`), `PAY_PERIODS` (`["hour", "day", "week", "year"]`)
  - `ingest/src/domain/job.js`: `validateJob(job) -> { valid: boolean, reasons: string[] }`, `isExpired(job, nowIso, maxAgeDays = 30) -> boolean`
  - `ingest/src/domain/normalize.js`: `normalizeRawJob(raw, nowIso) -> Job`
  - `ingest/src/domain/classify.js`: `classifyJob(job) -> string` (one of `CATEGORIES`)

- [ ] **Step 1: Create `package.json` and write the failing test in `ingest/test/domain-core.test.js`**

Create `package.json` with `"scripts": { "test": "node --test app.test.js ingest/test/*.test.js", "ingest": "node ingest/src/cli.js", "ingest:seed": "node ingest/src/cli.js --seed", "sync:dist": "node ingest/src/cli.js --sync-dist" }`.

Write `ingest/test/domain-core.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test ingest/test/domain-core.test.js`
Expected: FAIL with `Cannot find module '../src/domain/categories'`

- [ ] **Step 3: Implement `categories.js`, `job.js`, `normalize.js`, and `classify.js`**

- In `ingest/src/domain/categories.js`: export `CATEGORIES`, `CATEGORY_KEYWORDS` (ordered so specific categories like `"Fruit Picking"` are checked before `"Farm"`), `EMPLOYMENT_TYPES`, and `PAY_PERIODS`.
- In `ingest/src/domain/normalize.js`: implement `normalizeRawJob(raw, nowIso)` producing `{ id, title, category: "Other", employmentType, employer, location: { city, state, postcode }, pay, postedAt, firstSeenAt: nowIso, regionalWork: { "417": "unknown", "462": "unknown" }, summary, source: { id, name, url } }`. Ensure postcode is preserved as a 4-digit string when present (`/^\d{4}$/`), `pay` is `null` if neither `payMin` nor `payMax` is a positive number, and if `payPeriod` is missing: infer `"year"` only when `min >= 10000`, `"hour"` only when `min >= 15 && min <= 200`, otherwise `null` (if period remains `null`, set `pay: null` to avoid guessing).
- In `ingest/src/domain/classify.js`: implement `classifyJob(job)` matching `job.sourceCategory` or `job.title` first, then `job.summary`, against `CATEGORY_KEYWORDS`.
- In `ingest/src/domain/job.js`: implement `validateJob(job)` and `isExpired(job, nowIso, maxAgeDays = 30)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test ingest/test/domain-core.test.js`
Expected: PASS (4 tests passing)

---

### Task 2: Regional 88-Day Eligibility & Deduplication (`regional88.js`, `dedupe.js`, configs)

**Files:**
- Create: `ingest/config/postcodes-88.json`
- Create: `ingest/config/regional88-rules.json`
- Create: `ingest/src/domain/regional88.js`
- Create: `ingest/src/domain/dedupe.js`
- Test: `ingest/test/regional-dedupe.test.js`

**Interfaces:**
- Consumes: `CATEGORIES` from `ingest/src/domain/categories.js`
- Produces:
  - `ingest/src/domain/regional88.js`: `assessRegionalWork(job, rulesConfig, postcodesConfig) -> { "417": "likely" | "unlikely" | "unknown", "462": "likely" | "unlikely" | "unknown", officialUrl: string }`
  - `ingest/src/domain/dedupe.js`: `dedupeJobs(jobs, previousJobs = []) -> Job[]`

- [ ] **Step 1: Write the failing test in `ingest/test/regional-dedupe.test.js`**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test ingest/test/regional-dedupe.test.js`
Expected: FAIL with `Cannot find module '../config/postcodes-88.json'`

- [ ] **Step 3: Create `postcodes-88.json`, `regional88-rules.json`, `regional88.js`, and `dedupe.js`**

- In `ingest/config/postcodes-88.json`: store `officialUrl` (`"https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/work-holiday-417/specified-work"` and `"https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/work-holiday-462/specified-462-work"`), `checkedAt`, and postcode range lists `[start, end]` as 4-digit strings for `regionalAustralia` (NSW regional ranges excluding Sydney/Newcastle/Wollongong, VIC regional excluding Melbourne, QLD regional excluding Brisbane/Gold Coast, WA regional excluding Perth, all SA/TAS/NT/Norfolk Island) and `northernOrRemoteAustralia` (all NT `"0800"`–`"0899"`, QLD north of Tropic of Capricorn, WA north/remote postcodes).
- In `ingest/config/regional88-rules.json`: map `Farm`, `Fruit Picking`, `Construction` to `regionalAustralia` for both `417` and `462`; map `Hospitality` to `northernOrRemoteAustralia` for both `417` and `462`; map `Childcare`, `Cleaning`, `Driving`, `Sales`, `Trades`, `Warehouse`, `Other` to `unlikely` (with `Trades` on construction sites already classified under `Construction` when construction keywords match).
- In `ingest/src/domain/regional88.js`: implement `assessRegionalWork(job, rulesConfig, postcodesConfig)`.
- In `ingest/src/domain/dedupe.js`: implement `dedupeJobs(jobs, previousJobs = [])` using normalized key `${norm(title)}|${norm(employer)}|${norm(location.city)}`, scoring completeness by non-null fields (`pay`, `location.postcode`, `employer`, `postedAt`, `summary`), and preserving `firstSeenAt` from `previousJobs` (matched by `id` or dedupe key).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test ingest/test/regional-dedupe.test.js`
Expected: PASS (2 tests passing)

---

### Task 3: Source Adapters (`adzuna.js`, `jooble.js`, `public-pages.js`, fixtures & allowlist)

**Files:**
- Create: `ingest/config/sources.json`
- Create: `ingest/test/fixtures/adzuna-sample.json`
- Create: `ingest/test/fixtures/jooble-sample.json`
- Create: `ingest/test/fixtures/public-page-sample.json`
- Create: `ingest/src/sources/adzuna.js`
- Create: `ingest/src/sources/jooble.js`
- Create: `ingest/src/sources/public-pages.js`
- Test: `ingest/test/sources.test.js`

**Interfaces:**
- Consumes: `ingest/config/sources.json`
- Produces:
  - `ingest/src/sources/adzuna.js`: `createAdzunaSource({ appId, appKey, fetchImpl, queries }) -> { id: "adzuna", name: "Adzuna", fetchJobs() -> Promise<RawJob[]> }`
  - `ingest/src/sources/jooble.js`: `createJoobleSource({ apiKey, fetchImpl, queries }) -> { id: "jooble", name: "Jooble", fetchJobs() -> Promise<RawJob[]> }`
  - `ingest/src/sources/public-pages.js`: `createPublicPagesSource({ apiKey, fetchImpl, allowlist }) -> { id: "public-pages", name: "Public Job Boards", fetchJobs() -> Promise<RawJob[]> }`

- [ ] **Step 1: Write fixtures, `sources.json`, and the failing test in `ingest/test/sources.test.js`**

Create sanitized fixtures (`ingest/test/fixtures/adzuna-sample.json`, `jooble-sample.json`, `public-page-sample.json`) containing realistic Australian WHV job listings across the 11 categories (no personal data).
Create `ingest/config/sources.json` with default `queries` and `publicPages` allowlist (each entry having `id`, `name`, `url`, `robotsAllowed: true`, `termsCheckedAt`).
Write `ingest/test/sources.test.js` verifying that:
1. `createAdzunaSource` calls the Adzuna AU endpoint with `app_id` and `app_key` and maps `results` to `RawJob[]` without applying domain classification.
2. `createJoobleSource` POSTs to Jooble API and maps `jobs` to `RawJob[]`.
3. `createPublicPagesSource` refuses any URL not in `allowlist`, refuses forbidden domains (`facebook.com`, `gumtree.com.au`, `seek.com.au`, `indeed.com`, `linkedin.com`) or entries without `robotsAllowed: true` and `termsCheckedAt`, and maps extracted items to `RawJob[]`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test ingest/test/sources.test.js`
Expected: FAIL with `Cannot find module '../src/sources/adzuna'`

- [ ] **Step 3: Implement `adzuna.js`, `jooble.js`, and `public-pages.js`**

Implement the three adapter factories in `ingest/src/sources/` using injected `fetchImpl` (defaulting to global `fetch`). Ensure `public-pages.js` enforces the forbidden-host check and requires `robotsAllowed === true && Boolean(termsCheckedAt)` before calling Firecrawl (`https://api.firecrawl.dev/v1/scrape`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test ingest/test/sources.test.js`
Expected: PASS

---

### Task 4: Pipeline Orchestration, CLI & Seeded `data/jobs.json` (`pipeline.js`, `cli.js`)

**Files:**
- Create: `ingest/src/pipeline.js`
- Create: `ingest/src/cli.js`
- Create: `data/jobs.json` (generated via `node ingest/src/cli.js --seed`)
- Test: `ingest/test/pipeline-cli.test.js`

**Interfaces:**
- Consumes: `normalizeRawJob`, `classifyJob`, `assessRegionalWork`, `dedupeJobs`, `validateJob`, `isExpired`, source factories, configs
- Produces:
  - `ingest/src/pipeline.js`: `runPipeline({ sources, now, previous, rulesConfig, postcodesConfig }) -> Promise<{ schemaVersion: 1, generatedAt: string, sources: SourceReport[], jobs: Job[] }>`, `shouldAbortRegression(previousCount, nextCount) -> boolean`
  - `ingest/src/cli.js`: `runCli({ argv, env, cwd, fetchImpl }) -> Promise<{ wrote: boolean, outputPath: string, payload: object }>`

- [ ] **Step 1: Write the failing test in `ingest/test/pipeline-cli.test.js`**

Test cases in `ingest/test/pipeline-cli.test.js`:
1. `runPipeline` isolates a failing source (`ok: false, error: "HTTP 503"`) while keeping jobs from healthy sources, classifies into the 11 categories, attaches `regionalWork`, deduplicates, drops invalid/expired jobs, and outputs `schemaVersion: 1`.
2. `shouldAbortRegression` returns `true` when `previousCount >= 10` and `nextCount < previousCount * 0.5`, and `false` otherwise.
3. `runCli` with `["--seed"]` writes `data/jobs.json` atomically in a temp directory using recorded fixtures, and when run again against a `previous` file with 20 jobs while sources return 2 jobs, aborts with a regression error without overwriting the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test ingest/test/pipeline-cli.test.js`
Expected: FAIL with `Cannot find module '../src/pipeline'`

- [ ] **Step 3: Implement `pipeline.js` and `cli.js`, then generate `data/jobs.json`**

- Implement `runPipeline` and `shouldAbortRegression` in `ingest/src/pipeline.js`.
- Implement `runCli` in `ingest/src/cli.js` supporting:
  - Normal mode: builds enabled sources from `env` (`ADZUNA_APP_ID`+`ADZUNA_APP_KEY`, `JOOBLE_API_KEY`, `FIRECRAWL_API_KEY`), records `{ id, ok: false, skipped: true, fetched: 0, kept: 0, error: "missing credentials" }` for unconfigured sources.
  - `--seed` mode: runs the pipeline using the recorded fixtures in `ingest/test/fixtures/` so local development and static preview have real-shaped WHV vacancies across categories.
  - `--sync-dist` mode: copies `index.html`, `app.js`, `styles.css`, and `data/jobs.json` into `sites/helpwhv/dist/`.
  - Atomic write: writes to `data/jobs.json.tmp` and renames to `data/jobs.json`.
- Run `node ingest/src/cli.js --seed` to create `data/jobs.json`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test ingest/test/pipeline-cli.test.js`
Expected: PASS

---

### Task 5: Frontend Contract Integration, WHV Filters & GitHub Workflow (`app.js`, `styles.css`, `app.test.js`, `.github/workflows/ingest.yml`)

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `app.test.js`
- Create: `.github/workflows/ingest.yml`

**Interfaces:**
- Consumes: `data/jobs.json` (`schemaVersion: 1` contract)
- Produces:
  - `app.js` exports: `{ filterJobs, eligibleForBatch, toViewJob, formatPay, jobs, CATEGORIES }`
  - `.github/workflows/ingest.yml`: 6-hourly cron (`0 */6 * * *`) + `workflow_dispatch` that runs `npm test`, downloads previous `jobs.json` from GitHub Pages if available, runs `npm run ingest`, and deploys `data/jobs.json` to GitHub Pages.

- [ ] **Step 1: Update `app.test.js` with failing tests for the new contract and WHV filters**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const contractData = require("./data/jobs.json");
const { filterJobs, eligibleForBatch, toViewJob, formatPay, CATEGORIES } = require("./app");

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL on `app.test.js` (`toViewJob is not a function`)

- [ ] **Step 3: Update `app.js`, `styles.css`, and create `.github/workflows/ingest.yml`**

- In `app.js`:
  - Define `JOBS_URL = (typeof window !== "undefined" && window.HELPWHV_JOBS_URL) || "data/jobs.json"`.
  - Implement `toViewJob(contractJob)` and `formatPay(pay)` (handling `null`, `"hour"`, `"year"`, `"day"`, `"week"`).
  - Support `filters = { query: "", location: "", salary: 0, categories: [], onlyRegional88: false, visaSubclass: "462", sort: "recent" }`, loading/saving `visaSubclass` in `localStorage` when available.
  - Render the 11 WHV category filter chips (matching the user's reference image: `Childcare`, `Cleaning`, `Construction`, `Driving`, `Farm`, `Fruit Picking`, `Hospitality`, `Other`, `Sales`, `Trades`, `Warehouse`), the 462/417 selector + `"Apenas 88 dias (estimativa)"` toggle, dynamic city `<select>` from loaded jobs, regional badge (`88 dias · estimativa` linking to official Home Affairs Specified Work page), and external link to `job.sourceUrl` (`Ver vaga em ${job.sourceName}`).
  - Handle loading (`Carregando vagas...`), fetch error, and empty state (`Nenhuma vaga encontrada`); keep AI application buttons clearly marked as preview.
- In `styles.css`: add styles for `.category-chips`, `.category-chip`, `.regional-toolbar`, `.badge-88`, and `.source-link` consistent with the existing palette and typography in `DESIGN.md`.
- Create `.github/workflows/ingest.yml` implementing Decision D1.
- Run `npm run sync:dist` so `sites/helpwhv/dist/` stays synchronized.

- [ ] **Step 4: Run full test suite to verify everything passes**

Run: `npm test`
Expected: PASS (all tests in `app.test.js` and `ingest/test/*.test.js` passing)
