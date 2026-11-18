const CATEGORIES = Object.freeze([
  "Childcare",
  "Cleaning",
  "Construction",
  "Driving",
  "Farm",
  "Fruit Picking",
  "Hospitality",
  "Other",
  "Sales",
  "Trades",
  "Warehouse"
]);

const EMPLOYMENT_LABELS = Object.freeze({
  casual: "Casual",
  part_time: "Tempo parcial",
  full_time: "Tempo integral",
  seasonal: "Sazonal",
  contract: "Contrato"
});

const OFFICIAL_88_URLS = Object.freeze({
  "417": "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/work-holiday-417/specified-work",
  "462": "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/work-holiday-462/specified-462-work"
});

const PAGES_JOBS_URL = "https://guicoutinho-dev.github.io/WHVHELP/jobs.json";
const LOCAL_JOBS_URL = "data/jobs.json";

function resolveJobsUrl() {
  if (typeof window === "undefined") return LOCAL_JOBS_URL;
  if (window.HELPWHV_JOBS_URL) return window.HELPWHV_JOBS_URL;
  const host = window.location?.hostname || "";
  const protocol = window.location?.protocol || "";
  if (protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "") {
    return LOCAL_JOBS_URL;
  }
  return PAGES_JOBS_URL;
}

const JOBS_URL = resolveJobsUrl();

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeExternalUrl(url) {
  if (typeof url !== "string" || !url.trim()) return "#";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "#";
  } catch {
    return "#";
  }
}

function formatPay(pay) {
  if (!pay || (pay.min === null && pay.max === null)) {
    return "Salário não informado";
  }
  const base = pay.min ?? pay.max;
  const formattedMin = `A$ ${Number(base).toLocaleString("pt-BR", {
    minimumFractionDigits: pay.period === "year" ? 0 : 2,
    maximumFractionDigits: pay.period === "year" ? 0 : 2
  })}`;
  const suffixMap = { hour: "/h", day: "/dia", week: "/sem", year: "/ano" };
  const suffix = suffixMap[pay.period] || "";
  if (pay.max && pay.min && pay.max > pay.min) {
    const formattedMax = `A$ ${Number(pay.max).toLocaleString("pt-BR", {
      minimumFractionDigits: pay.period === "year" ? 0 : 2,
      maximumFractionDigits: pay.period === "year" ? 0 : 2
    })}`;
    return `${formattedMin} – ${formattedMax}${suffix}`;
  }
  return `${formattedMin}${suffix}`;
}

function formatShortDate(iso) {
  if (!iso) return "Data não informada";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Data não informada";
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function toViewJob(record) {
  const city = record?.location?.city || "Não informada";
  const state = record?.location?.state || "";
  const postcode = record?.location?.postcode || null;
  const postedIso = record?.postedAt || record?.firstSeenAt || null;
  const timestamp = postedIso ? Date.parse(postedIso) || 0 : 0;

  return {
    id: String(record?.id || ""),
    title: record?.title || "Vaga sem título",
    category: CATEGORIES.includes(record?.category) ? record.category : "Other",
    employer: record?.employer || "Empregador não informado",
    city,
    state,
    postcode,
    pay: record?.pay || null,
    type: EMPLOYMENT_LABELS[record?.employmentType] || "Tipo não informado",
    postedAt: postedIso,
    postedLabel: formatShortDate(postedIso),
    timestamp,
    regionalWork: record?.regionalWork || { "417": "unknown", "462": "unknown" },
    summary: record?.summary || "",
    sourceName: record?.source?.name || "Fonte externa",
    sourceUrl: safeExternalUrl(record?.source?.url),
    status: record?.status || ""
  };
}

let jobs = [];
let generatedAt = null;
let loadingState = "ready";

if (typeof require === "function" && typeof window === "undefined") {
  try {
    const seedPayload = require("./data/jobs.json");
    generatedAt = seedPayload.generatedAt || null;
    jobs = Array.isArray(seedPayload.jobs) ? seedPayload.jobs.map(toViewJob) : [];
  } catch {
    jobs = [];
  }
}

const selected = new Set();
const automatic = new Set();
let paused = false;
let mode = "now";
let view = "jobs";
let openJobId = "";

function readSavedSubclass() {
  try {
    const saved = typeof localStorage !== "undefined" && localStorage.getItem("helpwhv_visa_subclass");
    return saved === "417" || saved === "462" ? saved : "462";
  } catch {
    return "462";
  }
}

function saveSubclass(subclass) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("helpwhv_visa_subclass", subclass);
    }
  } catch {
    // ignore storage errors
  }
}

