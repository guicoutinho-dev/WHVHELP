# HelpWHV Phase 1.5 (Regional Employers & Farms Directory) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1.5 Regional Employers & Farms pipeline (`data/employers.json`) using the `google-maps-scraper` schema and add the dedicated `"Empregadores 88d"` tab to the static frontend (`app.js`).

**Architecture:** Extends the existing Ports & Adapters ingestion architecture with a pure domain module (`ingest/src/domain/employer.js`) that parses Australian addresses into `{ city, state, postcode }`, reuses `classifyJob` and `assessRegionalWork`, and deduplicates by normalized `name + postcode`. A new adapter (`ingest/src/sources/gmaps-employers.js`) maps `google-maps-scraper` JSON rows to `RawEmployer`, orchestrated via `cli.js --employers` (with `--seed` support) and rendered in a new `"Empregadores 88d"` (`view === "employers"`) tab in `app.js`.

**Tech Stack:** Node.js 24 (`node:test`, `node:assert/strict`, `fs`, `path`, `child_process`), CommonJS, zero npm dependencies, vanilla JS/HTML/CSS.

**Spec:** `d:\HelpWHV\ARCHITECTURE.md` and `d:\HelpWHV\docs\superpowers\specs\2026-11-17-employers-88d-phase1-5-design.md`

## Global Constraints

- Follow `ARCHITECTURE.md` and `.agents/rules/GEMINI.md` as binding authority.
- `ingest/src/domain/` is strictly pure: no `fetch`, `fs`, `child_process`, `process.env`, or implicit clock.
- Never present an employer listing as an open job vacancy; UI must display an explicit notice that the directory is for direct outreach (*contato espontâneo*).
- Fixtures in `ingest/test/fixtures/` must contain only commercial business data (no personal names or personal emails/phones).
- Escape all external fields rendered via `innerHTML` with `escapeHtml` and validate external URLs with `safeExternalUrl`.

## Review Focus

- **Australian address parsing (`parseAustralianAddress`):** Google Maps addresses vary (e.g., `"477 Kent St, Sydney NSW 2000, Australia"` vs `"Lot 4 River Rd, Mildura VIC 3500"` vs `"Darwin NT 0800, Australia"` vs missing postcode). Parser must preserve leading zeros (`"0800"`) and return `{ city: null, state: null, postcode: null }` rather than crashing when format is unexpected.
- **Phone and website sanitization:** Phone numbers with spaces/ formatting (`"+61 3 5021 0000"`) must remain readable in text and safe in `tel:` links; missing `web_site` or `javascript:` URLs must become `null` in the contract and omit the website button in the UI.
- **Category classification for Google Maps places:** Google Maps places have `title` and `category`/`categories` (e.g., `"Fruit and vegetable wholesaler"`, `"Orchard"`, `"Vineyard"`, `"Hostel"`, `"Dairy farm"`). `normalizeRawEmployer` must combine `raw.category` and `raw.categories` into `summary` so `classifyJob` classifies orchards/vineyards/farms/hostels accurately.
- **Deduplication by `name + postcode`:** The same farm or hostel returned by overlapping queries in the same town must collapse into one record, keeping the entry with more contact fields (`website`, `phone`, `rating`).
- **Frontend tab switching and filter sharing:** Switching between `"Vagas"`, `"Empregadores 88d"`, and `"Candidaturas"` must preserve search/category/visa filters without showing the AI job-application batch tray on the `"Empregadores 88d"` tab.

---

### Task 1: Employer Domain Module & Address Parser (`ingest/src/domain/employer.js`)

**Files:**
- Create: `ingest/src/domain/employer.js`
- Test: `ingest/test/employer-domain.test.js`

**Interfaces:**
- Consumes: `classifyJob` (`ingest/src/domain/classify.js`), `assessRegionalWork` (`ingest/src/domain/regional88.js`), `normalizePostcode` (`ingest/src/domain/normalize.js`)
- Produces:
  - `ingest/src/domain/employer.js`:
    - `parseAustralianAddress(address) -> { city: string | null, state: string | null, postcode: string | null }`
    - `normalizeRawEmployer(raw, rulesConfig, postcodesConfig) -> Employer`
    - `dedupeEmployers(employers) -> Employer[]`
    - `validateEmployer(employer) -> { valid: boolean, reasons: string[] }`

- [x] **Step 1: Write the failing test in `ingest/test/employer-domain.test.js`**

```js
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test ingest/test/employer-domain.test.js`
Expected: FAIL with `Cannot find module '../src/domain/employer'`

- [x] **Step 3: Implement `ingest/src/domain/employer.js`**

