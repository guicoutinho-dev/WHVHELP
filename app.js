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
const PAGES_EMPLOYERS_URL = "https://guicoutinho-dev.github.io/WHVHELP/employers.json";
const LOCAL_EMPLOYERS_URL = "data/employers.json";

function resolveDataUrl(pagesUrl, localUrl, overrideKey) {
  if (typeof window === "undefined") return localUrl;
  if (overrideKey && window[overrideKey]) return window[overrideKey];
  const host = window.location?.hostname || "";
  const protocol = window.location?.protocol || "";
  if (protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "") {
    return localUrl;
  }
  return pagesUrl;
}

const JOBS_URL = resolveDataUrl(PAGES_JOBS_URL, LOCAL_JOBS_URL, "HELPWHV_JOBS_URL");
const EMPLOYERS_URL = resolveDataUrl(PAGES_EMPLOYERS_URL, LOCAL_EMPLOYERS_URL, "HELPWHV_EMPLOYERS_URL");

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

function toViewEmployer(record) {
  const city = record?.location?.city || "Não informada";
  const state = record?.location?.state || "";
  const postcode = record?.location?.postcode || null;
  const rawWebsite = safeExternalUrl(record?.website);

  return {
    id: String(record?.id || ""),
    name: record?.name || "Empresa sem nome",
    category: CATEGORIES.includes(record?.category) ? record.category : "Other",
    sourceCategory: record?.sourceCategory || "",
    address: record?.address || [city, state, postcode].filter(Boolean).join(", "),
    city,
    state,
    postcode,
    phone: typeof record?.phone === "string" && record.phone.trim() ? record.phone.trim() : null,
    website: rawWebsite === "#" ? null : rawWebsite,
    googleMapsUrl: safeExternalUrl(record?.googleMapsUrl),
    rating: typeof record?.rating === "number" ? record.rating : null,
    reviewCount: typeof record?.reviewCount === "number" ? record.reviewCount : null,
    regionalWork: record?.regionalWork || { "417": "unknown", "462": "unknown" }
  };
}

let jobs = [];
let employers = [];
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
  try {
    const empPayload = require("./data/employers.json");
    employers = Array.isArray(empPayload.employers) ? empPayload.employers.map(toViewEmployer) : [];
  } catch {
    employers = [];
  }
}

const selected = new Set();
const automatic = new Set();
let paused = false;
let mode = "now";
let view = "jobs";
let openJobId = "";
let noticeTimer = null;
let trayInView = false;
let trayObserver = null;

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

function formatAudRate(value) {
  return `A$ ${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatBatchSalary(chosen) {
  if (!Array.isArray(chosen) || chosen.length === 0) return "Não informado";
  const mins = [];
  const maxs = [];
  for (const job of chosen) {
    if (!job?.pay || job.pay.period !== "hour") continue;
    const low = job.pay.min ?? job.pay.max;
    const high = job.pay.max ?? job.pay.min;
    if (typeof low === "number" && Number.isFinite(low)) mins.push(low);
    if (typeof high === "number" && Number.isFinite(high)) maxs.push(high);
  }
  if (!mins.length || !maxs.length) return "Não informado";
  const minRate = Math.min(...mins);
  const maxRate = Math.max(...maxs);
  if (minRate === maxRate) {
    return `${formatAudRate(minRate)}/h`;
  }
  return `${formatAudRate(minRate)} – ${formatAudRate(maxRate)}/h`;
}

function formatScopeNote(actionable, inProgress = 0, hiddenCount = 0) {
  const actionableText =
    actionable === 1
      ? "A ação incluirá 1 vaga selecionada disponível."
      : `A ação incluirá ${actionable} vagas selecionadas disponíveis.`;
  const progressText = inProgress
    ? inProgress === 1
      ? " 1 vaga em andamento não será reenviada."
      : ` ${inProgress} vagas em andamento não serão reenviadas.`
    : "";
  const hiddenText = hiddenCount
    ? hiddenCount === 1
      ? " 1 vaga selecionada fora dos resultados filtrados."
      : ` ${hiddenCount} vagas selecionadas fora dos resultados filtrados.`
    : "";
  return `${actionableText}${progressText}${hiddenText}`;
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

function filterEmployers(list, criteria = {}) {
  const query = (criteria.query || "").trim().toLocaleLowerCase("pt-BR");
  const activeCategories = Array.isArray(criteria.categories) ? criteria.categories : [];
  const onlyRegional = Boolean(criteria.onlyRegional88);
  const subclass = criteria.visaSubclass === "417" ? "417" : "462";

  return list.filter(emp => {
    const searchable = `${emp.name} ${emp.city} ${emp.state} ${emp.postcode || ""} ${emp.category} ${emp.sourceCategory || ""} ${emp.address || ""}`.toLocaleLowerCase("pt-BR");
    if (query && !searchable.includes(query)) return false;
    if (criteria.location && emp.city !== criteria.location) return false;
    if (activeCategories.length > 0 && !activeCategories.includes(emp.category)) return false;
    if (onlyRegional && emp.regionalWork?.[subclass] !== "likely") return false;
    return true;
  });
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
    <symbol id="icon-tag" viewBox="0 0 24 24"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="8" cy="8" r="1.5"/></symbol>
    <symbol id="icon-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-3.4 3-5.1 7-5.1s6.4 1.7 7 5.1"/><circle cx="12" cy="12" r="10"/></symbol>
  </svg>`;
}

