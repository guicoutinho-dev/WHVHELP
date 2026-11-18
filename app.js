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

const OFFICIAL_REGIONAL_URLS = Object.freeze({
  "417": "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/work-holiday-417/specified-work",
  "462": "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/work-holiday-462/specified-462-work"
});

const PAGES_JOBS_URL = "data/jobs.json";
const LOCAL_JOBS_URL = "data/jobs.json";
const PAGES_EMPLOYERS_URL = "data/employers.json";
const LOCAL_EMPLOYERS_URL = "data/employers.json";
const PAGES_ACCOMMODATION_URL = "data/accommodation.json";
const LOCAL_ACCOMMODATION_URL = "data/accommodation.json";

const STAY_TYPES = Object.freeze([
  "Working Hostel",
  "Backpacker Hostel",
  "Caravan & Cabin Park",
  "Farm Stay"
]);

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
const ACCOMMODATION_URL = resolveDataUrl(PAGES_ACCOMMODATION_URL, LOCAL_ACCOMMODATION_URL, "HELPWHV_ACCOMMODATION_URL");

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

function toViewStay(record) {
  const city = record?.location?.city || "Não informada";
  const state = record?.location?.state || "";
  const postcode = record?.location?.postcode || null;
  const rawWebsite = safeExternalUrl(record?.website);

  return {
    id: String(record?.id || ""),
    name: record?.name || "Hospedagem sem nome",
    stayType: STAY_TYPES.includes(record?.stayType) ? record.stayType : "Backpacker Hostel",
    address: record?.address || [city, state, postcode].filter(Boolean).join(", "),
    city,
    state,
    postcode,
    phone: typeof record?.phone === "string" && record.phone.trim() ? record.phone.trim() : null,
    website: rawWebsite === "#" ? null : rawWebsite,
    googleMapsUrl: safeExternalUrl(record?.googleMapsUrl),
    rating: typeof record?.rating === "number" ? record.rating : null,
    reviewCount: typeof record?.reviewCount === "number" ? record.reviewCount : null,
    inRegionalZone: Boolean(record?.inRegionalZone)
  };
}

let jobs = [];
let employers = [];
let stays = [];
let generatedAt = null;
let loadingState = "ready";

const DEFAULT_PROFILE = Object.freeze({
  fullName: "",
  visaSubclass: "462",
  availableFrom: "Imediata",
  experienceSummary: "",
  minHourlyWage: 28,
  allowMissingSalary: true,
  requireRegional88: false,
  allowedCategories: [],
  rulesApproved: false
});

function buildApplicationPitch(job, profile = DEFAULT_PROFILE) {
  const name = (profile?.fullName || "").trim() || "Candidato(a) WHV";
  const subclass = profile?.visaSubclass === "417" ? "417" : "462";
  const avail = (profile?.availableFrom || "").trim() || "Imediata";
  const exp = (profile?.experienceSummary || "").trim();
  const employer = job?.employer && job.employer !== "Empregador não informado" ? job.employer : "equipe";
  const location = [job?.city, job?.state].filter(v => v && v !== "Não informada").join(", ");

  const lines = [
    `Olá, ${employer}! Meu nome é ${name}, possuo visto Working Holiday (Subclass ${subclass}) com permissão integral de trabalho na Austrália e disponibilidade ${avail.toLowerCase()}.`,
    `Tenho interesse na vaga de ${job?.title || "trabalho"}${location ? ` em ${location}` : ""}.`
  ];
  if (exp) {
    lines.push(`Experiência: ${exp}`);
  }
  lines.push("Posso enviar meu CV completo e iniciar conforme a necessidade do turno.");
  return lines.join(" ");
}

function evaluateJobForProfile(job, profile = DEFAULT_PROFILE) {
  const subclass = profile?.visaSubclass === "417" ? "417" : "462";
  const allowedCategories = Array.isArray(profile?.allowedCategories) ? profile.allowedCategories : [];
  const minHourly = Number(profile?.minHourlyWage || 0);
  const allowMissingSalary = profile?.allowMissingSalary !== false;
  const requireRegional88 = Boolean(profile?.requireRegional88);

  if (allowedCategories.length > 0 && !allowedCategories.includes(job?.category)) {
    return {
      allowed: false,
      status: "Não enviada · regra",
      reason: `Categoria ${job?.category || "Other"} fora das categorias autorizadas no seu perfil.`,
      pitch: null
    };
  }

  if (requireRegional88) {
    const regStatus = job?.regionalWork?.[subclass] || "unknown";
    if (regStatus === "unlikely") {
      return {
        allowed: false,
        status: "Não enviada · regra",
        reason: `Vaga não elegível para trabalho regional do visto ${subclass}.`,
        pitch: null
      };
    }
    if (regStatus !== "likely") {
      return {
        allowed: false,
        status: "Não enviada · dado insuficiente",
        reason: `A vaga não informa postcode suficiente para confirmar elegibilidade regional (${subclass}).`,
        pitch: null
      };
    }
  }

  if (minHourly > 0) {
    const pay = job?.pay;
    const hasHourly = pay && pay.period === "hour" && (pay.max !== null || pay.min !== null);
    if (!hasHourly) {
      if (!allowMissingSalary) {
        return {
          allowed: false,
          status: "Não enviada · dado insuficiente",
          reason: "A vaga não informa valor por hora (A$/h) e sua regra exige salário confirmado.",
          pitch: null
        };
      }
    } else {
      const rate = Number(pay.max ?? pay.min);
      if (rate < minHourly) {
        return {
          allowed: false,
          status: "Não enviada · regra",
          reason: `Salário da vaga (A$ ${rate.toFixed(2)}/h) abaixo do mínimo aprovado (A$ ${minHourly.toFixed(2)}/h).`,
          pitch: null
        };
      }
    }
  }

  return {
    allowed: true,
    status: "Preparada",
    reason: `Regras aprovadas conferidas (visto ${subclass}). Pronta para concluir no anúncio original.`,
    pitch: buildApplicationPitch(job, profile)
  };
}

