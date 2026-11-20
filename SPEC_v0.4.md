# SPEC v0.4 — PINN Research Hub: Scientific Exploration Experience

**Versão:** 0.4 · **Data:** 19/11/2026 · **Status:** proposta pronta para implementação incremental  
**Produto:** PINN Research Hub  
**Fontes de referência:** `SPEC_PINN_Research_Hub_v0.2.md`, `DATA_INVENTORY.md`, `RESEARCH_TIMELINE.md`, dados exportados pelo importador e implementação atual do portal.  
**Hospedagem:** GitHub Pages (`/pinn-research-hub/`)  
**Stack recomendada:** React + TypeScript + Vite; CSS existente/tokens, biblioteca de gráficos apenas quando justificada.

> **Objetivo central:** transformar a experiência de um catálogo técnico linear em uma **narrativa científica explorável**: **pergunta → marco na timeline → grupo experimental → comparação → métricas/figuras → configurações e proveniência**.

## 0. Instruções obrigatórias para o Codex

1. Inspecionar o código atual e os dados exportados **antes** de modificar componentes. Ler as especificações anteriores, o inventário e a timeline. O código real é a referência para caminhos e contratos efetivos; não presumir que exemplos desta SPEC sejam dados reais.
2. Preservar o importador, IDs estáveis, relacionamentos, contratos científicos, estados de evidência, filtros existentes, suporte PT/EN e deploy estático. Implementar **adaptadores/view models**, não duplicar nem alterar valores científicos para facilitar o frontend.
3. **Não inventar** métricas, datas, interpretações, unidades, resultados, seeds, métodos numéricos, conclusões ou comparabilidade. Exibir ausência de informação de forma honesta.
4. **Não remover** rastreabilidade: mover hashes e proveniência extensa para detalhes técnicos recolhidos ou visualização de auditoria; nunca exibi-los como texto principal do dashboard.
5. Reutilizar React + TypeScript + Vite caso já estejam presentes; se a aplicação ainda for HTML/JS, migrar apenas após auditoria e com plano de preservação de funcionalidade. Não usar Next.js, backend, banco de dados ou autenticação nesta versão.
6. **Publicação controlada:** nunca expor dados de staging, experimentos não aprovados, documentos privados, caminhos locais ou segredos. Conteúdo incluído em `public/` é público.
7. Implementar por etapas pequenas, com testes e screenshots desktop/mobile. Não substituir uma tela funcional por um mockup sem dados reais.

## 1. Diagnóstico visual da implementação atual

Baseado nas capturas fornecidas em 19/11/2026, **não** em auditoria de código:

| Observação | Consequência | Resposta v0.4 |
|---|---|---|
| Página única muito longa com seções técnicas sequenciais | Navegação cansativa, difícil localizar contexto | Páginas/rotas ou painéis de detalhe orientados pela timeline |
| Títulos com nomes de arquivos, IDs e hashes | O visitante não entende o propósito do experimento | Títulos editoriais, subtítulos científicos e nomes curtos de modelos |
| Tabelas enormes com definição/proveniência em cada linha | Quebra de leitura, colunas estreitas e excesso de rolagem | Tabela resumida filtrável + drawer de detalhe da métrica |
| Comparador prioriza configurações e mensagens de bloqueio | Resultado científico fica escondido | Visualização de métricas primeiro; contexto e limitações depois |
| Galeria com miniaturas pequenas e metadados repetidos | Gráficos CFD difíceis de interpretar | Miniaturas maiores, filtros e modal com imagem/legenda técnica |
| Timeline é lista de acordeões com blocos de texto | Não mostra a relação entre decisões e experimentos | Linha do tempo por fases, eventos e grupos experimentais conectados |
| Hero e cards ocupam muito espaço sem evidências | Baixa densidade de informação útil | Cabeçalho compacto e resultados em destaque com gráficos |
| Alertas globais demonstrativos/privados | Poluição visual e ambiguidade sobre publicação | Aviso contextual discreto, sem revelar material de staging |

**Não objetivo:** reduzir a quantidade de informação científica disponível. O objetivo é organizar a descoberta em níveis de detalhe.

## 2. Experiência e arquitetura de informação

### 2.1 Modelo mental do visitante

