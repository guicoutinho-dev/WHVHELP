# Design — Fase 2: Perfil WHV, Regras de Autonomia e Painel de Candidaturas (Local-First)

Status: **aprovado**

## 1. Intenção e Por Quê
Permitir que a pessoa em Working Holiday Visa configure seu perfil e regras de autonomia (visto 462/417, salário mínimo, exigência de 88 dias, categorias aceitas, disponibilidade e resumo de experiência) e use os comandos **Candidatar com IA** (individual e em lote) para avaliar vagas reais, gerar a apresentação sob medida e acompanhar o estado real na aba **Candidaturas**, sem depender de servidor pago e sem fingir envios não confirmados.

## 2. Objetivos, Fora de Escopo e Antiobjetivos
- **Objetivos:**
  - Modal acessível de **Perfil e Regras da IA** acionado pelo botão `#profile-button` ou ao tentar candidatar antes de aprovar as regras.
  - Motor determinístico (`evaluateJobForProfile` e `buildApplicationPitch`) que classifica cada tentativa em `Preparada`, `Não enviada · regra` ou `Não enviada · dado insuficiente`.
  - Aba **Candidaturas** funcional com filtro por status, cópia da apresentação, abertura da vaga original e confirmação manual de `Enviada`.
- **Fora de escopo:** automação de preenchimento de formulários em sites externos (Playwright) e login em nuvem.
- **Antiobjetivos:** marcar vaga como `Enviada` sem confirmação técnica/humana; expor cadeia longa de raciocínio na lista principal de vagas.
