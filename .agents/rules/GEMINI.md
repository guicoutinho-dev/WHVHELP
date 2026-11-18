# Regras do projeto HelpWHV

Estas regras valem para qualquer agente trabalhando neste repositório.

## Arquitetura
- Siga `ARCHITECTURE.md`. Ele é a fonte da verdade para pastas, fronteiras e contrato `data/jobs.json`.
- `ingest/src/domain/` é puro: sem `fetch`, `fs`, `process.env` ou relógio implícito (receba `now` por parâmetro).
- `ingest/src/sources/` só busca dados e mapeia para `RawJob`. Nenhuma regra de negócio ali.
- `ingest/src/cli.js` é o único lugar que lê variáveis de ambiente e escreve em disco.
- `app.js` apenas lê e exibe o contrato; não reclassifica nem recalcula selos.
- Alterar o contrato `jobs.json` exige incrementar `schemaVersion` e atualizar `ARCHITECTURE.md` na mesma mudança.
- Nova pasta, camada ou dependência fora do documento: pare e peça aprovação antes.

## TDD
- Ciclo vermelho → verde → refatorar para toda regra de domínio e todo adaptador.
- Use `node:test` e `node:assert/strict`. Rode com `npm test`.
- Testes nunca acessam a rede. Use fixtures em `ingest/test/fixtures/` e `fetch` injetado.
- Fixtures não podem conter dados pessoais (telefones, e-mails, nomes de pessoas).

## Clean Code
- Funções pequenas, com um propósito e nomes descritivos.
- Categorias, períodos de pagamento e status vêm de constantes em `domain/`, nunca strings soltas.
- Sem dependências npm sem aprovação explícita; prefira APIs nativas do Node 24.
- CommonJS (`require`/`module.exports`), coerente com o código existente.

## Verdade dos dados
- Nunca invente vaga, salário, data, empregador ou selo. Campo ausente = `null`; a UI mostra "não informado".
- Não converta período de pagamento sem a fonte declarar.
- Selo de trabalho regional é sempre estimativa, com link para a fonte oficial do governo australiano.

## Fontes e segurança
- Somente fontes listadas em `ARCHITECTURE.md` e URLs em `ingest/config/sources.json` com termos e robots verificados.
- Proibido coletar de Facebook, Gumtree, Seek, Indeed ou LinkedIn.
- Chaves de API só por variáveis de ambiente; nunca no código, fixtures ou `jobs.json`.

## Idioma
- Textos de interface em português do Brasil; nomes das categorias em inglês, como na UI aprovada.