function bindTrailingWords(text) {
  const trimmed = String(text ?? "").trim();
  return trimmed.replace(/\s+(\S+)$/, "\u00A0$1");
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
  const safeEmployer = escapeHtml(job.employer || "Empregador não informado");
  const safeSummary = escapeHtml(bindTrailingWords(job.summary || ""));
  const safeLocation = escapeHtml(locationText);
  const safePay = escapeHtml(formatPay(job.pay));
  const safeCategoryAndType = escapeHtml(`${job.category} · ${job.type}`);
  const safePosted = escapeHtml(job.postedLabel);
  const safeSourceName = escapeHtml(job.sourceName);
  const safeSourceUrl = escapeHtml(job.sourceUrl);

  return `<article class="job-row${checked ? " is-selected" : ""}" data-id="${safeId}">
    <label class="job-checkbox"><input type="checkbox" data-select="${safeId}" ${checked ? "checked" : ""} aria-label="Selecionar ${safeTitle}"></label>
    <div class="job-copy">
      <div class="job-header">
        <h2>${safeTitle}</h2>
        <span class="job-employer">${safeEmployer}</span>
      </div>
      ${safeSummary ? `<p class="job-summary">${safeSummary}</p>` : ""}
      <p class="job-meta">
        <span>${icon("pin")}${safeLocation}</span>
        <span>${icon("coins")}${safePay}</span>
        <span>${icon("work")}${safeCategoryAndType}</span>
        <span>${icon("calendar")}${safePosted}</span>
      </p>
      <div class="job-badges">
        ${isRegionalLikely ? `<a class="badge-88" href="${officialUrl}" target="_blank" rel="noopener noreferrer" title="Estimativa por categoria e postcode para visto ${subclass}. Confira a regra oficial.">88 dias (${subclass}) · estimativa</a>` : ""}
        <a class="source-link" href="${safeSourceUrl}" target="_blank" rel="noopener noreferrer">Ver em ${safeSourceName} ↗</a>
      </div>
    </div>
    ${auto ? `<label class="auto-switch"><span>Automático</span><input type="checkbox" data-auto="${safeId}" checked aria-label="Automático para ${safeTitle}"></label>` : ""}
    ${job.status ? `<span class="row-status"><span class="spinner" aria-hidden="true"></span>${escapeHtml(job.status)} · prévia</span>` : `<button class="row-action" data-apply="${safeId}" type="button" aria-expanded="${open}" ${paused ? "disabled" : ""}>Candidatar com IA</button>`}
    ${open && !job.status ? `<div class="row-options" id="options-${safeId}"><button type="button" data-apply-now="${safeId}">Enviar agora · prévia</button><button type="button" data-toggle-auto="${safeId}">${auto ? "Desativar" : "Ativar"} automático nesta vaga</button></div>` : ""}
  </article>`;
}

