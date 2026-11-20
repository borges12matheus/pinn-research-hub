# Auditoria da implementação para a SPEC v0.4

A interface usa HTML, CSS e módulos JavaScript nativos. O build produz arquivos estáticos e seleciona as coleções experimentais a partir de um manifesto de aprovação. A revisão local lê a curadoria privada pelo servidor de loopback. A migração pode aproveitar esses fluxos e usar rotas por fragmento compatíveis com a hospedagem em subdiretório.

| Superfície | Comportamento observado | Mudança planejada |
| --- | --- | --- |
| Visão geral | Abertura editorial, atividades e grupos sem destino próprio | Dar prioridade à pergunta central e ligar marcos e grupos ao percurso de investigação |
| Evolução | Acordeões usam datas, títulos e filtros, com múltiplos tipos de ligação no mesmo nível | Agrupar por fase, ordenar cronologicamente e dar a cada marco uma ação principal |
| Resultados | Catálogo abre pelas execuções e respectivas configurações | Abrir pelas investigações e oferecer o catálogo de execuções como acesso secundário |
| Comparador | Gráficos e indicação de melhor valor aparecem em pares descritivos | Restringir gráficos a pares compatíveis e mostrar condições para os demais |
| Métricas e execuções | Identificadores, hashes e proveniência aparecem junto dos resultados | Usar rótulos científicos da execução e recolher os detalhes técnicos |
| Figuras | Filtro por campo e visualização ampliada | Relacionar cada figura à investigação e expor escopo e condições de leitura |
| Roadmap e recursos | Conteúdo editorial independente da curadoria | Preservar os vínculos existentes e a navegação por âncoras |

A revisão local tem sete investigações, sete marcos, 32 execuções, 13 comparações, 126 métricas e sete figuras. Cinco comparações são descritivas e oito estão bloqueadas. O build público padrão tem coleções experimentais vazias até a aprovação. A interface deve contemplar ambos os estados.

| Grupo | Pergunta que orienta o título |
| --- | --- |
| baseline-sst | O que o baseline SST permite medir? |
| replicas-ke | O padrão observado se mantém entre réplicas? |
| supervisao-sst | O que muda com a quantidade de supervisão? |
| gradientes-sst | O que os gradientes acrescentam ao modelo? |
| momento-ke | O que as variantes da restrição de momento permitem investigar? |
| multicaso-ke | Como o treinamento com múltiplos casos foi avaliado? |
| re32000-ke | O que a avaliação em Re 32.000 acrescenta? |

A sequência é estruturar os vínculos de apresentação, entregar a timeline e a investigação, ajustar as regras de apresentação das medições e figuras e validar o build e a revisão local. As fontes de referência são a SPEC v0.4, DATA_INVENTORY.md, RESEARCH_TIMELINE.md, o contexto científico editorial e o manifesto da curadoria local.

## Implementação e verificação

- Evolução agrupa os marcos por fase, ordena pela data confirmada e oferece filtros combinados por fase, categoria e evidência. A ação principal aponta para o grupo curado, com acesso ao marco quando o grupo está indisponível.
- A investigação contextualiza o protocolo, as observações e as limitações. Comparações, métricas, figuras e execuções ficam vinculadas aos registros originais. A fonte dos dados e os hashes permanecem nos painéis técnicos. A edição das perguntas bilíngues usa `data/scientific-context.json`. O build inclui a pergunta de um grupo somente quando houver um marco disponível na coleção.
- As rotas `#/evolucao`, `#/resultados/<grupo>`, `#/comparacoes/<comparação>` e `#/execucoes/<execução>` reutilizam IDs estáveis. Os fragmentos anteriores continuam resolvendo os mesmos registros. O build deriva do acervo autorizado apenas o identificador do resultado em destaque.
- Gráficos exigem uma condição `compatible` com referências, escopo, unidades e operadores coerentes. Comparações `descriptive_only` mostram valores individuais em tabela. As bloqueadas mostram os motivos e o acesso às execuções. A galeria conserva unidade, escala espacial, escala de cor e proveniência.
- O ambiente de revisão confirmou sete investigações, 32 execuções e sete figuras. As cinco comparações descritivas e as oito bloqueadas preservaram suas classificações. Um par sintético compatível confirmou o gráfico e a tabela em teste isolado.
- O Chromium carregou e recarregou uma investigação sob `/pinn-research-hub/`, verificou navegação por teclado, foco ao fechar modais, alternância PT/EN, estados vazios e filtros, e conferiu a largura da timeline e da investigação em 375, 768 e 1440 px. A revisão visual usou capturas locais.
- O build passou com o script estático nativo já adotado no projeto. O teste no subdiretório reproduziu o formato de URLs do GitHub Pages. A publicação e a verificação no GitHub Pages permanecem pendentes.

Comandos de validação e revisão local no diretório do Hub.

```sh
node scripts/build_site.mjs
node --test --test-isolation=none tests/science.test.mjs
../lab_experimentos/analytics/.venv/bin/python -B -m unittest discover -s tests -v
PINN_QA_SCREENSHOT_DIR=/tmp node tests/browser_science.mjs --local-review
node scripts/preview_site.mjs
```