function buildMailtoHref({ title, employer, pitch, email = "" } = {}) {
  const safeRecipient = typeof email === "string" ? email.trim() : "";
  const subject = `WHV Application — ${title || "Job Opening"}${employer ? ` (${employer})` : ""}`;
  const body = pitch || "";
  return `mailto:${encodeURIComponent(safeRecipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function applyProfileRulesToJobs(targetJobs, profile, nowIso = new Date().toISOString()) {
  const records = [];
  for (const job of targetJobs || []) {
    const evaluation = evaluateJobForProfile(job, profile);
    job.status = evaluation.status;
    records.push({
      jobId: job.id,
      title: job.title,
      employer: job.employer || "Empregador não informado",
      category: job.category || "Other",
      city: job.city || "Não informada",
      state: job.state || "",
      sourceName: job.sourceName || "Fonte externa",
      sourceUrl: job.sourceUrl || "#",
      status: evaluation.status,
      reason: evaluation.reason,
      pitch: evaluation.pitch,
      updatedAt: nowIso
    });
  }
  return records;
}

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
  try {
    const accPayload = require("./data/accommodation.json");
    stays = Array.isArray(accPayload.stays) ? accPayload.stays.map(toViewStay) : [];
  } catch {
    stays = [];
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
let profileModalOpen = false;
let pendingApplyJobIds = [];
let appStatusFilter = "all";

function readSavedProfile() {
  try {
    const raw = typeof localStorage !== "undefined" && localStorage.getItem("helpwhv_profile_v1");
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

function saveProfile(nextProfile) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("helpwhv_profile_v1", JSON.stringify(nextProfile));
    }
  } catch {
    // ignore storage errors
  }
}

function readSavedApplications() {
  try {
    const raw = typeof localStorage !== "undefined" && localStorage.getItem("helpwhv_applications_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveApplications(list) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("helpwhv_applications_v1", JSON.stringify(list));
    }
  } catch {
    // ignore storage errors
  }
}

let userProfile = readSavedProfile();
let applications = readSavedApplications();

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

const PAGE_SIZE = 24;
let currentPage = 1;

let filters = {
  query: "",
  location: "",
  salary: 0,
  categories: [],
  stayTypes: [],
  onlyRegional: false,
  visaSubclass: readSavedSubclass(),
  sort: "recent"
};

const icon = (name, className = "icon") =>
  `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
const plural = count => (count === 1 ? "vaga" : "vagas");

function paginate(items, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * pageSize;
  return {
    slice: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    totalItems: items.length
  };
}

function paginationMarkup(page, totalPages, totalItems, label) {
  if (totalPages <= 1) return "";
  const maxVisible = 5;
  let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  const buttons = [];
  buttons.push(`<button type="button" class="page-btn" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="Página anterior">←</button>`);
  if (startPage > 1) {
    buttons.push(`<button type="button" class="page-btn" data-page="1">1</button>`);
    if (startPage > 2) buttons.push(`<span class="page-ellipsis">…</span>`);
  }
  for (let i = startPage; i <= endPage; i++) {
    buttons.push(`<button type="button" class="page-btn${i === page ? " is-active" : ""}" data-page="${i}">${i}</button>`);
  }
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) buttons.push(`<span class="page-ellipsis">…</span>`);
    buttons.push(`<button type="button" class="page-btn" data-page="${totalPages}">${totalPages}</button>`);
  }
  buttons.push(`<button type="button" class="page-btn" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="Próxima página">→</button>`);
  return `<nav class="pagination" aria-label="Paginação de ${label}"><span class="page-info">Página ${page} de ${totalPages} (${totalItems} ${label})</span><div class="page-buttons">${buttons.join("")}</div></nav>`;
}

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
  const onlyRegional = Boolean(criteria.onlyRegional ?? criteria.onlyRegional88);
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
  const onlyRegional = Boolean(criteria.onlyRegional ?? criteria.onlyRegional88);
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

function filterStays(list, criteria = {}) {
  const query = (criteria.query || "").trim().toLocaleLowerCase("pt-BR");
  const activeTypes = Array.isArray(criteria.stayTypes) ? criteria.stayTypes : [];
  const onlyRegional = Boolean(criteria.onlyRegional ?? criteria.onlyRegional88);

  return list.filter(stay => {
    const searchable = `${stay.name} ${stay.city} ${stay.state} ${stay.postcode || ""} ${stay.stayType} ${stay.address || ""}`.toLocaleLowerCase("pt-BR");
    if (query && !searchable.includes(query)) return false;
    if (criteria.location && stay.city !== criteria.location) return false;
    if (activeTypes.length > 0 && !activeTypes.includes(stay.stayType)) return false;
    if (onlyRegional && !stay.inRegionalZone) return false;
    return true;
  });
}

function isBlockingStatus(status) {
  return Boolean(status && !status.startsWith("Não enviada"));
}

