# HelpWHV Phase 2 (WHV Profile, Autonomy Rules Engine & Applications Dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Phase 2 WHV Profile & Autonomy Rules modal, the pure rule evaluation engine (`evaluateJobForProfile` + `buildApplicationPitch`), and the interactive **Candidaturas** dashboard in `app.js` backed by `localStorage`.

**Architecture:** A pure domain module (`ingest/src/domain/application-rules.js`) evaluates contract job objects against user-approved rules (`minHourlyWage`, `allowMissingSalary`, `requireRegional88`, `allowedCategories`, `visaSubclass`) and generates a tailored application pitch. `app.js` exposes the same pure functions, persists profile (`helpwhv_profile_v1`) and application records (`helpwhv_applications_v1`) in `localStorage`, gates individual/batch AI applications on `profile.rulesApproved`, and renders the **Candidaturas** tab with status filtering, pitch copy, external link, and `"Marcar como enviada"` confirmation.

**Tech Stack:** Node.js 24 (`node:test`, `node:assert/strict`), CommonJS, zero npm dependencies, vanilla JS/HTML/CSS, `localStorage`.

**Spec:** `d:\HelpWHV\ARCHITECTURE.md` and `d:\HelpWHV\docs\superpowers\specs\2026-11-17-profile-rules-applications-phase2-design.md`

## Global Constraints

- Follow `ARCHITECTURE.md` and `.agents/rules/GEMINI.md`: `app.js` consumes `category` and `regionalWork` from the contract without reclassifying or recalculating regional postcodes.
- Product truth (`PRODUCT.md` / `ai-job-agent.md`): never mark an application as `Enviada` automatically; approved evaluations start as `Preparada` and become `Enviada` only when confirmed.
- All user-supplied profile fields (`fullName`, `experienceSummary`, `availableFrom`) and external job fields rendered in HTML must be escaped via `escapeHtml`.

## Review Focus

- **First-use gate when `rulesApproved === false`:** Clicking `"Enviar agora"` on a row or `"PEDIR À IA PARA CANDIDATAR"` in the batch tray when rules haven't been approved yet must open the Profile & Rules modal instead of silently failing or applying unapproved defaults.
- **Distinguishing `"Não enviada · regra"` vs `"Não enviada · dado insuficiente"`:**
  - When `requireRegional88 === true`: `regionalWork[subclass] === "unlikely"` → `"Não enviada · regra"`; `regionalWork[subclass] === "unknown"` → `"Não enviada · dado insuficiente"`.
  - When `minHourlyWage > 0`: `pay === null` or `pay.period !== "hour"` → `"Não enviada · dado insuficiente"` if `allowMissingSalary === false` (or allowed if `allowMissingSalary === true`); hourly `(pay.max ?? pay.min) < minHourlyWage` → `"Não enviada · regra"`.
- **Batch application idempotency (`eligibleForBatch`):** Jobs already in `"Preparada"` or `"Enviada"` status must not be re-queued when running a batch action; jobs previously blocked (`"Não enviada · regra"` or `"Não enviada · dado insuficiente"`) may be re-evaluated after the user adjusts their rules.
- **Paused agent state (`paused === true`):** When the user pauses the AI (`#pause-agent`), individual and batch application triggers remain disabled and clearly indicate the paused state.
- **XSS safety on user profile & generated pitch:** If a user enters `<script>` or quotes in `fullName` or `experienceSummary`, rendering the modal and the **Candidaturas** cards must escape all HTML entities.

---

### Task 1: Pure Autonomy Rules Engine (`ingest/src/domain/application-rules.js`)

**Files:**
- Create: `ingest/src/domain/application-rules.js`
- Test: `ingest/test/application-rules.test.js`

**Interfaces:**
- Consumes: contract/view job fields (`title`, `category`, `city`, `state`, `pay`, `regionalWork`)
- Produces:
  - `DEFAULT_PROFILE`: `{ fullName: "", visaSubclass: "462", availableFrom: "Imediata", experienceSummary: "", minHourlyWage: 28, allowMissingSalary: true, requireRegional88: false, allowedCategories: [], rulesApproved: false }`
  - `evaluateJobForProfile(job, profile) -> { allowed: boolean, status: "Preparada" | "Não enviada · regra" | "Não enviada · dado insuficiente", reason: string, pitch: string | null }`
  - `buildApplicationPitch(job, profile) -> string`