**Visão geral → Evolução → Investigação → Comparação → Execução → Auditoria.**

O visitante não precisa conhecer nomes de diretórios, manifests, IDs de runs ou hashes para navegar.

### 2.2 Navegação principal

- **Visão geral:** síntese do projeto, fase atual, achados/limitações em destaque e gráficos disponíveis.
- **Evolução:** timeline como entrada principal para os grupos experimentais.
- **Resultados:** catálogo exploratório de investigações e comparações, com filtros científicos.
- **Roadmap:** prioridades, questões abertas e próximos passos.
- **Publicações/recursos:** preservar conteúdo existente.

A **visão de execução individual** é secundária e acessível a partir da investigação/comparação; não despejar todos os runs na página inicial.

### 2.3 Rotas sugeridas

```text
/                              Visão geral
/evolucao                      Timeline
/evolucao/:eventId             Marco/investigação
/resultados                    Grupos experimentais
/resultados/:groupId           Visão da investigação
/comparacoes/:comparisonId     Comparação
/execucoes/:experimentId       Detalhes de execução
/roadmap                       Planejamento
/recursos                      Publicações e recursos
```

Se a aplicação já usa âncoras e navegação sem roteador, preservar links existentes por redirects/âncoras de compatibilidade. **GitHub Pages:** usar `basename` adequado ou HashRouter; testar abertura direta/reload de rotas. Preferir a solução mais simples compatível com o deploy atual.

## 3. Design system e linguagem visual

### 3.1 Direção

Manter a identidade escura científica já adotada, com melhor hierarquia, espaçamento, tipografia e contraste. **Não** recomeçar o design do zero. Dar destaque às figuras CFD e gráficos de métricas, não a superfícies decorativas.

Tokens de referência (ajustar após auditoria visual e teste de contraste):

| Token | Cor | Uso |
|---|---|---|
| `--bg` | `#0B1220` | Fundo geral |
| `--surface` | `#142237` | Cards/painéis |
| `--surface-raised` | `#1B2D46` | Conteúdo destacado |
| `--border` | `#30445D` | Separadores |
| `--text` | `#EDF3FA` | Texto principal |
| `--muted` | `#AFC1D4` | Metadados |
| `--accent` | `#67D9E8` | Links/ações |
| `--success` | `#42C59A` | Evidência validada |
| `--warning` | `#F0BD63` | Preliminar/atenção |
| `--danger` | `#F18D9A` | Comparação bloqueada |

Usar cores semânticas consistentes, mas **não depender apenas da cor**. Contraste mínimo WCAG AA em textos/controles. Evitar destacar todas as métricas com a mesma cor.

### 3.2 Hierarquia e densidade

- Container desktop com largura suficiente para gráficos e tabelas; texto corrido com largura confortável.
- Cabeçalho compacto, com título e contexto em 1–2 linhas.
- Primeiro viewport deve conter **ao menos um resultado visual útil**, quando houver evidência aprovada.
- Títulos descritivos; identificadores técnicos nunca como heading principal.
- Espaçamento consistente e menos cards dentro de cards.
- Em mobile, filtros recolhíveis e tabelas com rolagem horizontal/alternativa em cards.
- Estados vazios claros, com motivo e próximo passo, sem números fictícios.

### 3.3 Componentes previstos

`ResearchSummary`, `FeaturedFinding`, `MetricChart`, `ExperimentTimeline`, `TimelineMilestone`, `InvestigationOverview`, `ExperimentGroupCard`, `ComparisonOverview`, `MetricsTable`, `MetricDetailsDrawer`, `ScientificFigureGallery`, `FigureLightbox`, `ConfigurationAccordion`, `ProvenancePanel`, `ComparabilityNotice`, `FilterToolbar`, `EvidenceBadge`, `EmptyState`.

Não criar abstrações complexas sem reutilização real.

## 4. Timeline como estrutura central

### 4.1 Organização

Agrupar por **fases científicas** (por exemplo, fase histórica BFS k–ε e fase atual BFS k–ω SST), mantendo os rótulos/datas **reais** do `RESEARCH_TIMELINE.md`.

Dentro de cada fase, apresentar marcos com:

- Título compreensível (ex.: **Influência da continuidade na correção CFD**).
- Pergunta/hipótese principal.
- Data ou período confirmado; não inferir datas por nomes de arquivos sem verificação.
- Síntese de observação/limitação (quando documentada).
- Número de grupos e comparações vinculados.
- Estado da evidência (`verified`, `preliminary`, `planned`, `unknown`).
- CTA **Explorar resultados**.

### 4.2 Fluxo de exploração

Ao selecionar um marco:

1. Mostrar **pergunta científica** e por que o experimento foi realizado.
2. Mostrar **abordagem experimental** em linguagem concisa.
3. Mostrar **grupos/comparações vinculados**, com nomes descritivos.
4. Mostrar **resultados principais** com gráficos/tabela resumida, quando aprovados e comparáveis.
5. Mostrar **interpretação, limitações e próximos passos** de fontes verificadas.
6. Oferecer acesso a **execuções e detalhes técnicos**.

A timeline **não** deve repetir longas tabelas nem hashes.

### 4.3 Curadoria de títulos e resumos

Criar uma camada editorial **versionada**, não inferida dinamicamente por IA em produção. Exemplo de estrutura (não representa fato validado):

```json
{
  "eventId": "evt-replicas-ke",
  "title": {"pt": "Influência da continuidade na correção CFD", "en": "Effect of continuity on CFD correction"},
  "subtitle": {"pt": "MLP × PINN-cont em múltiplas seeds", "en": "MLP vs PINN-cont across seeds"},
  "researchQuestion": {"pt": "A continuidade melhora a consistência física?", "en": "Does continuity improve physical consistency?"},
  "groupIds": ["grp-replicas-ke"]
}
```

Os IDs e relações são internos. Títulos devem ser revisados por pessoa responsável antes de publicação.

## 5. Página de investigação/grupo experimental

**Ordem obrigatória das seções:**

1. **Cabeçalho científico:** título, pergunta, fase, caso CFD, Reynolds, modelos e status.
2. **Resumo:** objetivo, protocolo e achado/limitação validado; não inventar conclusão.
3. **Gráficos principais:** comparações pertinentes à pergunta, com unidade e escopo visíveis.
4. **Tabela de métricas:** filtrável, ordenável e exportável (CSV opcional).
5. **Figuras CFD:** galeria contextualizada.
6. **Execuções relacionadas:** nomes amigáveis, seed, modelo, configuração-chave.
7. **Configurações:** acordeão recolhido.
8. **Limitações e proveniência:** aviso resumido + drawer técnico.

### 5.1 Nomenclatura amigável

Exemplos de apresentação (não implicam aprovação de resultados):

- **Baseline SST — MLP × PINN com continuidade**.
- **Replicação k–ε — influência da seed**.
- **Redução da supervisão fine — 50% × 100%**.
- **Ablation de gradientes de entrada**.
- **Generalização entre Reynolds — investigação multicaso**.

Subtítulos devem indicar caso, Reynolds, modelos, escopo e seed quando relevante. **Não** usar `pinn_cont_base_k_epsilon_20260919_031921` como título visível.

### 5.2 Execuções

Cada execução deverá ter um `displayName` calculado a partir de metadados confirmados e/ou curadoria editorial, com fallback legível: `PINN-cont · BFS k–ε · Re 36.000 · seed 123`.

O `runId` pode aparecer em **Copiar referência técnica**, nunca como informação central. Não esconder IDs no DOM se forem necessários a links, mas evitar poluição visual.

## 6. Gráficos e comparador

### 6.1 Princípio

**Mostrar a evidência antes da configuração**, sem mascarar bloqueios de comparabilidade. Usar gráficos somente quando houver dados quantitativos com definição, unidade e escopo conhecidos.

### 6.2 Visualizações prioritárias

| Investigação | Gráfico recomendado | Restrição |
|---|---|---|
| MLP × PINN-cont | Barras/pontos por modelo e métrica | Mesma definição, unidade, escopo e protocolo |
| Replicações por seed | Dot plot/intervalos descritivos por seed | Seeds e splits claramente identificados |
| 50% × 100% supervisão | Pontos/linhas por fração de dados supervisionados | Fração confirmada e demais condições documentadas |
| Gradientes como features | Pares de barras/pontos por configuração | Avisar outras mudanças e seed única |
| Multi-Re | Facetas por Reynolds e modelo | Não afirmar generalização para Re não visto sem teste próprio |
| Campos CFD | Galeria ampliável com legendas | Escalas/unidades/operadores confirmados |