function eligibleForBatch(list, chosenIds) {
  return list.filter(job => chosenIds.has(job.id) && !isBlockingStatus(job.status));
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
    <symbol id="icon-phone" viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.1 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7A2 2 0 0 1 22 16.9Z"/></symbol>
    <symbol id="icon-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
    <symbol id="icon-chevron" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
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
  const officialUrl = OFFICIAL_REGIONAL_URLS[subclass];
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
        ${isRegionalLikely ? `<a class="badge-regional" href="${officialUrl}" target="_blank" rel="noopener noreferrer" title="Estimativa por categoria e postcode para visto ${subclass}. Confira a regra oficial.">Regional (${subclass}) · estimativa</a>` : ""}
        ${job.status && job.status.startsWith("Não enviada") ? `<span class="row-status is-blocked">${escapeHtml(job.status)}</span>` : ""}
        <a class="source-link" href="${safeSourceUrl}" target="_blank" rel="noopener noreferrer">Ver em ${safeSourceName} ↗</a>
      </div>
    </div>
    ${auto ? `<label class="auto-switch"><span>Automático</span><input type="checkbox" data-auto="${safeId}" checked aria-label="Automático para ${safeTitle}"></label>` : ""}
    ${isBlockingStatus(job.status) ? `<span class="row-status"><span class="spinner" aria-hidden="true"></span>${escapeHtml(job.status)}</span>` : `<button class="row-action" data-apply="${safeId}" type="button" aria-expanded="${open}" ${paused ? "disabled" : ""}>${job.status ? "Reavaliar com IA" : "Candidatar com IA"}</button>`}
    ${open && !isBlockingStatus(job.status) ? `<div class="row-options" id="options-${safeId}"><button type="button" data-apply-now="${safeId}">Avaliar e preparar agora</button><button type="button" data-toggle-auto="${safeId}">${auto ? "Desativar" : "Ativar"} automático nesta vaga</button></div>` : ""}
  </article>`;
}

function employerMarkup(emp) {
  const subclass = filters.visaSubclass === "417" ? "417" : "462";
  const isRegionalLikely = emp.regionalWork?.[subclass] === "likely";
  const officialUrl = OFFICIAL_REGIONAL_URLS[subclass];
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
        ${emp.phone ? `<span>${icon("phone")}${safePhone}</span>` : ""}
      </p>
      ${isRegionalLikely ? `<div class="job-badges"><a class="badge-regional" href="${officialUrl}" target="_blank" rel="noopener noreferrer" title="Estimativa por categoria e postcode para visto ${subclass}. Confira a regra oficial.">Regional (${subclass}) · estimativa</a></div>` : ""}
    </div>
    <div class="row-links">
      ${emp.website ? `<a class="source-link" href="${escapeHtml(emp.website)}" target="_blank" rel="noopener noreferrer">Site oficial ↗</a>` : ""}
      ${emp.phone ? `<a class="source-link" href="${safeTelHref}">Ligar (${safePhone})</a>` : ""}
      <a class="source-link" href="${safeMapsUrl}" target="_blank" rel="noopener noreferrer">Ver no Google Maps ↗</a>
    </div>
  </article>`;
}

function stayMarkup(stay) {
  const locationText = [stay.city, stay.state, stay.postcode].filter(Boolean).join(", ");
  const safeName = escapeHtml(stay.name);
  const safeAddress = escapeHtml(stay.address || locationText);
  const safeType = escapeHtml(stay.stayType);
  const safeMapsUrl = escapeHtml(stay.googleMapsUrl);
  const safePhone = stay.phone ? escapeHtml(stay.phone) : "";
  const safeTelHref = stay.phone ? escapeHtml(`tel:${stay.phone.replace(/[^+\d]/g, "")}`) : "";
  const ratingLabel = stay.rating !== null ? `★ ${stay.rating.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${stay.reviewCount ? ` (${stay.reviewCount})` : ""}` : "Sem avaliações";

  return `<article class="job-row employer-row stay-row" data-id="${escapeHtml(stay.id)}">
    <div class="job-copy">
      <div class="job-header">
        <h2>${safeName}</h2>
        <span class="job-employer">${escapeHtml(ratingLabel)}</span>
      </div>
      <p class="job-meta">
        <span>${icon("pin")}${safeAddress}</span>
        <span>${icon("tag")}${safeType}</span>
        ${stay.phone ? `<span>${icon("phone")}${safePhone}</span>` : ""}
      </p>
      ${stay.inRegionalZone ? `<div class="job-badges"><span class="badge-regional">Zona regional</span></div>` : ""}
    </div>
    <div class="row-links">
      ${stay.website ? `<a class="source-link" href="${escapeHtml(stay.website)}" target="_blank" rel="noopener noreferrer">Site / Reserva ↗</a>` : ""}
      ${stay.phone ? `<a class="source-link" href="${safeTelHref}">Ligar (${safePhone})</a>` : ""}
      <a class="source-link" href="${safeMapsUrl}" target="_blank" rel="noopener noreferrer">Ver no Google Maps ↗</a>
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
  if (view === "accommodation") {
    const activeStayCount = filters.stayTypes.length;
    return `<div class="whv-controls" aria-label="Filtros de hospedagem WHV">
      <div class="category-chips" role="group" aria-label="Tipo de hospedagem WHV">
        ${STAY_TYPES.map(st => {
          const active = filters.stayTypes.includes(st);
          return `<button type="button" class="category-chip${active ? " is-active" : ""}" data-stay-type="${st}" aria-pressed="${active}">${st}</button>`;
        }).join("")}
        ${activeStayCount > 0 ? `<button type="button" class="category-chip category-clear" id="clear-categories">Limpar tipos (${activeStayCount})</button>` : ""}
      </div>
      <div class="regional-toolbar">
        <label class="regional-toggle${filters.onlyRegional ? " is-active" : ""}">
          <input type="checkbox" id="only-regional" ${filters.onlyRegional ? "checked" : ""}>
          <span>Apenas hospedagens em zona regional</span>
        </label>
      </div>
    </div>`;
  }
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
      <div class="subclass-segmented" role="group" aria-label="Subclass do visto WHV">
        <span class="toolbar-label">Visto WHV</span>
        <div class="segmented-track">
          <button type="button" class="segmented-btn${filters.visaSubclass === "462" ? " is-active" : ""}" data-subclass="462" aria-pressed="${filters.visaSubclass === "462"}">Subclass 462 · Work &amp; Holiday</button>
          <button type="button" class="segmented-btn${filters.visaSubclass === "417" ? " is-active" : ""}" data-subclass="417" aria-pressed="${filters.visaSubclass === "417"}">Subclass 417 · Working Holiday</button>
        </div>
      </div>
      <label class="regional-toggle${filters.onlyRegional ? " is-active" : ""}">
        <input type="checkbox" id="only-regional" ${filters.onlyRegional ? "checked" : ""}>
        <span>Apenas elegíveis trabalho regional (estimativa)</span>
      </label>
    </div>
  </div>`;
}