- [x] **Step 1: Write the failing test in `ingest/test/application-rules.test.js`**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_PROFILE,
  evaluateJobForProfile,
  buildApplicationPitch
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test ingest/test/application-rules.test.js`
Expected: FAIL with `Cannot find module '../src/domain/application-rules'`

- [x] **Step 3: Implement `ingest/src/domain/application-rules.js`**

Implement `DEFAULT_PROFILE`, `buildApplicationPitch`, and `evaluateJobForProfile` as pure functions.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test ingest/test/application-rules.test.js`
Expected: PASS (2 tests passing)

---

### Task 2: Frontend Profile Modal, Batch/Single Evaluation & `Candidaturas` Tab (`app.js`, `styles.css`, `app.test.js`)

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `app.test.js`

**Interfaces:**
- Consumes: `evaluateJobForProfile`, `buildApplicationPitch`, `DEFAULT_PROFILE`
- Produces:
  - `app.js` exports: `{ filterJobs, filterEmployers, eligibleForBatch, evaluateJobForProfile, buildApplicationPitch, applyProfileRulesToJobs, toViewJob, toViewEmployer, formatPay, formatBatchSalary, formatScopeNote, jobMarkup, employerMarkup, escapeHtml, jobs, employers, CATEGORIES, DEFAULT_PROFILE }`

- [x] **Step 1: Add failing tests in `app.test.js` for `applyProfileRulesToJobs` and `eligibleForBatch` with rule states**

Add tests in `app.test.js` verifying that:
1. `applyProfileRulesToJobs(targetJobs, profile, nowIso)` evaluates each job, sets `job.status` (`"Preparada"`, `"Não enviada · regra"`, or `"Não enviada · dado insuficiente"`), and returns structured application records with `jobId`, `title`, `employer`, `city`, `state`, `sourceName`, `sourceUrl`, `status`, `reason`, `pitch`, and `updatedAt`.
2. `eligibleForBatch` allows re-evaluating jobs whose status starts with `"Não enviada"`, while skipping jobs whose status is `"Preparada"`, `"Enviada"`, or `"Em andamento"`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `applyProfileRulesToJobs is not a function`

- [x] **Step 3: Update `app.js` and `styles.css`, then sync `dist`**

- In `app.js`:
  - Export and wire `DEFAULT_PROFILE`, `evaluateJobForProfile`, `buildApplicationPitch`, and `applyProfileRulesToJobs`.
  - Load/save `profile` (`helpwhv_profile_v1`) and `applications` (`helpwhv_applications_v1`) in `localStorage`.
  - Render the accessible **Perfil e Regras da IA** modal when `profileModalOpen === true` (opened by `#profile-button` or when attempting to apply while `!profile.rulesApproved`).
  - Wire `"Enviar agora"` (`data-apply-now`) and `"PEDIR À IA PARA CANDIDATAR"` (`#bulk-apply`) to run `applyProfileRulesToJobs`, update `applications`, update row statuses, and show a summary notice with a quick action to open the **Candidaturas** tab.
  - In `view === "applications"`, render the interactive **Candidaturas** dashboard with status counters/filters (`Todas`, `Preparada`, `Enviada`, `Bloqueadas`), generated pitch preview, `"Copiar apresentação"` button, `"Abrir anúncio original"` link, and `"Confirmar que enviei"` button (which updates the record and job status to `"Enviada"`).
- In `styles.css`: add styles for `.profile-modal-backdrop`, `.profile-modal`, `.applications-list`, `.application-card`, `.status-pill`, and `.pitch-box`.
- Run `npm run sync:dist`.

- [x] **Step 4: Run full test suite to verify everything passes**

Run: `npm test`
Expected: PASS (all tests passing)
