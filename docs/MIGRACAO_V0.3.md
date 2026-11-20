# Reconciliação da SPEC v0.3 com a v0.2

A proposta v0.3 pode avançar sobre o portal estático existente. O importador científico e a coleção prioritária já funcionam em staging. O trabalho de produto pendente é ligar os contratos ao frontend, explicitar as restrições de comparação e preparar uma distribuição que contenha somente arquivos aprovados. O primeiro incremento navegável deve permitir abrir um evento, chegar ao run e identificar a referência, o escopo e a condição de comparabilidade de uma medida. [SPEC v0.2](../SPEC_v0.2.md) · [Proposta v0.3](../SPEC_v0.3.md)

## Requisitos implementados e pendentes

| Área | Estado verificado | Entrega pendente |
| --- | --- | --- |
| Portal estático e PT/EN | A interface usa HTML, CSS e módulos JavaScript nativos. Tem âncoras, alternância de idioma, carregamento de JSON, aviso demonstrativo e estados de falha locais. | Manter esses comportamentos e aplicar os mesmos padrões aos módulos científicos. |
| Dashboard | Exibe fase, último ajuste editorial e contagens de marcos, prioridades e publicações. | Resumo científico, hipóteses ativas, baseline da fase atual, até três grupos em destaque e marcos recentes. Separar atualização editorial de data experimental confirmada. |
| Timeline | A timeline científica existe em Markdown e foi exportada no staging. A interface mostra atualizações editoriais. | Timeline navegável com filtros, expansão e links científicos. Preservar as atualizações editoriais e separar eventos sem data. |
| Catálogo e comparador | O importador produz runs, métricas, pares e condições de medição. | Detalhes dos runs, filtros, tabela por escopo, avisos metodológicos e gráficos elegíveis. |
| Galeria | O staging contém sete PNGs curados com legenda, texto alternativo, origem e escopo. Os objetos de figura ficam embutidos nos runs ou comparações. | Galeria, índice de figuras, filtros, ampliação por teclado e carregamento sob demanda. |
| Roadmap, recursos e publicações | O portal exibe marcos, prioridades, recursos e um estado vazio para publicações. | Vínculos documentados com hipóteses, runs e artigos. Exibição dos estados editoriais previstos na v0.2. Literatura tem contrato proposto e ainda precisa de registros aprovados. |
| Publicação | O importador exige lista de aprovação e recusa publicar a coleção prioritária. O checkout não contém `public/` nem workflow de deploy. | Empacotamento estático com lista de inclusão, verificação de ausência de conteúdo privado e teste do artefato em subdiretório. O estado da hospedagem remota não foi auditado. |

A coleção auditada contém **sete grupos, 32 runs, 126 métricas, 13 pares e sete eventos**. Todos os registros estão privados. Entre os pares, cinco aceitam análise descritiva e oito estão bloqueados para comparação quantitativa. Das 126 métricas, 66 têm unidade desconhecida. O caso SST mantém a fração de supervisão do baseline indeterminada. As seeds 42, 123 e 456 do k–ε representam partições distintas. [Inventário](../DATA_INVENTORY.md) · [Timeline de curadoria](../RESEARCH_TIMELINE.md) · [Importador](./EXPERIMENT_IMPORT.md)

## Decisões propostas para a v0.3

1. **Manter o frontend nativo e modular.** React, Vite, TypeScript e `npm run build` eram exigências da v0.2. A v0.3 torna o framework opcional. A proposta é reaproveitar o código atual e entregar módulos por seção. Usar uma montagem estática verificável no lugar do aceite atrelado ao npm. A release continua condicionada aos testes do pacote, em vez da presença de uma ferramenta específica. Gráficos pequenos podem usar elementos nativos e sempre incluem tabela equivalente.
2. **Distinguir fonte editorial, staging e distribuição.** O laboratório e o importador continuam locais. A distribuição deve ser montada em diretório dedicado com lista de inclusão de HTML, CSS, JavaScript, JSONs públicos e imagens aprovadas. Validar a exportação pública pelo CLI existente e empacotar somente esse recorte. O perfil `featured` conserva a restrição a staging. Servir a distribuição montada nas verificações HTTP evita que a raiz do workspace exponha a pasta ignorada, os documentos de pesquisa ou os relatórios de auditoria. A visibilidade do próprio repositório Git requer revisão separada antes de enviar arquivos científicos ou editoriais.
3. **Usar estados informativos enquanto a curadoria estiver pendente.** O frontend público deve funcionar com coleções vazias. O desenvolvimento e os testes podem usar fixtures isoladas ou uma cópia local para revisão. O primeiro conjunto científico público depende de aprovação explícita por registro, fonte e imagem. A publicação deve continuar independente do acesso ao laboratório e de PyArrow.
4. **Tratar comparabilidade por condição.** O status geral do par é um resumo. Para traçar gráficos, exigir a condição específica de métrica e escopo com `measurementCompatible: true`, IDs resolvidos, valores finitos, unidade confirmada e `status` elegível. `descriptive_only` recebe aviso de limitações e pode exibir gráfico descritivo quando a medição coincide. `blocked` fica com razões e links aos detalhes individuais. Destaque de menor ou maior valor fica restrito ao mesmo contexto com `lowerIsBetter` definido, inclusive tratamento de empate. Isso preserva decisões do importador sobre referência, split, operador e máscara.