function profileModalMarkup() {
  if (!profileModalOpen) return "";
  return `<div class="profile-modal-backdrop" id="profile-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
    <form class="profile-modal" id="profile-form">
      <div class="profile-modal-header">
        <h2 id="profile-modal-title">PERFIL WHV E REGRAS DA IA</h2>
        <button type="button" class="text-action-btn" id="close-profile-modal">Fechar</button>
      </div>
      <p class="profile-modal-sub">${escapeHtml(bindTrailingWords("Defina seu perfil e aprove as regras que a IA deve conferir antes de preparar qualquer candidatura."))}</p>
      <div class="profile-grid">
        <label class="profile-field"><span>Seu nome</span><input type="text" id="prof-name" value="${escapeHtml(userProfile.fullName)}" placeholder="Ex.: Lucas Silva"></label>
        <label class="profile-field"><span>Visto WHV</span><select id="prof-subclass"><option value="462" ${userProfile.visaSubclass === "462" ? "selected" : ""}>Subclass 462</option><option value="417" ${userProfile.visaSubclass === "417" ? "selected" : ""}>Subclass 417</option></select></label>
        <label class="profile-field"><span>Disponibilidade</span><input type="text" id="prof-avail" value="${escapeHtml(userProfile.availableFrom)}" placeholder="Ex.: Imediata"></label>
        <label class="profile-field"><span>Salário mínimo (A$/h)</span><input type="number" id="prof-min-wage" min="0" step="0.5" value="${Number(userProfile.minHourlyWage || 0)}"></label>
      </div>
      <label class="profile-field"><span>Resumo de experiência / CV curto</span><textarea id="prof-exp" rows="3" placeholder="Ex.: Experiência em café/hospitality, colheita e trabalho em equipe.">${escapeHtml(userProfile.experienceSummary)}</textarea></label>
      <div class="profile-checks">
        <label class="regional-toggle"><input type="checkbox" id="prof-allow-missing-pay" ${userProfile.allowMissingSalary ? "checked" : ""}><span>Permitir vagas que não informam salário no anúncio</span></label>
        <label class="regional-toggle"><input type="checkbox" id="prof-require-regional" ${userProfile.requireRegional88 ? "checked" : ""}><span>Exigir que a vaga conte para trabalho regional (estimativa)</span></label>
        <label class="regional-toggle"><input type="checkbox" id="prof-approved" ${userProfile.rulesApproved ? "checked" : ""}><span><strong>Aprovo estas regras de autonomia para avaliar minhas vagas</strong></span></label>
      </div>
      <div class="profile-modal-actions">
        <button type="submit" class="search-button">Salvar perfil e aprovar regras</button>
      </div>
    </form>
  </div>`;
}