Implement `parseAustralianAddress`, `normalizeRawEmployer`, `dedupeEmployers`, and `validateEmployer` using pure functions and reusing `classifyJob` and `assessRegionalWork`.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test ingest/test/employer-domain.test.js`
Expected: PASS (3 tests passing)

---

### Task 2: Google Maps Adapter, Regional Hubs Config & CLI `--employers` (`gmaps-employers.js`, `employer-hubs.json`, `cli.js`)

**Files:**
- Create: `ingest/config/employer-hubs.json`
- Create: `ingest/test/fixtures/gmaps-employers-sample.json`
- Create: `ingest/src/sources/gmaps-employers.js`
- Modify: `ingest/src/pipeline.js`
- Modify: `ingest/src/cli.js`
- Modify: `package.json`
- Create: `data/employers.json` (generated via `node ingest/src/cli.js --employers --seed`)
- Test: `ingest/test/employers-pipeline.test.js`

**Interfaces:**
- Consumes: `normalizeRawEmployer`, `dedupeEmployers`, `validateEmployer` from `ingest/src/domain/employer.js`
- Produces:
  - `ingest/src/sources/gmaps-employers.js`: `mapGmapsPlaceToRawEmployer(place, index) -> RawEmployer`, `createGmapsEmployersSource({ hubs, runScraper }) -> { id: "gmaps-employers", fetchEmployers() -> Promise<RawEmployer[]> }`
  - `ingest/src/pipeline.js`: `runEmployersPipeline({ sources, now, rulesConfig, postcodesConfig }) -> Promise<{ schemaVersion: 1, generatedAt: string, sources: SourceReport[], employers: Employer[] }>`
  - `ingest/src/cli.js`: supports `--employers` (with `--seed`) writing `data/employers.json` and copies `data/employers.json` in `--sync-dist`.

- [x] **Step 1: Create `employer-hubs.json`, `gmaps-employers-sample.json`, and failing test in `ingest/test/employers-pipeline.test.js`**

Create `ingest/config/employer-hubs.json` with Australian WHV regional hubs and `ingest/test/fixtures/gmaps-employers-sample.json` with 12 commercial WHV employers across `Fruit Picking`, `Farm`, `Hospitality`, `Construction`, `Warehouse`, `Cleaning`, `Trades` (commercial contact details only, no personal data).
Write `ingest/test/employers-pipeline.test.js` testing `mapGmapsPlaceToRawEmployer`, `runEmployersPipeline`, and `runCli({ argv: ["--employers", "--seed"], cwd: tmpDir })`.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test ingest/test/employers-pipeline.test.js`
Expected: FAIL with `Cannot find module '../src/sources/gmaps-employers'`

- [x] **Step 3: Implement `gmaps-employers.js`, `runEmployersPipeline` in `pipeline.js`, and `--employers` in `cli.js`, then generate `data/employers.json`**

Implement the adapter and pipeline, add `"ingest:employers": "node ingest/src/cli.js --employers"` and `"ingest:employers:seed": "node ingest/src/cli.js --employers --seed"` to `package.json`, and run `node ingest/src/cli.js --employers --seed`.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test ingest/test/employers-pipeline.test.js`
Expected: PASS

---

### Task 3: Frontend `"Empregadores 88d"` Tab & Filters (`app.js`, `styles.css`, `app.test.js`, `.github/workflows/ingest.yml`)

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `app.test.js`
- Modify: `.github/workflows/ingest.yml`

**Interfaces:**
- Consumes: `data/employers.json` (`schemaVersion: 1`)
- Produces:
  - `app.js` exports: `{ filterJobs, filterEmployers, eligibleForBatch, toViewJob, toViewEmployer, formatPay, escapeHtml, jobs, employers, CATEGORIES }`

- [x] **Step 1: Add failing tests for `toViewEmployer` and `filterEmployers` in `app.test.js`**

Add tests in `app.test.js` verifying:
1. `toViewEmployer` maps a contract employer record, sanitizes `javascript:` URLs in `website` and `googleMapsUrl`, and handles missing `phone`/`website`.
2. `filterEmployers` filters by `query`, `location`, `categories`, `onlyRegional88`, and `visaSubclass` (`462`/`417`) without mutating the input list.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `toViewEmployer is not a function`

- [x] **Step 3: Implement `toViewEmployer`, `filterEmployers`, and the `"Empregadores 88d"` tab in `app.js`, update `styles.css` and `.github/workflows/ingest.yml`**

- In `app.js`:
  - Add `"Empregadores 88d"` button (`data-view="employers"`) to `.primary-nav`.
  - Load `employers.json` (`https://guicoutinho-dev.github.io/WHVHELP/employers.json` with local fallback `data/employers.json`).
  - When `view === "employers"`, hide the AI batch tray, show the notice banner (`"Diretório para contato espontâneo — estas empresas estão cadastradas no Google Maps em regiões WHV, mas o diretório não confirma vagas abertas no momento."`), render the search/city/category/88-day filter bar, and render each employer row with name, address/city/state/postcode, category, rating, `"88 dias · estimativa"` badge, and direct links (`Site oficial`, `Ligar`, `Google Maps`).
- In `.github/workflows/ingest.yml`: ensure `data/employers.json` is generated/kept alongside `data/jobs.json` in `data/` before uploading the Pages artifact.
- Run `npm run sync:dist`.

- [x] **Step 4: Run full test suite to verify everything passes**

Run: `npm test`
Expected: PASS (all tests passing)