A separação preserva o custo de operação estática. O processamento dos Parquets continua pontual e offline. O navegador carrega índices leves para a página inicial e busca métricas detalhadas, comparações e imagens quando o usuário entra na seção. Evitar duplicar métricas no resumo executivo, na timeline e nas fichas.

## Mapa de contratos

| Entidade | Forma atual | Migração compatível |
| --- | --- | --- |
| Projeto e editorial | `project.currentPhase` é texto. `lastUpdated` é editorial. Roadmap, prioridades, atualizações, recursos e publicações têm estruturas próprias e fallback PT/EN. | Manter os arquivos e chaves existentes. Acrescentar `currentPhaseId`, vínculos opcionais por ID e data de atualização experimental apenas quando sustentada. Preservar `#overview`, `#roadmap`, `#updates`, `#priorities` e `#resources` e adicionar âncoras novas. |
| Fases, grupos, decisões e hipóteses | Fase em `phaseId`, grupos na configuração curada e em `curationGroupId`, decisões e hipóteses nas listas da timeline. | Projetar um índice editorial leve e versionado para resolver rótulos, ordem, hipóteses e destaques. Membros do grupo são IDs das comparações e eventos aprovados. Conservar o experimento de referência como ID e resolver suas métricas pelo catálogo. |
| Timeline | `id`, `date`/ `period`, `phaseId`, `experimentIds`, `comparisonIds`, `decisionIds`, `hypothesisIds`, evidência e fontes. | Manter `id` como campo canônico. `eventId` designa a chave de referência em outra entidade. Acrescentar links opcionais em ambos os sentidos por meio dos índices, com ordem estável por data e ID. |
| Experimentos | `id`, `runId`, modelo, fase, caso, seed, hashes, configuração e IDs de métricas. Alguns campos como caso, datas ou referência do run complementar podem ser desconhecidos. | Preservar IDs, campos e `null`. Acrescentar `type` e `objective` somente com fonte documentada. Distinguir data de execução de `updatedAt`. Campos indisponíveis recebem rótulo **Não informado**. |
| Comparações e métricas | `conditions[]` liga medidas pelo ID, com escopo e motivos. `metrics.json` guarda valores e metadados metodológicos. | Manter os valores escalares em `metrics.json`. Exibir eficiência pelo orçamento de treino e exigir evidência de equivalência para comparar tempo. Cobertura e redução relativa aparecem quando exportadas e aprovadas. Os contratos aceitam ausência explícita desses campos. |
| Figuras | Objeto embutido com `id`, `path`, `experimentId` ou `comparisonId`, legenda, alt, origem, escopo e estado de publicação. | Gerar `figures.json` como índice por ID, a partir das mesmas figuras aprovadas. Manter leitor para o legado embutido até validar a migração. Identificadores repetidos com conteúdo divergente ou proprietário ambíguo são inválidos. |
| Literatura e publicações | Recursos externos e publicações editoriais. Não há `literature.json` no checkout. | Adicionar coleção opcional de literatura, com referências a IDs de hipóteses e runs quando documentadas. Usar `draft`, `internal_review`, `submitted`, `accepted` e `published` em displays que reflitam os estados confirmados. |
| Estado editorial | Evidência `verified`, `preliminary`, `planned`, `unknown`. Curadoria atual usa `discovered`, `staged`, `pending_review`, `approved`. Visibilidade e aprovação aparecem em campos ou configurações próprios. | Preservar `curationStatus` legado na transição e acrescentar `presentationStatus` com `featured`, `validated`, `historical`, `partial`, `excluded` por decisão editorial. Seleção para staging não concede estado editorial validado ou visibilidade pública. |