function applicationsViewMarkup() {
  if (!applications.length) {
    return `<section class="applications-empty" aria-labelledby="applications-title">
      <h2 id="applications-title">Nenhuma candidatura avaliada ainda</h2>
      <p>Selecione vagas na aba Vagas e clique em <strong>Candidatar com IA</strong> para conferir suas regras e gerar sua apresentação.</p>
      <div class="empty-actions">
        <button type="button" data-view="jobs">Explorar vagas</button>
        <button type="button" id="open-profile-from-empty" class="text-action-btn">Configurar perfil e regras</button>
      </div>
    </section>`;
  }

  const filtered = applications.filter(app => {
    if (appStatusFilter === "prepared") return app.status === "Preparada";
    if (appStatusFilter === "sent") return app.status === "Enviada";
    if (appStatusFilter === "blocked") return app.status.startsWith("Não enviada");
    return true;
  });

  return `<section class="applications-dashboard" aria-label="Painel de candidaturas">
    <div class="whv-controls applications-toolbar">
      <div class="category-chips" role="group" aria-label="Filtrar candidaturas por estado">
        <button type="button" class="category-chip${appStatusFilter === "all" ? " is-active" : ""}" data-app-filter="all">Todas (${applications.length})</button>
        <button type="button" class="category-chip${appStatusFilter === "prepared" ? " is-active" : ""}" data-app-filter="prepared">Preparadas (${applications.filter(a => a.status === "Preparada").length})</button>
        <button type="button" class="category-chip${appStatusFilter === "sent" ? " is-active" : ""}" data-app-filter="sent">Enviadas (${applications.filter(a => a.status === "Enviada").length})</button>
        <button type="button" class="category-chip${appStatusFilter === "blocked" ? " is-active" : ""}" data-app-filter="blocked">Não enviadas (${applications.filter(a => a.status.startsWith("Não enviada")).length})</button>
      </div>
      <button type="button" class="text-action-btn" id="edit-rules-btn">Ajustar regras da IA</button>
    </div>
    <div class="job-list">
      ${filtered.map(app => `
        <article class="job-row employer-row application-card" data-app-id="${escapeHtml(app.jobId)}">
          <div class="job-copy">
            <div class="job-header">
              <h2>${escapeHtml(app.title)}</h2>
              <span class="job-employer">${escapeHtml(app.employer)} · ${escapeHtml(app.city)}</span>
              <span class="row-status${app.status.startsWith("Não enviada") ? " is-blocked" : ""}">${escapeHtml(app.status)}</span>
            </div>
            <p class="job-summary">${escapeHtml(bindTrailingWords(app.reason))}</p>
            ${app.pitch ? `<p class="pitch-box">${escapeHtml(bindTrailingWords(app.pitch))}</p>` : ""}
          </div>
          <div class="row-links">
            ${app.pitch ? `<button type="button" class="source-link" data-copy-pitch="${escapeHtml(app.jobId)}">Copiar apresentação</button>` : ""}
            ${app.pitch ? `<a class="source-link" href="${escapeHtml(buildMailtoHref(app))}">Preparar e-mail</a>` : ""}
            <a class="source-link" href="${escapeHtml(app.sourceUrl)}" target="_blank" rel="noopener noreferrer">Abrir anúncio em ${escapeHtml(app.sourceName)} ↗</a>
            ${app.status === "Preparada" ? `<button type="button" class="badge-regional" data-confirm-sent="${escapeHtml(app.jobId)}">Confirmar que enviei</button>` : ""}
          </div>
        </article>
      `).join("")}
    </div>
  </section>`;
}