function employerMarkup(emp) {
  const subclass = filters.visaSubclass === "417" ? "417" : "462";
  const isRegionalLikely = emp.regionalWork?.[subclass] === "likely";
  const officialUrl = OFFICIAL_88_URLS[subclass];
  const locationText = [emp.city, emp.state, emp.postcode].filter(Boolean).join(", ");
  const safeName = escapeHtml(emp.name);
  const safeAddress = escapeHtml(emp.address || locationText);
  const safeCategory = escapeHtml(emp.category);
  const safeMapsUrl = escapeHtml(emp.googleMapsUrl);
  const safePhone = emp.phone ? escapeHtml(emp.phone) : "";
  const safeTelHref = emp.phone ? escapeHtml(`tel:${emp.phone.replace(/[^+\d]/g, "")}`) : "";
  const ratingLabel = emp.rating !== null ? `★ ${emp.rating.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${emp.reviewCount ? ` (${emp.reviewCount})` : ""}` : "Sem avaliações";

  return `<article class="job-row employer-row" data-id="${escapeHtml(emp.id)}">
    <div class="job-copy">
      <div class="job-header">
        <h2>${safeName}</h2>
        <span class="job-employer">${escapeHtml(ratingLabel)}</span>
      </div>
      <p class="job-meta">
        <span>${icon("pin")}${safeAddress}</span>
        <span>${icon("work")}${safeCategory}</span>
        ${emp.phone ? `<span>📞 ${safePhone}</span>` : ""}
      </p>
      <div class="job-badges">
        ${isRegionalLikely ? `<a class="badge-88" href="${officialUrl}" target="_blank" rel="noopener noreferrer" title="Estimativa por categoria e postcode para visto ${subclass}. Confira a regra oficial.">88 dias (${subclass}) · estimativa</a>` : ""}
        ${emp.website ? `<a class="source-link" href="${escapeHtml(emp.website)}" target="_blank" rel="noopener noreferrer">Site oficial ↗</a>` : ""}
        ${emp.phone ? `<a class="source-link" href="${safeTelHref}">Ligar (${safePhone})</a>` : ""}
        <a class="source-link" href="${safeMapsUrl}" target="_blank" rel="noopener noreferrer">Ver no Google Maps ↗</a>
      </div>
    </div>
  </article>`;
}

function summaryMarkup() {
  const chosen = jobs.filter(job => selected.has(job.id));
  if (!chosen.length) {
    return `<p class="summary-empty">Marque vagas na lista ao lado para montar seu lote e comparar salários e cidades.</p>`;
  }
  const places = Array.from(new Set(chosen.map(job => `${job.city}${job.state ? ` (${job.state})` : ""}`)));
  const salaryText = formatBatchSalary(chosen);
  const categories = Array.from(new Set(chosen.map(job => job.category)));

  return `<p>${icon("work")}<span><strong>Cargos:</strong> ${escapeHtml(chosen.map(job => job.title).join(", "))}</span></p>
    <p>${icon("pin")}<span><strong>Cidades:</strong> ${escapeHtml(places.join(", "))}</span></p>
    <p>${icon("coins")}<span><strong>Salário:</strong> ${escapeHtml(salaryText)}</span></p>
    <p>${icon("tag")}<span><strong>Categorias:</strong> ${escapeHtml(categories.join(", "))}</span></p>`;
}

