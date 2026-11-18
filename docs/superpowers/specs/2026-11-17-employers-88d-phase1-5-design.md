# Design — Fase 1.5: Diretório de Fazendas e Empregadores Regionais (`employers.json`)

Status: **aprovado**

## 1. Intenção e Por Quê
Quem está na Austrália com Working Holiday Visa (417/462) frequentemente consegue trabalho em fazendas, *packing sheds*, *working hostels* e resorts regionais entrando em contato direto por telefone, site ou presencialmente — já que muitos desses empregadores não anunciam em agregadores de vagas. Esta entrega cria a aba **"Empregadores 88d"** abastecida por dados estruturados do Google Maps (`data/employers.json`), separada de `data/jobs.json` para respeitar a verdade dos dados (empresa ≠ vaga aberta).

## 2. Objetivos, Fora de Escopo e Antiobjetivos
- **Objetivos:**
  - Extrair e normalizar empregadores de polos WHV na Austrália nas categorias relevantes (`Farm`, `Fruit Picking`, `Hospitality`, `Construction`, etc.).
  - Calcular o selo `regionalWork` (`417`/`462`) usando as mesmas regras de postcode de `regional88.js`.
  - Exibir na aba **"Empregadores 88d"** com busca, filtro de cidade, chips das 11 categorias, seletor 462/417, filtro "Apenas elegíveis 88 dias" e ações de contato comercial (Site, Telefone, Google Maps).
- **Fora de escopo:** envio automático de mensagens ou e-mails para empresas.
- **Antiobjetivos:** apresentar empresas como se tivessem vagas abertas confirmadas; armazenar dados pessoais de pessoas físicas em fixtures.

## 3. Abordagens Consideradas
1. **Aba dedicada `"Empregadores 88d"` + `data/employers.json` gerado via adaptador local/seed (escolhida):** separa claramente vagas abertas de empregadores para contato espontâneo e evita bloqueio de IP em runners de CI.
2. **Misturar empresas na lista de vagas:** descartada por violar `PRODUCT.md`.
3. **Executar binário Windows `.exe` no runner Ubuntu do GitHub Actions:** descartada por incompatibilidade de SO e bloqueio de IP sem proxy.