function shellMarkup() {
  const activeSourceList = view === "employers" ? employers : view === "accommodation" ? stays : jobs;
  const cities = distinctCities(activeSourceList);
  const updatedLabel = generatedAt ? `Atualizado em ${formatShortDate(generatedAt)}` : "Vagas WHV · Austrália";
  const pauseLabel = paused ? "Retomar IA" : "Pausar IA";
  const isDirectory = view === "employers" || view === "accommodation";
  const searchBtnLabel = view === "employers" ? "Buscar empregadores" : view === "accommodation" ? "Buscar hospedagens" : "Buscar vagas";

  return `${symbols()}
    <header class="topbar">
      <a class="brand" href="#vagas" aria-label="HelpWHV, ir para vagas"><span class="brand-sign" aria-hidden="true"><img src="assets/icons/kangaroo.svg" alt="" width="48" height="48"></span><span class="brand-name">HelpWHV</span></a>
      <nav class="primary-nav" aria-label="Navegação principal"><button class="nav-item${view === "jobs" ? " is-current" : ""}" data-view="jobs" type="button" ${view === "jobs" ? 'aria-current="page"' : ""}>${icon("search")}Vagas</button><button class="nav-item${view === "employers" ? " is-current" : ""}" data-view="employers" type="button" ${view === "employers" ? 'aria-current="page"' : ""}>${icon("pin")}Empregadores</button><button class="nav-item${view === "accommodation" ? " is-current" : ""}" data-view="accommodation" type="button" ${view === "accommodation" ? 'aria-current="page"' : ""}>${icon("tag")}Hospedagem</button><button class="nav-item${view === "applications" ? " is-current" : ""}" data-view="applications" type="button" ${view === "applications" ? 'aria-current="page"' : ""}>${icon("work")}Candidaturas</button></nav>
      <div class="topbar-actions"><button class="pause-button${paused ? " is-paused" : ""}" id="pause-agent" type="button" aria-label="${pauseLabel}" aria-pressed="${paused}"><span class="pause-mark" aria-hidden="true"></span><span>${pauseLabel}</span></button><button class="profile-button" id="profile-button" type="button" aria-label="Perfil e regras">${icon("user")}</button></div>
    </header>
    <section class="intro" aria-labelledby="page-title"><h1 id="page-title" tabindex="-1">VAGAS DISPONÍVEIS</h1><p>Encontre vagas WHV na Austrália, filtre por trabalho regional e acesse o anúncio original.</p><svg class="route-path" viewBox="0 0 510 80" preserveAspectRatio="none" aria-hidden="true"><path d="M4 55C55 63 70 44 120 42s87 34 144 18S325 7 369 13s77 35 137 25"/></svg><span class="route-pin" aria-hidden="true">${icon("pin")}</span><div class="road-sign" aria-hidden="true"><span>AUSTRALIA</span><i></i></div><img class="roadside-scrub" src="assets/plates/roadside-scrub.png" alt="" loading="lazy"></section>
    <main class="main-layout" id="vagas">
      <section class="jobs-area" aria-label="Busca e resultados de vagas">
        <div class="filter-panel">
          <form class="filterbar${isDirectory ? " is-directory" : ""}" id="search-form" role="search"><label class="search-field">${icon("search")}<span class="visually-hidden">Cargo ou palavra-chave</span><input id="query" type="search" placeholder="Cargo, empregador ou palavra-chave" autocomplete="off"></label><label class="filter-select">${icon("pin")}<span><strong>Local</strong><select id="location" aria-label="Local"><option value="">Todas as cidades</option>${cities.map(city => `<option value="${city}" ${filters.location === city ? "selected" : ""}>${city}</option>`).join("")}</select></span></label><label class="filter-select" ${isDirectory ? "hidden" : ""}>${icon("coins")}<span><strong>Salário (A$/h)</strong><select id="salary" aria-label="Salário mínimo"><option value="0">Qualquer valor</option><option value="28">A partir de A$ 28</option><option value="30">A partir de A$ 30</option><option value="35">A partir de A$ 35</option></select></span></label><button class="search-button" type="submit">${icon("search")}${searchBtnLabel}</button></form>
          ${categoryChipsMarkup()}
        </div>
        <div class="result-tools"><div class="result-Tools-left"><strong id="result-count"></strong><span class="preview-tag">${updatedLabel}</span><button type="button" class="text-action-btn" id="toggle-select-visible">Selecionar visíveis</button></div><label class="sort-control" ${isDirectory ? "hidden" : ""}><span>Ordenar por:</span><span class="sort-select-wrap"><select id="sort" aria-label="Ordenar vagas"><option value="recent">Mais recentes</option><option value="salary">Maior salário</option><option value="title">Cargo A–Z</option></select></span></label></div>
        <div class="job-list" id="job-list" aria-live="polite"></div>
      </section>
      <aside class="selection-tray" id="lote" aria-labelledby="tray-title"><div class="tray-header"><h2 id="tray-title"><span id="selected-count">0</span> <span id="selected-label">VAGAS SELECIONADAS</span></h2><button type="button" class="text-action-btn" id="clear-selection" hidden>Limpar</button></div><p class="tray-subtitle">Ação em lote (somente nestas vagas)</p><div class="selection-summary" id="selection-summary"></div><fieldset class="mode-fieldset"><legend>Modo de envio</legend><label class="mode-choice${mode === "now" ? " is-active" : ""}"><input type="radio" name="mode" value="now" ${mode === "now" ? "checked" : ""}><span><strong>Enviar agora</strong><small>Na prévia, a IA prepararia candidaturas para <span class="mode-count">0</span> <span class="mode-label">vagas disponíveis</span>.</small></span></label><label class="mode-choice${mode === "auto" ? " is-active" : ""}"><input type="radio" name="mode" value="auto" ${mode === "auto" ? "checked" : ""}><span><strong>Automático</strong><small>Na prévia, a IA acompanharia novas vagas selecionadas até você pausar.</small></span></label></fieldset><button class="bulk-button" id="bulk-apply" type="button">${icon("send")}PEDIR À IA PARA CANDIDATAR</button><p class="scope-note" id="scope-note"></p></aside>
    </main>
    <a class="mobile-batch-bar" id="mobile-batch-bar" href="#lote" hidden><span><strong id="mobile-selected-count">0</strong> <span id="mobile-selected-label">vagas selecionadas</span></span><span>Ver lote <span aria-hidden="true">→</span></span></a>
    ${profileModalMarkup()}
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

function resetPageAndUpdate() {
  currentPage = 1;
  updateResults();
}

function updateResults() {
  const listEl = document.getElementById("job-list");
  if (!listEl) return;

  if (view === "accommodation") {
    const visibleStays = filterStays(stays, filters);
    const paged = paginate(visibleStays, currentPage, PAGE_SIZE);
    listEl.innerHTML = paged.slice.length
      ? paged.slice.map(stayMarkup).join("") + paginationMarkup(paged.page, paged.totalPages, paged.totalItems, "hospedagens")
      : `<div class="empty-results"><h2>Nenhuma hospedagem encontrada</h2><p>Tente outra cidade ou limpe os filtros.</p><button id="clear-filters" type="button">Limpar filtros</button></div>`;
    document.getElementById("result-count").textContent = `${visibleStays.length} ${visibleStays.length === 1 ? "hospedagem encontrada" : "hospedagens encontradas"}`;
    const toggleBtn = document.getElementById("toggle-select-visible");
    if (toggleBtn) toggleBtn.hidden = true;
    currentPage = paged.page;
    return;
  }

  if (view === "employers") {
    const visibleEmp = filterEmployers(employers, filters);
    const paged = paginate(visibleEmp, currentPage, PAGE_SIZE);
    listEl.innerHTML = paged.slice.length
      ? paged.slice.map(employerMarkup).join("") + paginationMarkup(paged.page, paged.totalPages, paged.totalItems, "empregadores")
      : `<div class="empty-results"><h2>Nenhum empregador encontrado</h2><p>Tente outra palavra ou limpe os filtros.</p><button id="clear-filters" type="button">Limpar filtros</button></div>`;
    document.getElementById("result-count").textContent = `${visibleEmp.length} ${visibleEmp.length === 1 ? "empregador encontrado" : "empregadores encontrados"}`;
    const toggleBtn = document.getElementById("toggle-select-visible");
    if (toggleBtn) toggleBtn.hidden = true;
    currentPage = paged.page;
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
  const paged = paginate(visible, currentPage, PAGE_SIZE);
  listEl.innerHTML = paged.slice.length
    ? paged.slice.map(jobMarkup).join("") + paginationMarkup(paged.page, paged.totalPages, paged.totalItems, plural(paged.totalItems))
    : `<div class="empty-results"><h2>Nenhuma vaga encontrada</h2><p>Tente outra palavra ou limpe os filtros.</p><button id="clear-filters" type="button">Limpar filtros</button></div>`;
  document.getElementById("result-count").textContent = `${visible.length} ${plural(visible.length)} ${visible.length === 1 ? "encontrada" : "encontradas"}`;
  currentPage = paged.page;

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
    document.querySelector(".intro p").textContent = "Acompanhe as vagas avaliadas pelas suas regras, copie sua apresentação e confirme os envios.";
    document.querySelector(".main-layout").classList.add("applications-view");
    document.querySelector(".jobs-area").innerHTML = applicationsViewMarkup();
    document.querySelector(".selection-tray").hidden = true;
    document.getElementById("mobile-batch-bar").hidden = true;
  } else if (view === "accommodation") {
    document.title = "Hospedagem WHV · HelpWHV";
    document.getElementById("page-title").textContent = "HOSPEDAGEM WHV";
    document.querySelector(".intro p").textContent = "Working hostels, backpacker hostels, caravan parks e farm stays na Austrália.";
    document.querySelector(".main-layout").classList.add("applications-view");
    document.querySelector(".selection-tray").hidden = true;
    document.getElementById("mobile-batch-bar").hidden = true;
    const salarySelect = document.getElementById("salary")?.closest(".filter-select");
    if (salarySelect) salarySelect.hidden = true;
    const sortControl = document.querySelector(".sort-control");
    if (sortControl) sortControl.hidden = true;
    document.getElementById("query").value = filters.query;
    updateResults();
  } else if (view === "employers") {
    document.title = "Empregadores Regionais · HelpWHV";
    document.getElementById("page-title").textContent = "EMPREGADORES REGIONAIS";
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

function syncSavedStatusesToJobs() {
  const byId = new Map(applications.map(a => [a.jobId, a.status]));
  for (const job of jobs) {
    if (byId.has(job.id)) {
      job.status = byId.get(job.id);
    }
  }
}

function executeProfileEvaluationForIds(jobIds) {
  const targetJobs = jobs.filter(j => jobIds.includes(j.id));
  if (!targetJobs.length) return;
  const newRecords = applyProfileRulesToJobs(targetJobs, userProfile);
  const byId = new Map(applications.map(a => [a.jobId, a]));
  for (const rec of newRecords) {
    byId.set(rec.jobId, rec);
  }
  applications = Array.from(byId.values());
  saveApplications(applications);
  const preparedCount = newRecords.filter(r => r.status === "Preparada").length;
  const blockedCount = newRecords.length - preparedCount;
  render();
  notice(
    `Avaliação concluída: ${preparedCount} ${preparedCount === 1 ? "preparada" : "preparadas"}${blockedCount ? ` e ${blockedCount} não ${blockedCount === 1 ? "enviada" : "enviadas"} por regra/dados` : ""}. Confira na aba Candidaturas.`
  );
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
    const [jobsPayload, empPayload, accPayload] = await Promise.all([
      fetchWithLocalFallback(JOBS_URL, LOCAL_JOBS_URL),
      fetchWithLocalFallback(EMPLOYERS_URL, LOCAL_EMPLOYERS_URL).catch(() => ({ employers: [] })),
      fetchWithLocalFallback(ACCOMMODATION_URL, LOCAL_ACCOMMODATION_URL).catch(() => ({ stays: [] }))
    ]);
    generatedAt = jobsPayload.generatedAt || null;
    jobs = Array.isArray(jobsPayload.jobs) ? jobsPayload.jobs.map(toViewJob) : [];
    syncSavedStatusesToJobs();
    employers = Array.isArray(empPayload.employers) ? empPayload.employers.map(toViewEmployer) : [];
    stays = Array.isArray(accPayload.stays) ? accPayload.stays.map(toViewStay) : [];
    loadingState = "ready";
    render();
  } catch {
    loadingState = "error";
    render();
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("submit", event => {
    if (event.target.id === "profile-form") {
      event.preventDefault();
      userProfile = {
        ...userProfile,
        fullName: document.getElementById("prof-name").value.trim(),
        visaSubclass: document.getElementById("prof-subclass").value === "417" ? "417" : "462",
        availableFrom: document.getElementById("prof-avail").value.trim() || "Imediata",
        minHourlyWage: Number(document.getElementById("prof-min-wage").value || 0),
        experienceSummary: document.getElementById("prof-exp").value.trim(),
        allowMissingSalary: Boolean(document.getElementById("prof-allow-missing-pay").checked),
        requireRegional88: Boolean(document.getElementById("prof-require-regional").checked),
        rulesApproved: Boolean(document.getElementById("prof-approved").checked)
      };
      filters.visaSubclass = userProfile.visaSubclass;
      saveSubclass(filters.visaSubclass);
      saveProfile(userProfile);
      profileModalOpen = false;
      if (userProfile.rulesApproved && pendingApplyJobIds.length > 0) {
        const toRun = [...pendingApplyJobIds];
        pendingApplyJobIds = [];
        executeProfileEvaluationForIds(toRun);
        return;
      }
      render();
      notice("Perfil e regras da IA salvos.");
      return;
    }
    if (event.target.id !== "search-form") return;
    event.preventDefault();
    filters.query = document.getElementById("query").value;
    filters.location = document.getElementById("location").value;
    filters.salary = Number(document.getElementById("salary").value);
    resetPageAndUpdate();
  });
  document.addEventListener("input", event => {
    if (event.target.id === "query") {
      filters.query = event.target.value;
      resetPageAndUpdate();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (profileModalOpen) {
        profileModalOpen = false;
        pendingApplyJobIds = [];
        render();
        document.getElementById("profile-button")?.focus();
        return;
      }
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
      resetPageAndUpdate();
    } else if (target.id === "location" || target.id === "salary") {
      filters.location = document.getElementById("location").value;
      filters.salary = Number(document.getElementById("salary").value);
      resetPageAndUpdate();
    } else if (target.id === "visa-subclass") {
      filters.visaSubclass = target.value === "417" ? "417" : "462";
      saveSubclass(filters.visaSubclass);
      resetPageAndUpdate();
    } else if (target.id === "only-regional") {
      filters.onlyRegional = Boolean(target.checked);
      target.closest(".regional-toggle")?.classList.toggle("is-active", filters.onlyRegional);
      resetPageAndUpdate();
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
    if (button.dataset.subclass) {
      filters.visaSubclass = button.dataset.subclass === "417" ? "417" : "462";
      saveSubclass(filters.visaSubclass);
      document.querySelectorAll("[data-subclass]").forEach(btn => {
        const active = btn.dataset.subclass === filters.visaSubclass;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", String(active));
      });
      resetPageAndUpdate();
      return;
    }
    if (button.dataset.page) {
      currentPage = Number(button.dataset.page);
      updateResults();
      listEl = document.getElementById("job-list");
      if (listEl) listEl.scrollIntoView({ behavior: "instant", block: "start" });
      return;
    }
    if (button.id === "clear-categories") {
      filters.categories = [];
      filters.stayTypes = [];
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
    if (button.dataset.stayType) {
      const st = button.dataset.stayType;
      if (filters.stayTypes.includes(st)) {
        filters.stayTypes = filters.stayTypes.filter(x => x !== st);
      } else {
        filters.stayTypes = [...filters.stayTypes, st];
      }
      render();
      document.querySelector(`[data-stay-type="${st}"]`)?.focus();
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
    if (button.id === "profile-button" || button.id === "edit-rules-btn" || button.id === "open-profile-from-empty") {
      profileModalOpen = true;
      render();
      document.getElementById("prof-name")?.focus();
      return;
    }
    if (button.id === "close-profile-modal") {
      profileModalOpen = false;
      pendingApplyJobIds = [];
      render();
      return;
    }
    if (button.dataset.appFilter) {
      appStatusFilter = button.dataset.appFilter;
      render();
      return;
    }
    if (button.dataset.confirmSent) {
      const id = button.dataset.confirmSent;
      for (const app of applications) {
        if (app.jobId === id) app.status = "Enviada";
      }
      for (const job of jobs) {
        if (job.id === id) job.status = "Enviada";
      }
      saveApplications(applications);
      render();
      notice("Candidatura marcada como Enviada.");
      return;
    }
    if (button.dataset.copyPitch) {
      const app = applications.find(a => a.jobId === button.dataset.copyPitch);
      if (app?.pitch && typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(app.pitch).catch(() => {});
      }
      notice("Apresentação copiada para a área de transferência.");
      return;
    }
    if (button.id === "clear-filters") {
      filters = { ...filters, query: "", location: "", salary: 0, categories: [], stayTypes: [], onlyRegional: false, sort: "recent" };
      render();
    }
    if (button.dataset.apply) {
      openJobId = openJobId === button.dataset.apply ? "" : button.dataset.apply;
      updateResults();
      const menu = openJobId ? document.getElementById(`options-${openJobId}`) : null;
      const target = menu ? menu.firstElementChild : document.querySelector(`[data-apply="${button.dataset.apply}"]`);
      target?.focus({ preventScroll: true });
      menu?.lastElementChild?.scrollIntoView({ block: "center", behavior: "instant" });
    }
    if (button.dataset.applyNow) {
      const targetId = button.dataset.applyNow;
      openJobId = "";
      if (!userProfile.rulesApproved) {
        pendingApplyJobIds = [targetId];
        profileModalOpen = true;
        render();
        notice("Aprove seu perfil e regras antes da primeira candidatura.");
        return;
      }
      executeProfileEvaluationForIds([targetId]);
    }
    if (button.dataset.toggleAuto) {
      const id = button.dataset.toggleAuto;
      const enabling = !automatic.has(id);
      enabling ? automatic.add(id) : automatic.delete(id);
      openJobId = "";
      if (enabling && userProfile.rulesApproved && !paused) {
        executeProfileEvaluationForIds([id]);
        return;
      }
      updateResults();
      notice(enabling ? "Modo automático ativado nesta vaga." : "Modo automático desativado nesta vaga.");
    }
    if (button.id === "bulk-apply") {
      const actionableJobs = eligibleForBatch(jobs, selected);
      if (!actionableJobs.length) return;
      if (mode === "auto") {
        for (const j of actionableJobs) automatic.add(j.id);
      }
      if (!userProfile.rulesApproved) {
        pendingApplyJobIds = actionableJobs.map(j => j.id);
        profileModalOpen = true;
        render();
        notice("Configure e aprove suas regras para avaliar o lote selecionado.");
        return;
      }
      executeProfileEvaluationForIds(actionableJobs.map(j => j.id));
    }
    if (button.dataset.view) {
      view = button.dataset.view;
      currentPage = 1;
      const activeList = view === "employers" ? employers : view === "accommodation" ? stays : jobs;
      const availableCities = distinctCities(activeList);
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
    jobs,
    employers,
    stays,
    CATEGORIES
  };
}