let filters = {
  query: "",
  location: "",
  salary: 0,
  categories: [],
  onlyRegional88: false,
  visaSubclass: readSavedSubclass(),
  sort: "recent"
};

const icon = (name, className = "icon") =>
  `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
const plural = count => (count === 1 ? "vaga" : "vagas");

function hourlyValue(job) {
  if (!job?.pay || job.pay.period !== "hour") return null;
  const val = job.pay.max ?? job.pay.min;
  return typeof val === "number" && Number.isFinite(val) ? val : null;
}

function filterJobs(list, criteria = {}) {
  const query = (criteria.query || "").trim().toLocaleLowerCase("pt-BR");
  const minSalary = Number(criteria.salary || 0);
  const activeCategories = Array.isArray(criteria.categories) ? criteria.categories : [];
  const onlyRegional = Boolean(criteria.onlyRegional88);
  const subclass = criteria.visaSubclass === "417" ? "417" : "462";

  const matched = list.filter(job => {
    const searchable = `${job.title} ${job.city} ${job.state} ${job.category} ${job.employer} ${job.type}`.toLocaleLowerCase("pt-BR");
    if (query && !searchable.includes(query)) return false;
    if (criteria.location && job.city !== criteria.location) return false;
    if (activeCategories.length > 0 && !activeCategories.includes(job.category)) return false;
    if (onlyRegional && job.regionalWork?.[subclass] !== "likely") return false;
    if (minSalary > 0) {
      const rate = hourlyValue(job);
      if (rate === null || rate < minSalary) return false;
    }
    return true;
  });

  if (criteria.sort === "salary") {
    matched.sort((a, b) => {
      const rateA = hourlyValue(a) ?? -1;
      const rateB = hourlyValue(b) ?? -1;
      if (rateB !== rateA) return rateB - rateA;
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
  } else if (criteria.sort === "title") {
    matched.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  } else {
    matched.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  return matched;
}

function eligibleForBatch(list, chosenIds) {
  return list.filter(job => chosenIds.has(job.id) && !job.status);
}

function distinctCities(list) {
  const set = new Set();
  for (const job of list) {
    if (job.city && job.city !== "Não informada") {
      set.add(job.city);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function symbols() {
  return `<svg class="icon-definitions" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <symbol id="icon-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="7"/><path d="m15.7 15.7 5.2 5.2"/></symbol>
    <symbol id="icon-pin" viewBox="0 0 24 24"><path d="M12 21s7-6.3 7-12A7 7 0 0 0 5 9c0 5.7 7 12 7 12Z"/><circle cx="12" cy="9" r="2.2"/></symbol>
    <symbol id="icon-work" viewBox="0 0 24 24"><rect x="2.5" y="7" width="19" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2.5 13h19"/></symbol>
    <symbol id="icon-calendar" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></symbol>
    <symbol id="icon-coins" viewBox="0 0 24 24"><ellipse cx="9" cy="5.5" rx="6.5" ry="2.5"/><path d="M2.5 5.5v7c0 1.4 2.9 2.5 6.5 2.5m-6.5-6c0 1.4 2.9 2.5 6.5 2.5"/><ellipse cx="16" cy="15.5" rx="5.5" ry="2.5"/><path d="M10.5 15.5v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4"/></symbol>
    <symbol id="icon-send" viewBox="0 0 24 24"><path d="m21 3-8.4 18-2.3-7.3L3 11.4 21 3Z"/><path d="m10.3 13.7 6.5-6.5"/></symbol>
    <symbol id="icon-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-3.4 3-5.1 7-5.1s6.4 1.7 7 5.1"/><circle cx="12" cy="12" r="10"/></symbol>
  </svg>`;
}

function jobMarkup(job) {
  const checked = selected.has(job.id);
  const auto = automatic.has(job.id);
  const open = openJobId === job.id;
  const subclass = filters.visaSubclass === "417" ? "417" : "462";
  const isRegionalLikely = job.regionalWork?.[subclass] === "likely";
  const officialUrl = OFFICIAL_88_URLS[subclass];
  const locationText = [job.city, job.state, job.postcode].filter(Boolean).join(", ");

  const safeId = escapeHtml(job.id);
  const safeTitle = escapeHtml(job.title);
  const safeLocation = escapeHtml(locationText);
  const safePay = escapeHtml(formatPay(job.pay));
  const safeCategoryAndType = escapeHtml(`${job.category} · ${job.type}`);
  const safePosted = escapeHtml(job.postedLabel);
  const safeSourceName = escapeHtml(job.sourceName);
  const safeSourceUrl = escapeHtml(job.sourceUrl);

  return `<article class="job-row${checked ? " is-selected" : ""}" data-id="${safeId}">
    <label class="job-checkbox"><input type="checkbox" data-select="${safeId}" ${checked ? "checked" : ""} aria-label="Selecionar ${safeTitle}"></label>
    <div class="job-copy"><h2>${safeTitle}</h2><p>
      <span>${icon("pin")}${safeLocation}</span>
      <span>${icon("coins")}${safePay}</span>
      <span>${icon("work")}${safeCategoryAndType}</span>
      <span>${icon("calendar")}${safePosted}</span>
      ${isRegionalLikely ? `<a class="badge-88" href="${officialUrl}" target="_blank" rel="noopener noreferrer" title="Estimativa por categoria e postcode para visto ${subclass}. Confira a regra oficial.">88 dias (${subclass}) · estimativa</a>` : ""}
      <a class="source-link" href="${safeSourceUrl}" target="_blank" rel="noopener noreferrer">Ver em ${safeSourceName} ↗</a>
    </p></div>
    ${auto ? `<label class="auto-switch"><span>Automático</span><input type="checkbox" data-auto="${safeId}" checked aria-label="Automático para ${safeTitle}"></label>` : ""}
    ${job.status ? `<span class="row-status"><span class="spinner" aria-hidden="true"></span>${escapeHtml(job.status)} · prévia</span>` : `<button class="row-action" data-apply="${safeId}" type="button" aria-expanded="${open}" ${paused ? "disabled" : ""}>Candidatar com IA</button>`}
    ${open && !job.status ? `<div class="row-options" id="options-${safeId}"><button type="button" data-apply-now="${safeId}">Enviar agora · prévia</button><button type="button" data-toggle-auto="${safeId}">${auto ? "Desativar" : "Ativar"} automático nesta vaga</button></div>` : ""}
  </article>`;
}

function summaryMarkup() {
  const chosen = jobs.filter(job => selected.has(job.id));
  if (!chosen.length) {
    return `<p class="summary-empty">Selecione vagas na lista para preparar uma ação em lote.</p>`;
  }
  const places = Array.from(new Set(chosen.map(job => `${job.city}${job.state ? ` (${job.state})` : ""}`)));
  const hourlyRates = chosen.map(hourlyValue).filter(v => v !== null);
  const salaryText = hourlyRates.length
    ? `A$ ${Math.min(...hourlyRates).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} – A$ ${Math.max(...hourlyRates).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/h`
    : "Não informado";
  const categories = Array.from(new Set(chosen.map(job => job.category)));

  return `<p>${icon("work")}<span><strong>Cargos:</strong> ${escapeHtml(chosen.map(job => job.title).join(", "))}</span></p>
    <p>${icon("pin")}<span><strong>Cidades:</strong> ${escapeHtml(places.join(", "))}</span></p>
    <p>${icon("coins")}<span><strong>Salário:</strong> ${escapeHtml(salaryText)}</span></p>
    <p>${icon("calendar")}<span><strong>Categorias:</strong> ${escapeHtml(categories.join(", "))}</span></p>`;
}

function categoryChipsMarkup() {
  return `<div class="whv-controls" aria-label="Filtros WHV por categoria e visto">
    <div class="category-chips" role="group" aria-label="Job Type (categorias WHV)">
      ${CATEGORIES.map(cat => {
        const active = filters.categories.includes(cat);
        return `<button type="button" class="category-chip${active ? " is-active" : ""}" data-category="${cat}" aria-pressed="${active}">${cat}</button>`;
      }).join("")}
    </div>
    <div class="regional-toolbar">
      <label class="subclass-select">Visto:
        <select id="visa-subclass" aria-label="Subclass do visto WHV">
          <option value="462" ${filters.visaSubclass === "462" ? "selected" : ""}>Subclass 462 (Work and Holiday)</option>
          <option value="417" ${filters.visaSubclass === "417" ? "selected" : ""}>Subclass 417 (Working Holiday)</option>
        </select>
      </label>
      <label class="regional-toggle">
        <input type="checkbox" id="only-regional" ${filters.onlyRegional88 ? "checked" : ""}>
        <span>Apenas elegíveis 88 dias (estimativa)</span>
      </label>
    </div>
  </div>`;
}

function shellMarkup() {
  const cities = distinctCities(jobs);
  const updatedLabel = generatedAt ? `Atualizado em ${formatShortDate(generatedAt)}` : "Vagas WHV · Austrália";

  return `${symbols()}
    <header class="topbar">
      <a class="brand" href="#vagas" aria-label="HelpWHV, ir para vagas"><span class="brand-sign" aria-hidden="true"><img src="assets/icons/kangaroo.svg" alt="" width="48" height="48"></span><span class="brand-name">HelpWHV</span></a>
      <nav class="primary-nav" aria-label="Navegação principal"><button class="nav-item${view === "jobs" ? " is-current" : ""}" data-view="jobs" type="button" ${view === "jobs" ? 'aria-current="page"' : ""}>${icon("search")}Vagas</button><button class="nav-item${view === "applications" ? " is-current" : ""}" data-view="applications" type="button" ${view === "applications" ? 'aria-current="page"' : ""}>${icon("work")}Candidaturas</button></nav>
      <div class="topbar-actions"><span class="agent-state"><span class="status-dot"></span>${paused ? "Prévia pausada" : "IA em prévia"}<span class="chevron" aria-hidden="true"></span></span><button class="pause-button" id="pause-agent" type="button"><span class="pause-mark" aria-hidden="true"></span>${paused ? "Retomar IA" : "Pausar IA"}</button><button class="profile-button" id="profile-button" type="button" aria-label="Perfil e regras">${icon("user")}</button></div>
    </header>
    <section class="intro" aria-labelledby="page-title"><span class="preview-tag">${updatedLabel}</span><h1 id="page-title" tabindex="-1">VAGAS DISPONÍVEIS</h1><p>Encontre vagas WHV na Austrália, filtre pelos 88 dias e acesse o anúncio original.</p><svg class="route-path" viewBox="0 0 510 80" preserveAspectRatio="none" aria-hidden="true"><path d="M4 55C55 63 70 44 120 42s87 34 144 18S325 7 369 13s77 35 137 25"/></svg><span class="route-pin">${icon("pin")}</span><div class="road-sign" aria-hidden="true"><span>AUSTRALIA</span><i></i></div><img class="roadside-scrub" src="assets/plates/roadside-scrub.png" alt=""></section>
    <main class="main-layout" id="vagas">
      <section class="jobs-area" aria-label="Busca e resultados de vagas">
        <form class="filterbar" id="search-form" role="search"><label class="search-field">${icon("search")}<span class="visually-hidden">Cargo ou palavra-chave</span><input id="query" type="search" placeholder="Cargo ou palavra-chave" autocomplete="off"></label><label class="filter-select">${icon("pin")}<span><strong>Local</strong><select id="location" aria-label="Local"><option value="">Todas as cidades</option>${cities.map(city => `<option value="${city}" ${filters.location === city ? "selected" : ""}>${city}</option>`).join("")}</select></span></label><label class="filter-select">${icon("coins")}<span><strong>Salário (A$/h)</strong><select id="salary" aria-label="Salário mínimo"><option value="0">Qualquer valor</option><option value="28">A partir de A$ 28</option><option value="30">A partir de A$ 30</option><option value="35">A partir de A$ 35</option></select></span></label><button class="search-button" type="submit">${icon("search")}Buscar vagas</button></form>
        ${categoryChipsMarkup()}
        <div class="result-tools"><strong id="result-count"></strong><label class="sort-control">Ordenar por: <select id="sort" aria-label="Ordenar vagas"><option value="recent">Mais recentes</option><option value="salary">Maior salário</option><option value="title">Cargo A–Z</option></select></label></div>
        <div class="job-list" id="job-list" aria-live="polite"></div>
      </section>
      <aside class="selection-tray" id="lote" aria-labelledby="tray-title"><h2 id="tray-title"><span id="selected-count"></span> VAGAS SELECIONADAS</h2><p class="tray-subtitle">Ação em lote (somente nestas vagas)</p><div class="selection-summary" id="selection-summary"></div><fieldset class="mode-fieldset"><legend>Modo de envio</legend><label class="mode-choice${mode === "now" ? " is-active" : ""}"><input type="radio" name="mode" value="now" ${mode === "now" ? "checked" : ""}><span><strong>Enviar agora</strong><small>Na prévia, a IA prepararia candidaturas para <span class="mode-count">0</span> vagas disponíveis.</small></span></label><label class="mode-choice${mode === "auto" ? " is-active" : ""}"><input type="radio" name="mode" value="auto" ${mode === "auto" ? "checked" : ""}><span><strong>Automático</strong><small>Na prévia, a IA acompanharia novas vagas selecionadas até você pausar.</small></span></label></fieldset><button class="bulk-button" id="bulk-apply" type="button">${icon("send")}PEDIR À IA PARA CANDIDATAR</button><p class="scope-note" id="scope-note"></p></aside>
    </main>
    <a class="mobile-batch-bar" id="mobile-batch-bar" href="#lote"><span><strong id="mobile-selected-count">0</strong> vagas selecionadas</span><span>Ver lote <span aria-hidden="true">→</span></span></a>
    <div class="notice" id="notice" role="status" aria-live="polite" hidden></div>`;
}

function updateResults() {
  const listEl = document.getElementById("job-list");
  if (!listEl) return;

  if (loadingState === "loading") {
    listEl.innerHTML = `<div class="empty-results"><h2>Carregando vagas...</h2><p>Buscando vagas atualizadas na Austrália.</p></div>`;
    document.getElementById("result-count").textContent = "Carregando...";
    return;
  }

  if (loadingState === "error") {
    listEl.innerHTML = `<div class="empty-results"><h2>Não foi possível carregar as vagas</h2><p>Verifique a conexão ou tente recarregar a página.</p></div>`;
    document.getElementById("result-count").textContent = "0 vagas encontradas";
    return;
  }

  const visible = filterJobs(jobs, filters);
  listEl.innerHTML = visible.length
    ? visible.map(jobMarkup).join("")
    : `<div class="empty-results"><h2>Nenhuma vaga encontrada</h2><p>Tente outra palavra ou limpe os filtros.</p><button id="clear-filters" type="button">Limpar filtros</button></div>`;
  document.getElementById("result-count").textContent = `${visible.length} ${plural(visible.length)} ${visible.length === 1 ? "encontrada" : "encontradas"}`;

  const count = selected.size;
  const actionable = eligibleForBatch(jobs, selected).length;
  const inProgress = count - actionable;
  const hiddenCount = [...selected].filter(id => !visible.some(job => job.id === id)).length;
  document.getElementById("selected-count").textContent = count;
  document.getElementById("mobile-selected-count").textContent = count;
  document.getElementById("selection-summary").innerHTML = summaryMarkup();
  document.querySelector(".mode-count").textContent = actionable;
  document.getElementById("scope-note").textContent = `A ação incluirá ${actionable} ${plural(actionable)} selecionadas disponíveis.${inProgress ? ` ${inProgress} ${plural(inProgress)} em andamento não serão reenviadas.` : ""}${hiddenCount ? ` ${hiddenCount} ${plural(hiddenCount)} selecionadas fora dos resultados filtrados.` : ""}`;
  document.getElementById("bulk-apply").disabled = actionable === 0 || paused;
}

function notice(message) {
  const element = document.getElementById("notice");
  element.textContent = message;
  element.hidden = false;
}

function render() {
  document.getElementById("app").innerHTML = shellMarkup();
  if (view === "applications") {
    document.getElementById("page-title").textContent = "CANDIDATURAS";
    document.querySelector(".intro p").textContent = "Acompanhe o que a IA preparou e enviou.";
    document.querySelector(".main-layout").classList.add("applications-view");
    document.querySelector(".jobs-area").innerHTML = `<section class="applications-empty" aria-labelledby="applications-title"><h2 id="applications-title">Nenhuma candidatura real ainda</h2><p>As vagas listadas são reais, mas o envio automático por IA ainda está em prévia. Use o link de cada vaga para abrir o anúncio original.</p><button type="button" data-view="jobs">Explorar vagas</button></section>`;
    document.querySelector(".selection-tray").hidden = true;
    document.getElementById("mobile-batch-bar").hidden = true;
  } else {
    document.getElementById("query").value = filters.query;
    document.getElementById("salary").value = String(filters.salary);
    document.getElementById("sort").value = filters.sort;
    updateResults();
  }
}

async function loadContractJobs() {
  loadingState = "loading";
  render();
  try {
    let response = await fetch(JOBS_URL);
    if (!response.ok && JOBS_URL !== LOCAL_JOBS_URL) {
      response = await fetch(LOCAL_JOBS_URL);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    generatedAt = payload.generatedAt || null;
    jobs = Array.isArray(payload.jobs) ? payload.jobs.map(toViewJob) : [];
    loadingState = "ready";
    if (selected.size === 0 && jobs.length > 0) {
      selected.add(jobs[0].id);
    }
    render();
  } catch {
    if (JOBS_URL !== LOCAL_JOBS_URL) {
      try {
        const fallback = await fetch(LOCAL_JOBS_URL);
        if (fallback.ok) {
          const payload = await fallback.json();
          generatedAt = payload.generatedAt || null;
          jobs = Array.isArray(payload.jobs) ? payload.jobs.map(toViewJob) : [];
          loadingState = "ready";
          if (selected.size === 0 && jobs.length > 0) {
            selected.add(jobs[0].id);
          }
          render();
          return;
        }
      } catch {
        // fall through to error state
      }
    }
    loadingState = "error";
    render();
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("submit", event => {
    if (event.target.id !== "search-form") return;
    event.preventDefault();
    filters.query = document.getElementById("query").value;
    filters.location = document.getElementById("location").value;
    filters.salary = Number(document.getElementById("salary").value);
    updateResults();
  });
  document.addEventListener("change", event => {
    const target = event.target;
    if (target.dataset.select) {
      target.checked ? selected.add(target.dataset.select) : selected.delete(target.dataset.select);
      updateResults();
      document.querySelector(`[data-select="${target.dataset.select}"]`)?.focus();
    } else if (target.dataset.auto) {
      target.checked ? automatic.add(target.dataset.auto) : automatic.delete(target.dataset.auto);
      updateResults();
      document.querySelector(`[data-auto="${target.dataset.auto}"]`)?.focus();
    } else if (target.name === "mode") {
      mode = target.value;
      document.querySelectorAll(".mode-choice").forEach(choice => choice.classList.toggle("is-active", choice.querySelector("input").checked));
    } else if (target.id === "sort") {
      filters.sort = target.value;
      updateResults();
    } else if (target.id === "location" || target.id === "salary") {
      filters.location = document.getElementById("location").value;
      filters.salary = Number(document.getElementById("salary").value);
      updateResults();
    } else if (target.id === "visa-subclass") {
      filters.visaSubclass = target.value === "417" ? "417" : "462";
      saveSubclass(filters.visaSubclass);
      updateResults();
    } else if (target.id === "only-regional") {
      filters.onlyRegional88 = Boolean(target.checked);
      updateResults();
    }
  });
  document.addEventListener("click", event => {
    if (event.target.closest(".brand")) {
      event.preventDefault();
      view = "jobs";
      render();
      document.getElementById("page-title").focus();
      return;
    }
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.category) {
      const cat = button.dataset.category;
      if (filters.categories.includes(cat)) {
        filters.categories = filters.categories.filter(c => c !== cat);
      } else {
        filters.categories = [...filters.categories, cat];
      }
      render();
      document.querySelector(`[data-category="${cat}"]`)?.focus();
      return;
    }
    if (button.id === "pause-agent") {
      paused = !paused;
      render();
      document.getElementById("pause-agent").focus();
      notice(paused ? "IA pausada nesta prévia." : "IA retomada nesta prévia.");
    }
    if (button.id === "profile-button") {
      notice("Prévia: a configuração de perfil e regras será integrada antes de candidaturas reais.");
    }
    if (button.id === "clear-filters") {
      filters = { ...filters, query: "", location: "", salary: 0, categories: [], onlyRegional88: false, sort: "recent" };
      render();
    }
    if (button.dataset.apply) {
      openJobId = openJobId === button.dataset.apply ? "" : button.dataset.apply;
      updateResults();
      const menu = openJobId && document.getElementById(`options-${openJobId}`);
      const target = menu ? menu.firstElementChild : document.querySelector(`[data-apply="${button.dataset.apply}"]`);
      target?.focus({ preventScroll: true });
      menu?.lastElementChild.scrollIntoView({ block: "center", behavior: "instant" });
    }
    if (button.dataset.applyNow) {
      openJobId = "";
      updateResults();
      notice("Prévia: nenhuma candidatura automática foi enviada. Use o link 'Ver em ...' na vaga para abrir o anúncio original.");
    }
    if (button.dataset.toggleAuto) {
      automatic.has(button.dataset.toggleAuto) ? automatic.delete(button.dataset.toggleAuto) : automatic.add(button.dataset.toggleAuto);
      openJobId = "";
      updateResults();
      notice("Prévia: preferência automática alterada nesta vaga, sem envio real.");
    }
    if (button.id === "bulk-apply") {
      notice(`Prévia: ${mode === "auto" ? "modo automático preparado" : "ação imediata preparada"} para ${eligibleForBatch(jobs, selected).length} ${plural(eligibleForBatch(jobs, selected).length)} disponíveis, sem envio real.`);
    }
    if (button.dataset.view) {
      view = button.dataset.view;
      render();
      document.getElementById("page-title").focus();
    }
  });

  loadContractJobs();
}

if (typeof module !== "undefined") {
  module.exports = {
    filterJobs,
    eligibleForBatch,
    toViewJob,
    formatPay,
    escapeHtml,
    jobs,
    CATEGORIES
  };
}
