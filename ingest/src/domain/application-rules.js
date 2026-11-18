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
        reason: `Vaga não elegível para os 88 dias do visto ${subclass}.`,
        pitch: null
      };
    }
    if (regStatus !== "likely") {
      return {
        allowed: false,
        status: "Não enviada · dado insuficiente",
        reason: `A vaga não informa postcode suficiente para confirmar os 88 dias (${subclass}).`,
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

module.exports = {
  DEFAULT_PROFILE,
  evaluateJobForProfile,
  buildApplicationPitch
};
