# HelpWHV Phases 3 & 4 (Auto-Apply Mode + WHV Accommodation Directory) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with TDD.

**Goal:** Complete Phase 3 (automatic evaluation mode when not paused + pre-filled `mailto:` outreach helper) and Phase 4 (WHV Accommodation pipeline `data/accommodation.json` + `"Hospedagem"` tab in `app.js`).

**Architecture:** Extends `ingest/src/domain/application-rules.js` with `buildMailtoHref` and auto-mode evaluation in `app.js`. Adds pure domain module `ingest/src/domain/accommodation.js` (`classifyStayType`, `normalizeRawAccommodation`, `dedupeAccommodations`, `validateAccommodation`), adapter `ingest/src/sources/gmaps-accommodation.js`, CLI flag `--accommodation`, and the `"Hospedagem"` (`view === "accommodation"`) tab in `app.js`.

**Tech Stack:** Node.js 24 (`node:test`, `node:assert/strict`), CommonJS, zero npm dependencies, vanilla JS/HTML/CSS.

**Spec:** `d:\HelpWHV\ARCHITECTURE.md` and `d:\HelpWHV\PRODUCT.md`

---

### Task 1: Phase 3 — Auto-Mode Evaluation & Mailto Helper (`application-rules.js`)

- [x] **Step 1: Write failing tests in `ingest/test/application-rules.test.js` for `buildMailtoHref`**
- [x] **Step 2: Run test to verify it fails (RED)**
- [x] **Step 3: Implement `buildMailtoHref` in `ingest/src/domain/application-rules.js`**
- [x] **Step 4: Run test to verify it passes (GREEN)**

### Task 2: Phase 4 — WHV Accommodation Domain, Adapter & Pipeline (`accommodation.js`, `gmaps-accommodation.js`, `data/accommodation.json`)

- [x] **Step 1: Write failing tests in `ingest/test/accommodation.test.js`**
- [x] **Step 2: Run test to verify it fails (RED)**
- [x] **Step 3: Implement `accommodation.js`, `gmaps-accommodation.js`, `runAccommodationPipeline` in `pipeline.js`, and `--accommodation` in `cli.js`**
- [x] **Step 4: Run test to verify it passes (GREEN)**

### Task 3: Frontend Integration — Auto-Apply Mode + `"Hospedagem"` Tab (`app.js`, `styles.css`, `app.test.js`, `.github/workflows/ingest.yml`)

- [x] **Step 1: Write failing tests in `app.test.js` for `toViewStay`, `filterStays`, `stayMarkup`, and `buildMailtoHref`**
- [x] **Step 2: Run test to verify it fails (RED)**
- [x] **Step 3: Implement `"Hospedagem"` tab, stay filters, auto-mode batch/row behavior, and `mailto:` action in `app.js`, `styles.css`, and `.github/workflows/ingest.yml`**
- [x] **Step 4: Run full test suite (`npm test`) and sync `dist` (GREEN)**