Não misturar RMSE de pressão, velocidade e divergência no mesmo eixo numérico. Preferir gráficos separados ou pequenas múltiplas.

### 6.3 Estado de comparabilidade

- `compatible`: permitir comparação quantitativa e cálculo de diferença relativa se definição permitir.
- `descriptive_only`: mostrar valores individuais e contexto lado a lado, **sem ranking, delta ou conclusão causal**.
- `blocked`: mostrar motivo específico e acesso às execuções individuais; **não** gerar gráfico comparativo quantitativo.

Se o comparador atual marcar como `blocked` um par aparentemente equivalente, **não** afrouxar a validação no frontend. Produzir diagnóstico de metadados faltantes (ex.: unidade não confirmada, fração supervisionada desconhecida) e orientar correção na fonte/importador.

### 6.4 Semântica dos indicadores

- Informar claramente **menor é melhor** para métricas de erro quando aplicável.
- Indicar valor e unidade; nunca assumir unidade a partir de nome de arquivo.
- Mostrar referência **RANS fine**, não DNS, quando for esse o caso.
- Distinguir `divergence_corrected.rmse` de `divergence_error_corrected_vs_fine.rmse`.
- Identificar `test` e `full_domain` em qualquer visualização.
- Indicar operador de divergência quando a interpretação depender dele.
- Para múltiplas seeds, não tratar observações correlacionadas como amostras independentes sem justificativa.

## 7. Tabela de métricas: clareza com detalhe sob demanda

### 7.1 Colunas padrão

**Modelo | Seed | Métrica | Escopo | Valor | Unidade | Evidência**.

Opcionalmente **Reynolds** e **Configuração** quando o filtro incluir múltiplos casos. Não mostrar hashes, descrição longa, método completo e número de pontos como colunas padrão.

### 7.2 Filtros e comportamento

- Filtros combináveis: modelo, seed, grandeza/métrica, escopo, Reynolds (quando aplicável), evidência e operador (quando necessário).
- Ordenação por métrica, modelo, seed e valor.
- Busca textual por nome amigável.
- Paginação ou virtualização se o conjunto justificar.
- Estado de filtros refletido em URL quando possível.
- **Detalhes** em drawer/modal por linha: definição, fórmula (se disponível), referência, método, operador, pontos avaliados/válidos, máscara, fonte, hash e ID.
- Valores faltantes exibidos como **Não informado**, sem conversão para zero.
- Unidades longas e números grandes devem ser formatados de modo legível; preservar valor bruto em detalhe/CSV.
- Exportação CSV opcional deve refletir os filtros e informar escopo e unidade.

### 7.3 Agrupamento

Separar visualmente **Acurácia**, **Consistência física** e **Eficiência experimental**. Não misturar métricas incompatíveis na mesma classificação.

## 8. Galeria de figuras científicas

- Agrupar por investigação e comparação; permitir filtros por categoria, modelo, escopo e caso.
- Miniaturas em proporção apropriada para gráficos científicos, com tamanho suficiente para identificar conteúdo.
- Modal/lightbox com zoom, legenda completa, unidade, escala, operador, referência e vínculo para experimento.
- Não repetir hashes em cards de galeria.
- Evitar thumbnails de baixa legibilidade; usar imagens otimizadas, preservando original publicável quando necessário.
- Não agrupar como comparáveis figuras com escalas de cor diferentes sem alerta explícito.
- Texto alternativo descritivo; navegação por teclado e botão de fechar acessível.

## 9. Dashboard inicial

### 9.1 Estrutura

1. **Cabeçalho compacto**: título, resumo de uma frase, fase e atualização dos dados.
2. **Questão científica atual**: problema e hipótese em investigação, com CTA para timeline.
3. **Resultados em destaque**: 1–2 gráficos reais aprovados, com origem e contexto.
4. **Marcos recentes**: até 3 eventos da timeline com links.
5. **Explorar investigações**: cards de grupos científicos relevantes.
6. **Próximos passos**: prioridades curtas, com link ao roadmap.

### 9.2 Indicadores