function categoryChipsMarkup() {
  const activeCount = filters.categories.length;
  return `<div class="whv-controls" aria-label="Filtros WHV por categoria e visto">
    <div class="category-chips" role="group" aria-label="Job Type (categorias WHV)">
      ${CATEGORIES.map(cat => {
        const active = filters.categories.includes(cat);
        return `<button type="button" class="category-chip${active ? " is-active" : ""}" data-category="${cat}" aria-pressed="${active}">${cat}</button>`;
      }).join("")}
      ${activeCount > 0 ? `<button type="button" class="category-chip category-clear" id="clear-categories">Limpar categorias (${activeCount})</button>` : ""}
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
  const activeSourceList = view === "employers" ? employers : jobs;
  const cities = distinctCities(activeSourceList);
  const updatedLabel = generatedAt ? `Atualizado em ${formatShortDate(generatedAt)}` : "Vagas WHV · Austrália";
  const pauseLabel = paused ? "Retomar IA" : "Pausar IA";

  return `${symbols()}
    <header class="topbar">
      <a class="brand" href="#vagas" aria-label="HelpWHV, ir para vagas"><span class="brand-sign" aria-hidden="true"><img src="assets/icons/kangaroo.svg" alt="" width="48" height="48"></span><span class="brand-name">HelpWHV</span></a>
      <nav class="primary-nav" aria-label="Navegação principal"><button class="nav-item${view === "jobs" ? " is-current" : ""}" data-view="jobs" type="button" ${view === "jobs" ? 'aria-current="page"' : ""}>${icon("search")}Vagas</button><button class="nav-item${view === "employers" ? " is-current" : ""}" data-view="employers" type="button" ${view === "employers" ? 'aria-current="page"' : ""}>${icon("pin")}Empregadores 88d</button><button class="nav-item${view === "applications" ? " is-current" : ""}" data-view="applications" type="button" ${view === "applications" ? 'aria-current="page"' : ""}>${icon("work")}Candidaturas</button></nav>
      <div class="topbar-actions"><span class="agent-state${paused ? " is-paused" : ""}" role="status"><span class="status-dot" aria-hidden="true"></span>${paused ? "Prévia pausada" : "IA em prévia"}</span><button class="pause-button${paused ? " is-paused" : ""}" id="pause-agent" type="button" aria-label="${pauseLabel}" aria-pressed="${paused}"><span class="pause-mark" aria-hidden="true"></span><span>${pauseLabel}</span></button><button class="profile-button" id="profile-button" type="button" aria-label="Perfil e regras">${icon("user")}</button></div>
    </header>
    <section class="intro" aria-labelledby="page-title"><span class="preview-tag">${updatedLabel}</span><h1 id="page-title" tabindex="-1">VAGAS DISPONÍVEIS</h1><p>Encontre vagas WHV na Austrália, filtre pelos 88 dias e acesse o anúncio original.</p><svg class="route-path" viewBox="0 0 510 80" preserveAspectRatio="none" aria-hidden="true"><path d="M4 55C55 63 70 44 120 42s87 34 144 18S325 7 369 13s77 35 137 25"/></svg><span class="route-pin" aria-hidden="true">${icon("pin")}</span><div class="road-sign" aria-hidden="true"><span>AUSTRALIA</span><i></i></div><img class="roadside-scrub" src="assets/plates/roadside-scrub.png" alt="" loading="lazy"></section>
    <main class="main-layout" id="vagas">
      <section class="jobs-area" aria-label="Busca e resultados de vagas">
        <form class="filterbar" id="search-form" role="search"><label class="search-field">${icon("search")}<span class="visually-hidden">Cargo ou palavra-chave</span><input id="query" type="search" placeholder="Cargo, empregador ou palavra-chave" autocomplete="off"></label><label class="filter-select">${icon("pin")}<span><strong>Local</strong><select id="location" aria-label="Local"><option value="">Todas as cidades</option>${cities.map(city => `<option value="${city}" ${filters.location === city ? "selected" : ""}>${city}</option>`).join("")}</select></span></label><label class="filter-select">${icon("coins")}<span><strong>Salário (A$/h)</strong><select id="salary" aria-label="Salário mínimo"><option value="0">Qualquer valor</option><option value="28">A partir de A$ 28</option><option value="30">A partir de A$ 30</option><option value="35">A partir de A$ 35</option></select></span></label><button class="search-button" type="submit">${icon("search")}Buscar vagas</button></form>
        ${categoryChipsMarkup()}
        <div class="result-tools"><div class="result-Tools-left"><strong id="result-count"></strong><button type="button" class="text-action-btn" id="toggle-select-visible">Selecionar visíveis</button></div><label class="sort-control">Ordenar por: <select id="sort" aria-label="Ordenar vagas"><option value="recent">Mais recentes</option><option value="salary">Maior salário</option><option value="title">Cargo A–Z</option></select></label></div>
        <div class="job-list" id="job-list" aria-live="polite"></div>
      </section>
      <aside class="selection-tray" id="lote" aria-labelledby="tray-title"><div class="tray-header"><h2 id="tray-title"><span id="selected-count">0</span> <span id="selected-label">VAGAS SELECIONADAS</span></h2><button type="button" class="text-action-btn" id="clear-selection" hidden>Limpar</button></div><p class="tray-subtitle">Ação em lote (somente nestas vagas)</p><div class="selection-summary" id="selection-summary"></div><fieldset class="mode-fieldset"><legend>Modo de envio</legend><label class="mode-choice${mode === "now" ? " is-active" : ""}"><input type="radio" name="mode" value="now" ${mode === "now" ? "checked" : ""}><span><strong>Enviar agora</strong><small>Na prévia, a IA prepararia candidaturas para <span class="mode-count">0</span> <span class="mode-label">vagas disponíveis</span>.</small></span></label><label class="mode-choice${mode === "auto" ? " is-active" : ""}"><input type="radio" name="mode" value="auto" ${mode === "auto" ? "checked" : ""}><span><strong>Automático</strong><small>Na prévia, a IA acompanharia novas vagas selecionadas até você pausar.</small></span></label></fieldset><button class="bulk-button" id="bulk-apply" type="button">${icon("send")}PEDIR À IA PARA CANDIDATAR</button><p class="scope-note" id="scope-note"></p></aside>
    </main>
    <a class="mobile-batch-bar" id="mobile-batch-bar" href="#lote" hidden><span><strong id="mobile-selected-count">0</strong> <span id="mobile-selected-label">vagas selecionadas</span></span><span>Ver lote <span aria-hidden="true">→</span></span></a>
    <div class="notice" id="notice" role="status" aria-live="polite" hidden></div>`;
}

function syncMobileBatchBar() {
  const bar = document.getElementById("mobile-batch-bar");
  if (!bar) return;
  if (view === "applications" || selected.size === 0 || trayInView) {
    bar.hidden = true;
  } else {
    bar.hidden = false;
  }
}

function observeSelectionTray() {
  if (typeof IntersectionObserver === "undefined") return;
  if (trayObserver) {
    trayObserver.disconnect();
  }
  const trayEl = document.getElementById("lote");
  if (!trayEl || trayEl.hidden) return;
  trayObserver = new IntersectionObserver(
    entries => {
      trayInView = Boolean(entries[0]?.isIntersecting);
      syncMobileBatchBar();
    },
    { threshold: 0.15 }
  );
  trayObserver.observe(trayEl);
}

function updateResults() {
  const listEl = document.getElementById("job-list");
  if (!listEl) return;

  if (view === "employers") {
    const visibleEmp = filterEmployers(employers, filters);
    listEl.innerHTML = visibleEmp.length
      ? visibleEmp.map(employerMarkup).join("")
      : `<div class="empty-results"><h2>Nenhum empregador encontrado</h2><p>Tente outra palavra ou limpe os filtros.</p><button id="clear-filters" type="button">Limpar filtros</button></div>`;
    document.getElementById("result-count").textContent = `${visibleEmp.length} ${visibleEmp.length === 1 ? "empregador encontrado" : "empregadores encontrados"}`;
    const toggleBtn = document.getElementById("toggle-select-visible");
    if (toggleBtn) toggleBtn.hidden = true;
    return;
  }

  if (loadingState === "loading") {
    listEl.innerHTML = `<div class="empty-results"><h2>Carregando vagas...</h2><p>Buscando vagas atualizadas na Austrália.</p></div>`;
    document.getElementById("result-count").textContent = "Carregando...";
    const toggleBtn = document.getElementById("toggle-select-visible");
    if (toggleBtn) toggleBtn.hidden = true;
    return;
  }

  if (loadingState === "error") {
    listEl.innerHTML = `<div class="empty-results"><h2>Não foi possível carregar as vagas</h2><p>Verifique a conexão ou tente recarregar as vagas.</p><button id="retry-load" type="button">Tentar novamente</button></div>`;
    document.getElementById("result-count").textContent = "0 vagas encontradas";
    const toggleBtn = document.getElementById("toggle-select-visible");
    if (toggleBtn) toggleBtn.hidden = true;
    return;
  }

  const visible = filterJobs(jobs, filters);
  listEl.innerHTML = visible.length
    ? visible.map(jobMarkup).join("")
    : `<div class="empty-results"><h2>Nenhuma vaga encontrada</h2><p>Tente outra palavra ou limpe os filtros.</p><button id="clear-filters" type="button">Limpar filtros</button></div>`;
  document.getElementById("result-count").textContent = `${visible.length} ${plural(visible.length)} ${visible.length === 1 ? "encontrada" : "encontradas"}`;

  const toggleBtn = document.getElementById("toggle-select-visible");
  if (toggleBtn) {
    toggleBtn.hidden = visible.length === 0;
    const allVisibleSelected = visible.length > 0 && visible.every(job => selected.has(job.id));
    toggleBtn.textContent = allVisibleSelected ? "Desmarcar visíveis" : "Selecionar visíveis";
  }

  const count = selected.size;
  const actionable = eligibleForBatch(jobs, selected).length;
  const inProgress = count - actionable;
  const hiddenCount = [...selected].filter(id => !visible.some(job => job.id === id)).length;

  document.getElementById("selected-count").textContent = count;
  const selectedLabelEl = document.getElementById("selected-label");
  if (selectedLabelEl) {
    selectedLabelEl.textContent = count === 1 ? "VAGA SELECIONADA" : "VAGAS SELECIONADAS";
  }
  const clearSelectionBtn = document.getElementById("clear-selection");
  if (clearSelectionBtn) {
    clearSelectionBtn.hidden = count === 0;
  }

  document.getElementById("mobile-selected-count").textContent = count;
  const mobileLabelEl = document.getElementById("mobile-selected-label");
  if (mobileLabelEl) {
    mobileLabelEl.textContent = count === 1 ? "vaga selecionada" : "vagas selecionadas";
  }

  document.getElementById("selection-summary").innerHTML = summaryMarkup();
  document.querySelector(".mode-count").textContent = actionable;
  const modeLabelEl = document.querySelector(".mode-label");
  if (modeLabelEl) {
    modeLabelEl.textContent = actionable === 1 ? "vaga disponível" : "vagas disponíveis";
  }

  document.getElementById("scope-note").textContent = formatScopeNote(actionable, inProgress, hiddenCount);
  document.getElementById("bulk-apply").disabled = actionable === 0 || paused;
  syncMobileBatchBar();
}

function hideNotice() {
  if (noticeTimer) {
    clearTimeout(noticeTimer);
    noticeTimer = null;
  }
  const element = document.getElementById("notice");
  if (element) {
    element.hidden = true;
  }
}

function notice(message) {
  const element = document.getElementById("notice");
  if (!element) return;
  if (noticeTimer) {
    clearTimeout(noticeTimer);
  }
  element.innerHTML = `<span class="notice-text">${escapeHtml(message)}</span><button type="button" class="notice-close" id="close-notice" aria-label="Fechar aviso">×</button>`;
  element.hidden = false;
  noticeTimer = setTimeout(() => {
    element.hidden = true;
    noticeTimer = null;
  }, 6000);
}

function render() {
  document.getElementById("app").innerHTML = shellMarkup();
  if (view === "applications") {
    document.title = "Candidaturas · HelpWHV";
    document.getElementById("page-title").textContent = "CANDIDATURAS";
    document.querySelector(".intro p").textContent = "Acompanhe o que a IA preparou e enviou.";
    document.querySelector(".main-layout").classList.add("applications-view");
    document.querySelector(".jobs-area").innerHTML = `<section class="applications-empty" aria-labelledby="applications-title"><h2 id="applications-title">Nenhuma candidatura real ainda</h2><p>As vagas listadas são reais, mas o envio automático por IA ainda está em prévia. Use o link de cada vaga para abrir o anúncio original.</p><button type="button" data-view="jobs">Explorar vagas</button></section>`;
    document.querySelector(".selection-tray").hidden = true;
    document.getElementById("mobile-batch-bar").hidden = true;
  } else if (view === "employers") {
    document.title = "Empregadores 88d · HelpWHV";
    document.getElementById("page-title").textContent = "EMPREGADORES 88 DIAS";
    document.querySelector(".intro p").textContent = "Diretório de fazendas, packhouses e resorts regionais no Google Maps para contato direto (não confirma vaga aberta no momento).";
    document.querySelector(".main-layout").classList.add("applications-view");
    document.querySelector(".selection-tray").hidden = true;
    document.getElementById("mobile-batch-bar").hidden = true;
    const salarySelect = document.getElementById("salary")?.closest(".filter-select");
    if (salarySelect) salarySelect.hidden = true;
    const sortControl = document.querySelector(".sort-control");
    if (sortControl) sortControl.hidden = true;
    document.getElementById("query").value = filters.query;
    updateResults();
  } else {
    document.title = "Vagas disponíveis · HelpWHV";
    document.getElementById("query").value = filters.query;
    document.getElementById("salary").value = String(filters.salary);
    document.getElementById("sort").value = filters.sort;
    trayInView = false;
    updateResults();
    observeSelectionTray();
  }
}

async function fetchWithLocalFallback(primaryUrl, fallbackUrl) {
  try {
    const res = await fetch(primaryUrl);
    if (res.ok) return await res.json();
  } catch {
    // try fallback
  }
  if (primaryUrl !== fallbackUrl) {
    const fallback = await fetch(fallbackUrl);
    if (fallback.ok) return await fallback.json();
  }
  throw new Error("Failed to fetch data");
}

async function loadContractJobs() {
  loadingState = "loading";
  render();
  try {
    const [jobsPayload, empPayload] = await Promise.all([
      fetchWithLocalFallback(JOBS_URL, LOCAL_JOBS_URL),
      fetchWithLocalFallback(EMPLOYERS_URL, LOCAL_EMPLOYERS_URL).catch(() => ({ employers: [] }))
    ]);
    generatedAt = jobsPayload.generatedAt || null;
    jobs = Array.isArray(jobsPayload.jobs) ? jobsPayload.jobs.map(toViewJob) : [];
    employers = Array.isArray(empPayload.employers) ? empPayload.employers.map(toViewEmployer) : [];
    loadingState = "ready";
    render();
  } catch {
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
  document.addEventListener("input", event => {
    if (event.target.id === "query") {
      filters.query = event.target.value;
      updateResults();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (openJobId) {
        const currentId = openJobId;
        openJobId = "";
        updateResults();
        document.querySelector(`[data-apply="${currentId}"]`)?.focus();
      }
      hideNotice();
    }
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
    if (button.id === "close-notice") {
      hideNotice();
      return;
    }
    if (button.id === "retry-load") {
      loadContractJobs();
      return;
    }
    if (button.id === "clear-categories") {
      filters.categories = [];
      render();
      document.querySelector(".category-chip")?.focus();
      return;
    }
    if (button.id === "clear-selection") {
      selected.clear();
      updateResults();
      return;
    }
    if (button.id === "toggle-select-visible") {
      const visible = filterJobs(jobs, filters);
      const allVisibleSelected = visible.length > 0 && visible.every(job => selected.has(job.id));
      for (const job of visible) {
        if (allVisibleSelected) {
          selected.delete(job.id);
        } else {
          selected.add(job.id);
        }
      }
      updateResults();
      return;
    }
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
      const actionableCount = eligibleForBatch(jobs, selected).length;
      notice(`Prévia: ${mode === "auto" ? "modo automático preparado" : "ação imediata preparada"} para ${actionableCount} ${actionableCount === 1 ? "vaga disponível" : "vagas disponíveis"}, sem envio real.`);
    }
    if (button.dataset.view) {
      view = button.dataset.view;
      const availableCities = distinctCities(view === "employers" ? employers : jobs);
      if (filters.location && !availableCities.includes(filters.location)) {
        filters.location = "";
      }
      render();
      document.getElementById("page-title").focus();
    }
  });

  loadContractJobs();
}

if (typeof module !== "undefined") {
  module.exports = {
    filterJobs,
    filterEmployers,
    eligibleForBatch,
    toViewJob,
    toViewEmployer,
    formatPay,
    formatBatchSalary,
    formatScopeNote,
    jobMarkup,
    employerMarkup,
    escapeHtml,
    jobs,
    employers,
    CATEGORIES
  };
}