Durante a migração, validar IDs únicos, referências cruzadas, paridade de escopo/unidade e existência dos arquivos de figura antes de montar a distribuição. A UI recebe estados de carregamento, vazio, erro e parcial como defesa de robustez. A exclusão de dados privados acontece antes da hospedagem.

## Sequência incremental

| Ordem | Prioridade | Incremento | Aceite verificável |
| --- | --- | --- | --- |
| 1 | P0 crítica | Contratos de leitura e empacotamento estático. Reutilizar o ETL, escrever validadores e regras de inclusão do pacote. | O frontend continua funcional com seus seis JSONs originais. Fixtures com IDs duplicados ou referências quebradas falham na validação. Um pacote sem aprovados mantém estados vazios e exclusão de staging, relatórios, checkpoints, Parquets e caminhos internos. |
| 2 | P0 alta | Catálogo e detalhes de run. Carregar sob demanda; adicionar filtros e âncoras estáveis. | O usuário filtra pelas dimensões da proposta e abre um run com configuração, referência, métricas, fonte e limitações. Campo `null` tem estado explícito. |
| 3 | P0 crítica | Comparador a partir de pares catalogados. Renderizar tabela, gráfico e nota metodológica por condição. | Casos de teste cobrem compatível, descritivo e bloqueado. Unidade desconhecida, diferença de split, escopo ou operador impedem gráfico conjunto. Empates e valores ausentes não recebem destaque incorreto. |
| 4 | P0 alta | Timeline integrada. Adicionar filtros, detalhes, datas/parciais e ligações ao catálogo. | A navegação evento → comparação → run → medida é navegável por teclado. Eventos sem data ficam em seção própria, e eventos planejados mostram estado explícito. |
| 5 | P0 alta | Dashboard científico e design system compartilhado. | Visão geral apresenta fase, hipóteses, baseline, datas, até três destaques, marcos recentes e prioridades. Contagens refletem apenas o recorte disponível e a apresentação funciona sem resultados públicos. |
| 6 | P1 média | Galeria, roadmap vinculado e complemento editorial. | Figuras aprovadas carregam sob demanda com legenda e texto alternativo. Referências de tarefas, artigos e publicações resolvem IDs documentados e preservam estados editoriais. |
| 7 | P0 crítica | Revisão final de regressões, acessibilidade e distribuição. | Testar HTTP local na raiz e sob `/pinn-research-hub/`, em 360, 768 e 1440 px, com teclado, PT/EN e foco visível. Inspecionar requisições iniciais, links, política de publicação e conteúdo efetivo do pacote. |

A sequência ordena dependências e critérios, sem estimar prazo ou comprometer capacidade. As três primeiras etapas estabelecem o contrato científico com o qual a timeline e o dashboard podem trabalhar. A atualização de documentação e a revisão da privacidade fazem parte do aceite de cada incremento.

## Condições para aprovar a migração

- **Stack e distribuição.** Confirmar JavaScript nativo e a montagem dedicada do artefato como adoção da v0.3. Registrar a decisão antes de mudar a interface.
- **Dados públicos.** Quando houver material aprovado, identificar os IDs e as fontes publicáveis. Até essa aprovação, validar o fluxo com dados de teste isolados e aceitar o estado vazio público. O pesquisador confirma unidades, figuras e vínculos de divulgação.
- **Critério de conclusão.** A entrega está concluída quando as regressões da interface atual e os testes de contratos, navegação, estados vazios, comparação e privacidade passam, os riscos científicos aparecem junto às medidas e a versão estática pode ser servida em subdiretório. A aprovação de publicação é uma decisão distinta da implementação.

Nesta reconciliação, foram conferidos os contratos e a coleção de staging, e os 17 testes automatizados do importador passaram. Os testes de interface v0.3 e de distribuição são critérios dos incrementos acima.

## Implementação

A versão v0.3 adotou JavaScript nativo. O montador `scripts/build_site.mjs` usa os mesmos validadores que o navegador, gera o índice do dashboard sem valores de métricas e valida referências e hashes do recorte aprovado. A data da execução é exportada como campo opcional distinto da atualização. Figuras embutidas aprovadas são convertidas no índice de galeria. A aplicação inclui estados editoriais e vazios para as coleções ainda sem divulgação.

O navegador consulta métricas ao selecionar os detalhes de um run, abrir o comparador ou expandir o baseline. A galeria busca as imagens publicadas sob demanda. Os testes de navegador servem o editorial e uma coleção sintética isolada para exercitar os fluxos completos na raiz e no subdiretório do projeto. A distribuição local atual tem somente o recorte editorial. [Comandos e publicação](../README.md)