Preferir indicadores com significado: grupos curados, comparações publicadas, condições de Reynolds documentadas, última avaliação. Não usar contadores administrativos sem contexto nem indicadores de progresso científico arbitrário.

### 9.3 Avisos

Se os dados forem demonstrativos ou de staging, **não publicá-los**. Em ambiente local, mostrar um aviso compacto de modo de revisão. Em produção, somente registros aprovados e avisos pertinentes a eles.

## 10. Contratos de dados e adaptadores

### 10.1 Regra de compatibilidade

Não reescrever JSONs científicos apenas para acomodar componentes visuais. Criar `view models` TypeScript que combinem dados existentes e metadados editoriais.

Exemplo de interfaces (adaptar ao schema real):

```ts
interface LocalizedText { pt: string; en?: string }
interface InvestigationView {
  id: string;
  phaseId: string;
  title: LocalizedText;
  question?: LocalizedText;
  summary?: LocalizedText;
  eventIds: string[];
  comparisonIds: string[];
  experimentIds: string[];
  evidenceStatus: 'verified' | 'preliminary' | 'planned' | 'unknown';
}
interface MetricView {
  experimentId: string;
  modelLabel: string;
  seed: number | null;
  metricKey: string;
  metricLabel: LocalizedText;
  scope: string | null;
  value: number | null;
  unit: string | null;
  comparabilityStatus?: 'compatible' | 'descriptive_only' | 'blocked';
}
```

### 10.2 Camada editorial

Arquivo versionado sugerido `public/data/presentation.json` ou equivalente, contendo **apenas** títulos, resumos, ordem de destaque e vínculos com IDs existentes. Não duplicar valores numéricos nem sobrescrever conclusões de fontes.

### 10.3 Validadores

- Integridade de `eventId → groupId → comparisonId → experimentId → metric/figure`.
- IDs únicos, referências existentes, URLs e imagens válidas.
- `displayName` não vazio com fallback.
- Campos editoriais PT/EN ou fallback visível.
- Não expor `sourcePath` local ou dados de staging.
- Checagem de consistência entre status de comparabilidade e renderização de gráficos.

### 10.4 Proveniência

Preservar hashes de dataset/split/configuração e fontes, porém exibi-los **somente no painel de auditoria**, com quebra adequada de linhas, botão de copiar e explicação do significado. Nunca usar uma coluna inteira de hashes em cards ou tabelas principais.

## 11. Estrutura frontend sugerida

```text
src/
  app/                 rotas, providers e i18n
  pages/               Overview, Timeline, Investigation, Results, Comparison, RunDetails
  components/
    timeline/
    charts/
    metrics/
    experiments/
    figures/
    common/
  data/                loaders e validação
  adapters/            normalização para view models
  types/               tipos científicos e editoriais
  styles/              tokens e componentes
public/
  data/                JSONs públicos aprovados
  figures/             imagens públicas aprovadas
scripts/               importador existente: preservar
```

**Bibliotecas:** manter Vite/React/TypeScript; preferir a biblioteca de gráficos já presente. Se não existir, escolher uma biblioteca leve adequada a gráficos de barras, pontos e facetas; justificar a escolha. Não adicionar dependências apenas por estética. Manter `base: '/pinn-research-hub/'` ou configuração equivalente.

## 12. Plano de implementação incremental

### Etapa A — Auditoria e UX map

- Ler código, SPEC v0.2, inventário, timeline e contratos atuais.
- Mapear navegação, filtros, gráficos, importador e publicação.
- Gerar `docs/UX_AUDIT_v0.4.md` com telas existentes, problemas e plano de migração.
- Criar mapeamento de títulos amigáveis para eventos/grupos sem inventar interpretações.

### Etapa B — Camada semântica

- Implementar `presentation.json`/view models e validações.
- Relacionar timeline, grupos, comparações e runs.
- Garantir fallback amigável e ocultação visual de IDs/hashes.

### Etapa C — Timeline e investigação

- Reorganizar timeline por fases.
- Criar página/painel de investigação com pergunta, objetivo, resultados e links.
- Garantir navegação reversa e deep links.

### Etapa D — Métricas e gráficos

- Criar tabela resumida com filtros e drawer técnico.
- Criar gráficos para comparações `compatible`.
- Respeitar `descriptive_only` e `blocked`, sem atalhos.
- Adicionar estados vazios contextualizados.

