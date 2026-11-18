# Vagas disponíveis e candidaturas com IA — Austrália

Status: brief confirmado  
Modo: Operate  
FORM: Caminhos da Austrália · direção seed:1c62c21c92cc5fc9 · estrutura seed:98e74622c9d65486 · escolha: Busca e lote  
Referência visual: [comp selecionada](../mocks/decision/ai-search-batch.png) — prévia com dados fictícios, não especificação de conteúdo real.

## 1. Público e tarefa

Pessoas que já estão no exterior com working holiday visa abrem o HelpWHV para encontrar vagas na Austrália e pedir que uma IA funcional se candidate. Hospedagem integra o produto, mas fica fora desta superfície. A tela inicial mostra **vagas disponíveis** e o estado da IA, não um painel de justificativas da IA.

## 2. Resultado e verdade do produto

A pessoa consegue encontrar vagas, compará-las por **local, remuneração, tipo de trabalho e data**, selecionar uma ou várias e pedir candidaturas com IA. Pode acionar uma vaga individualmente, habilitar modo automático por vaga dentro de regras previamente aprovadas, executar um lote de vagas selecionadas, pausar a IA e ajustar as regras. A IA encontra e organiza vagas, confere internamente CV, visto, local, disponibilidade e salário antes do envio e registra o resultado da ação. O produto só indica **enviada** após confirmação técnica do envio; isso não significa resposta ou contratação.

## 3. Direção escolhida e sequência

**Busca e lote** organiza o primeiro viewport em busca e filtros no topo, lista ampla de vagas com seleção e ação por linha, e bandeja fixa à direita com contagem, escopo, modo e ação em massa. A bandeja deixa explícito que o comando afeta somente as vagas selecionadas; aplicar filtros não seleciona todas automaticamente. A identidade **Caminhos da Austrália** usa tipografia de orientação, cor funcional e um único traço de percurso. O conteúdo e os controles mantêm prioridade sobre o motivo visual. A [comp escolhida](../mocks/decision/ai-search-batch.png) orienta a composição; seus títulos, quantidades, remunerações e datas são ilustrativos.

## 4. Interação e alcance

- Cada vaga exibe título, local, remuneração, tipo, data e fonte quando disponíveis; dados ausentes são identificados como ausentes. Busca, filtros e ordenação alteram a lista sem perder a seleção já feita, deixando visível quando uma vaga selecionada não está nos resultados filtrados.
- A ação por vaga distingue **Candidatar com IA agora** de **Automático nesta vaga**. A bandeja resume o lote e permite escolher envio agora ou modo automático antes do comando. Mudança de modo, pausa e ajuste de regras deixam claro o alcance sobre ações futuras e as já iniciadas.
- Antes do primeiro envio, a pessoa configura perfil e aprova regras de autonomia. A interface mostra o estado da operação e o resultado de cada candidatura; a avaliação detalhada do porquê uma vaga foi aprovada ocorre no backend e não ocupa a lista.
- Em telas menores, filtros passam a um painel acessível, as vagas viram linhas ou cartões legíveis e a seleção em lote permanece alcançável por uma barra de ação; a pessoa vê contagem e escopo antes de executar. Controles têm rótulos, foco visível, uso por teclado e estados que não dependem apenas de cor.

## 5. Estados e conteúdo

Prever primeiro uso sem regras, carregamento, nenhuma vaga, poucos resultados, lista extensa, vaga selecionada, candidatura em fila, em preparação, em envio, enviada, falha, vaga não enviada por regra ou dado insuficiente, e IA pausada. Em falha ou bloqueio, oferecer próximo passo objetivo sem expor uma cadeia de raciocínio da IA. Informar quando filtros não retornam vagas e permitir limpar filtros. Volumes reais, frequência de atualização e disponibilidade dos campos ainda são desconhecidos; a composição deve suportar dados incompletos e títulos longos.

## 6. Limites e decisões abertas

Escopo deste brief: tela inicial de busca, filtros, resultados, seleção, comando de candidatura individual/em lote e visibilidade do estado da IA; o fluxo de hospedagem não é definido aqui. Fontes de vagas, motor de busca, deduplicação, método de candidatura em sites externos, persistência de CV/dados pessoais, validação das regras de visto, política de reenvio e idioma da interface ainda precisam ser definidos antes da implementação. A primeira versão pública deve ter IA funcional, mas nenhuma prévia ou interface publicada deve afirmar vagas reais, parcerias ou candidaturas concluídas sem dados e integrações verificadas.