### Etapa E — Dashboard e galeria

- Substituir lista de links por resultados visuais aprovados.
- Compactar hero e cards.
- Melhorar galeria e lightbox.

### Etapa F — Qualidade e deploy

- Testes unitários, integração e navegação.
- Revisão visual desktop/tablet/mobile.
- Verificação de acessibilidade, performance e links.
- Build e deploy de teste no GitHub Pages.
- Relatório de mudanças e pendências.

## 13. Testes e critérios de aceite

### Navegação e conteúdo

- [ ] Visitante chega de um marco da timeline a uma investigação e às comparações relacionadas em até 2 interações principais.
- [ ] Toda investigação tem título legível e pergunta/objetivo quando documentados.
- [ ] IDs e hashes não aparecem em títulos, cards principais ou tabelas resumidas.
- [ ] A informação técnica continua acessível por painel de detalhes/auditoria.
- [ ] Os filtros funcionam em conjunto e podem ser limpos.
- [ ] PT/EN permanece funcional, inclusive nos títulos editoriais ou fallback explícito.

### Resultados científicos

- [ ] Pelo menos um grupo aprovado com métricas compatíveis apresenta gráfico e tabela coerentes.
- [ ] Métricas de unidades/escopos diferentes não são agregadas indevidamente.
- [ ] Comparações `blocked` não exibem ranking nem delta.
- [ ] Comparações `descriptive_only` são identificadas sem conclusão causal.
- [ ] `null` não é exibido como zero.
- [ ] Referência RANS fine não é descrita como DNS/verdade física absoluta.
- [ ] Galeria mantém unidade, escala e proveniência.

### Qualidade técnica

- [ ] Nenhum resultado científico original foi alterado pelo frontend.
- [ ] O importador continua funcionando e os contratos permanecem compatíveis.
- [ ] Nenhum dado privado/staging foi publicado.
- [ ] Build Vite concluído sem erro.
- [ ] Navegação/reload funcionam sob `/pinn-research-hub/`.
- [ ] Layout utilizável em 375 px, 768 px e desktop.
- [ ] Controles acessíveis por teclado e contrastes adequados.
- [ ] Testes e documentação de migração atualizados.

## 14. Fora do escopo

- Banco de dados, backend, autenticação, edição de experimentos pelo navegador.
- Treinamento/inferência de PINNs no frontend.
- Recalcular métricas físicas a partir de figuras ou arquivos incompletos.
- Publicação automática de resultados não aprovados.
- Ranking global entre fases k–ε e SST.
- Reconstrução automática de conclusões científicas a partir de commits.

## 15. Entregáveis esperados do Codex

1. Auditoria inicial e plano de implementação.
2. Camada semântica/editorial versionada.
3. Timeline navegável por fases e investigações.
4. Páginas de investigação, comparação e execução com níveis progressivos de detalhe.
5. Gráficos, tabela filtrável e galeria melhorada.
6. Dashboard mais compacto, centrado em evidências.
7. Testes, documentação, build e relatório final.

## 16. Prompt de execução sugerido

> Leia `SPEC_PINN_Research_Hub_v0.4.md`, `SPEC_PINN_Research_Hub_v0.2.md`, `DATA_INVENTORY.md` e `RESEARCH_TIMELINE.md`, além de auditar a implementação atual do portal e o pipeline de importação. Implemente a v0.4 de forma incremental, preservando React + TypeScript + Vite (se já adotados), os dados científicos, a rastreabilidade, PT/EN e GitHub Pages. Priorize timeline → investigação → comparação → métricas/figuras; títulos científicos legíveis; gráficos e tabelas filtráveis; e detalhes técnicos sob demanda. Não invente resultados nem relaxe bloqueios de comparabilidade. Antes de alterar o código, apresente um plano curto; ao final, rode testes/build, valide navegação e documente as pendências.

---

### Nota de precedência

A SPEC v0.4 **complementa e atualiza a experiência de apresentação** das versões anteriores. As regras de ingestão, integridade científica, proveniência, segurança e publicação controlada permanecem vigentes. Se houver conflito entre esta SPEC e o código atual, registrar a decisão no relatório de migração; **não** descartar dados válidos silenciosamente.
