# SPEC v0.5 — PINN Research Hub
## Dashboard analítico, curadoria temporal e exploração científica

**Versão:** 0.5  
**Data:** 19/11/2026  
**Status:** especificação de implementação para Codex  
**Base:** `SPEC_PINN_Research_Hub_v0.4.md`, `SPEC_PINN_Research_Hub_v0.2.md`, `DATA_INVENTORY.md`, `RESEARCH_TIMELINE.md` e artigo *Physics-Informed Correction of RANS-Based CFD Fields for Backward-Facing Step Flow: Accuracy, Continuity, and Current Limitations* (`main(2).pdf`).

> **Objetivo:** evoluir o portal existente — sem recomeçar o projeto — para um dashboard científico moderno, legível e rastreável. A timeline continua sendo a estrutura narrativa; o dashboard e o explorador de métricas tornam-se as principais ferramentas analíticas.

---

## 0. Instruções obrigatórias ao Codex

1. **Auditar o código e os dados reais antes de modificar qualquer contrato.** Ler esta SPEC, a v0.4, o inventário, a timeline e os arquivos de ingestão/importação existentes. Identificar as rotas, os componentes, os schemas, as fontes JSON, as figuras e as regras de curadoria atuais.
2. Preservar **React + TypeScript + Vite** caso já estejam implementados. Não migrar para outra stack nem introduzir backend, banco de dados ou serviço externo nesta versão.
3. **Não alterar resultados científicos brutos**, nem criar valores, datas, unidades, métricas ou conclusões para preencher lacunas.
4. Distinguir rigorosamente **run de treinamento**, **avaliação/reavaliação**, **comparação**, **investigação**, **evento da timeline** e **registro selecionado para publicação**.
5. Manter PT/EN, acessibilidade, funcionamento no GitHub Pages e compatibilidade com os dados importados da v0.4.
6. Propor um plano curto com mapeamento `fonte → campo → componente` antes de implementar. Priorizar mudanças incrementais e testáveis.
7. **Se uma informação não puder ser recuperada com segurança, apresentar `Não informado` e registrar a pendência**, nunca inferir timestamp a partir da data de importação ou da atualização do arquivo sem identificá-lo como aproximação.
8. O dashboard deve respeitar o status de publicação: dados locais/privados podem alimentar revisão interna, mas não devem vazar no build público.

### Precedência

Esta v0.5 substitui as orientações de **design, dashboard, catálogo de execuções, tabelas e apresentação de comparações** da v0.4. Permanecem válidas as regras anteriores de integridade, evidência, curadoria, localização, importação, segurança e publicação, salvo alteração explícita nesta SPEC.

---

## 1. Diagnóstico da v0.4 e resultados esperados

### Problemas observados nas capturas

- Uso excessivo de cards com bordas: pouca diferenciação entre visão geral, navegação e dados técnicos.
- Dashboard inicial apresenta contadores de grupos/hipóteses, mas não mostra atividade experimental, distribuição por família nem evolução temporal.
- Execuções com modelos, Reynolds e seeds iguais ficam indistinguíveis sem **data e hora efetivas**.
- Tabelas apresentam subconjunto limitado das métricas, enquanto os logs e JSONs contêm informações adicionais.
- Repetição de avisos de comparações bloqueadas cria páginas longas sem acrescentar clareza.
- IDs técnicos, hashes e detalhes de proveniência disputam espaço com o significado científico.
- A narrativa da pesquisa e as conclusões precisam refletir melhor o artigo, especialmente a distinção entre **acurácia de campo** e **diagnóstico de continuidade**.

### Resultado da v0.5

O visitante deve conseguir responder, com poucos cliques:

1. **O que foi investigado?** — timeline, fases, hipóteses e investigações.
2. **Quanto foi executado e quando?** — contadores, gráficos temporais, família e status de curadoria.
3. **Qual execução é esta?** — título científico, data e hora, seed, caso, referência e configuração.
4. **Quais métricas estão disponíveis?** — tabela dinâmica derivada dos JSONs, com unidade, escopo e origem.
5. **Quais comparações são legítimas?** — requisitos de comparabilidade explícitos e conclusões restritas à evidência.
6. **Quais resultados merecem destaque?** — curadoria, figuras e síntese científica com limitações.

---

## 2. Arquitetura de informação e navegação

### 2.1 Navegação principal

- **Visão geral:** dashboard executivo-científico, atividade experimental, destaque, próximas decisões.
- **Evolução:** timeline cronológica, organizada por fase e investigação.
- **Resultados:** catálogo de investigações, comparações, execuções e métricas.
- **Roadmap:** marcos, prioridades e próximos experimentos.
- **Recursos:** repositórios, referências e publicações documentadas.

### 2.2 Fluxo de exploração

`Visão geral → gráfico/indicador → lista filtrada de execuções → investigação → execução → métricas/configuração/figuras`.

Fluxo narrativo complementar: `Timeline → evento → investigação → comparação → execuções e evidências`.

Os dois fluxos devem convergir para **as mesmas entidades canônicas**, evitando páginas duplicadas com resultados inconsistentes. Preservar deep links e histórico de navegação; usar rotas existentes e manter reload compatível com GitHub Pages (hash routing, se já adotado).

### 2.3 Princípio de densidade progressiva

- **Visão geral:** síntese, não logs.
- **Investigação:** pergunta, método, resultados e limitações.
- **Execução:** identidade temporal e resumo de métricas.
- **Detalhe técnico:** configuração completa, métricas extras, hashes e proveniência.

---

## 3. Design system — visual corporativo e clean

### 3.1 Direção visual

Estética de **research analytics / enterprise SaaS**: sóbria, moderna, tipografia clara, gráficos consistentes, sem ornamentação desnecessária. Manter dark mode como padrão, com superfícies de contraste sutil. Não transformar todos os agrupamentos em cards.

**Regras:**

- Substituir bordas em cascata por **espaçamento, alinhamento, tipografia, separadores discretos e superfícies pontuais**.
- Usar cards principalmente para KPIs, gráficos ou resultados em destaque — não para cada campo ou parágrafo.
- Criar hierarquia visual consistente: título de página → resumo → indicadores → gráficos → tabela → detalhes.
- Usar uma cor principal de ação (ciano/teal ou equivalente já existente); reservar verde, âmbar e vermelho para estados semânticos.
- Reduzir texto em caixa alta, badges repetidos e links sublinhados excessivos.
- Preferir uma **tabela de execuções** a grades de cartões repetitivos.
- Tornar filtros compactos, alinhados e recolhíveis em telas menores.
- Tratar textos longos como blocos de leitura, não como colunas estreitas de metadados.
- Oferecer estados de carregamento, vazio, erro e informação indisponível sem grandes painéis de alerta.

### 3.2 Componentes

`PageHeader`, `SectionHeading`, `KpiStrip`, `ChartPanel`, `FilterToolbar`, `DataTable`, `StatusBadge`, `ExperimentDrawer`, `MetricDetails`, `ScientificFinding`, `EvidenceNotice`, `TimelineEvent`, `FigureViewer`, `AuditPanel`.

Não criar biblioteca interna genérica sem necessidade. Reaproveitar componentes da v0.4. Biblioteca de gráficos e tabela é opcional; escolher solução leve, acessível, compatível com Vite e com manutenção simples. Justificar dependências novas.

### 3.3 Responsividade e acessibilidade

- Desktop: gráficos em grid 2 colunas e tabelas com espaço adequado.
- Tablet: gráficos em 1–2 colunas, filtros reorganizados.
- Mobile (~375 px): KPIs em fluxo, gráficos legíveis, tabelas com rolagem horizontal ou colunas essenciais.
- Navegação por teclado, foco visível, rótulos de controles, contraste suficiente e resumo textual dos gráficos.
- Evitar depender apenas de cores para comunicar status.

---

## 4. Dashboard analítico — nova visão geral

### 4.1 Faixa de indicadores

Indicadores calculados a partir do **catálogo de execuções canônicas**, não do número de arquivos JSON:

1. **Execuções registradas:** runs distintos identificados no inventário, com escopo claramente indicado.
2. **Execuções selecionadas:** subconjunto curado para exibição pública.
3. **Investigações:** grupos científicos cadastrados, sem confundir com runs.
4. **Comparações elegíveis:** comparações com protocolo de compatibilidade atendido.
5. **Última execução:** timestamp real mais recente entre runs válidos; mostrar fuso e escopo.

Cada indicador deve possuir tooltip com definição, escopo e política de contagem. Se o acervo disponível for apenas parcial, exibir **“no catálogo importado”** em vez de insinuar cobertura total do laboratório.

### 4.2 Gráficos obrigatórios

**G1 — Execuções por família de modelo**
- Barras horizontais: MLP, PINN-cont, PINN-mom, PINN-cont+mom e outras famílias documentadas.
- Contar runs canônicos, não JSONs, imagens, seeds ou reavaliações duplicadas.
- Clique em barra filtra a tabela de execuções.

**G2 — Atividade experimental no tempo**
- Série temporal de execuções por dia/semana/mês (granularidade selecionável quando houver volume).
- Basear-se em `executed_at` confirmado. Runs sem timestamp confirmado ficam em contador separado **“data pendente”**, nunca alocados arbitrariamente.
- Alternar “todas as execuções importadas” / “selecionadas para o Hub” se permitido pelo perfil de publicação.

**G3 — Distribuição por número de Reynolds**
- Barras por valor ou faixa documentada. Runs multicaso devem ser classificados de modo explícito, evitando dupla contagem silenciosa.

**G4 — Distribuição por modelo de turbulência**
- k–ε, k–ω SST e outros identificados, com categoria `Não informado`.

### 4.3 Gráfico científico condicionado à comparabilidade

**G5 — Acurácia × consistência física (opcional quando elegível)**
- Dispersão por modelo ou execução; eixo X = métrica de acurácia escolhida, eixo Y = diagnóstico físico escolhido.
- Exigir **mesmo significado da métrica, unidade, escopo, referência, conjunto de avaliação e operador físico** conforme protocolo.
- Exibir seed, timestamp e investigação no tooltip.
- Não unir fases k–ε e SST num ranking global; permitir segmentação e rótulo de protocolo.
- Se nenhuma comparação for elegível, apresentar explicação compacta e acesso às métricas individuais, **não um gráfico vazio ou enganoso**.

### 4.4 Interação e filtros

Filtros globais aplicáveis aos gráficos e ao catálogo: fase, família/modelo, Reynolds, turbulência, intervalo de execução e status de curadoria. Filtros devem ter estado compartilhado, reset e URL persistente quando viável. Exibir número de registros após filtragem.

### 4.5 Resultado em destaque

Manter **um** destaque editorial: figura científica + título + conclusão curta + escopo + limitações + link para investigação. O destaque deve ser selecionado por curadoria, não pelo run mais recente automaticamente.

---

## 5. Identidade temporal, deduplicação e curadoria de execuções

### 5.1 Modelo conceitual

- **TrainingRun:** execução original de treinamento, identificada por run ID e evidência de origem.
- **EvaluationRecord:** cálculo de métricas realizado sobre um TrainingRun, potencialmente em outro momento e com outro operador/protocolo.
- **Comparison:** associação curada entre runs/avaliações.
- **Investigation:** questão científica que agrupa comparações e resultados.
- **TimelineEvent:** marco científico/documental que referencia investigações.
- **PublicationSelection:** decisão editorial sobre visibilidade e destaque de um run ou investigação.

Uma execução pode ter múltiplas avaliações. Uma avaliação não deve aumentar o contador de runs. Um mesmo run em pastas `old/`, `standalone/` ou cópias não deve ser contado novamente sem evidência de execução distinta.

### 5.2 Campos temporais

```ts
interface TemporalMetadata {
  executedAt: string | null;      // ISO 8601 com offset explícito quando conhecido
  executedAtSource: 'run_metadata' | 'log' | 'manifest' | 'run_name' | 'unknown';
  executedAtConfidence: 'confirmed' | 'inferred' | 'unknown';
  evaluatedAt?: string | null;    // data da avaliação, quando documentada
  importedAt: string;             // data de ingestão no catálogo
  publishedAt?: string | null;    // data de disponibilização no Hub
  timezone?: string | null;       // zona IANA, quando conhecida
}
```

**Política de confiança:**

1. Preferir timestamp explícito do metadado da execução ou log original.
2. Se apenas o nome do run contiver `YYYYMMDD_HHMMSS`, armazenar a informação como **inferida do nome**; não atribuir UTC/Brasília sem evidência. Pode guardar timestamp local e `timezone: null`, com status de confiança apropriado.
3. `mtime` do arquivo e data de importação **não são evidência suficiente** para `executedAt` confirmado.
4. Se não houver timestamp seguro, `executedAt = null` e interface exibe `Data/hora não confirmadas`.
5. Não confundir hora de início, fim ou criação de arquivo. Se a origem permitir, armazenar `startedAt` e `finishedAt` separadamente e documentar qual delas alimenta `executedAt`.
6. Ordenação temporal: runs confirmados por data/hora; runs inferidos identificados; sem data no final. Evitar desempate por ordem aleatória.

### 5.3 Título legível de execução

Formato recomendado:

**`PINN-cont · k–ω SST · Re 5.100`**  
`13/11/2026, 21:32:58 · seed 42 · continuidade`  
`Avaliação: 13/11/2026, horário não informado` (somente se documentado)

Usar valores reais; o exemplo é **ilustrativo, não uma execução confirmada**. Mostrar o timestamp como atributo primário, não escondido no painel de auditoria. ID interno permanece disponível para copiar em “Detalhes técnicos”.

### 5.4 Curadoria

Definir estado editorial separado do estado científico:

```ts
type CurationStatus = 'featured' | 'supporting' | 'archived' | 'excluded' | 'pending_review';
type EvidenceStatus = 'verified' | 'preliminary' | 'planned' | 'unknown';
```

- `featured`: execução representativa, aprovada para destaque.
- `supporting`: execução de apoio, disponível em investigação/tabela.
- `archived`: histórica, acessível em exploração avançada se publicada.
- `excluded`: não exibida no catálogo público, mas preservada no inventário local.
- `pending_review`: requer curadoria; **não publicar automaticamente**.

Status de curadoria não equivale a qualidade científica. Não deduzir “melhor execução” de menor loss ou menor divergência sem protocolo.

### 5.5 Catálogo completo × catálogo público

Manter **uma fonte de inventário** e gerar duas projeções no pipeline:

- `catalog_all` (uso local/autorizado): runs canônicos e avaliações catalogadas, inclusive históricos.
- `catalog_public` (GitHub Pages): apenas registros explicitamente aprovados, com campos/artefatos autorizados.

**Crítico:** o build público não deve incluir `catalog_all`, arquivos brutos privados ou dados excluídos em `public/`, assets ou sourcemaps. O dashboard público contabiliza apenas o universo realmente publicado, indicando esse escopo. Nunca oferecer seletor que exponha dados privados por acidente.

---

## 6. Evolução do importador e contratos de dados

### 6.1 Preservação

Não substituir o importador existente sem necessidade. Adicionar uma etapa de **normalização/curadoria**, que lê metadados e JSONs originais e produz view models estáveis. Preservar compatibilidade com os IDs da v0.4 e criar migração documentada se houver alteração de chave.

### 6.2 Fontes a mapear na auditoria

Conforme `DATA_INVENTORY.md`, procurar no checkout local, **sem presumir que todos os arquivos estejam presentes**:

- `logs/{mlp,pinn,old}/<run>/*.json` e CSVs de histórico de treinamento.
- `results/metrics/{mlp,pinn}/<run>/*.json`, incluindo variantes `old/` e `standalone/`.
- `results/comparisons/<par>/baseline_pair_manifest_*.json`, `fairness_report_*.json` e `plots/comparison_report.json`.
- `results/comparisons/experiments_full.{csv,parquet}` e demais consolidações da primeira fase.
- Configurações efetivas registradas nos logs; YAML atual somente como referência auxiliar.
- Figuras vinculadas por manifesto e inventário.

O inventário indica que **uma execução pode possuir vários JSONs de avaliação**, reavaliações e cópias históricas. Por isso, contagens de arquivos e pastas não são equivalentes a execuções.

### 6.3 Tipos sugeridos (adaptar ao schema real)

```ts
interface RunView {
  id: string;                         // identificador técnico estável
  displayTitle: string;
  family: string;
  model: string;
  phaseId: string;
  investigationIds: string[];
  cfdCase: string | null;
  reynolds: number[];
  turbulenceModel: string | null;
  seed: number | null;
  datasetLabel: string | null;
  referenceType: 'RANS_FINE' | 'DNS' | 'LES' | 'EXPERIMENT' | 'UNKNOWN';
  temporal: TemporalMetadata;
  evidenceStatus: EvidenceStatus;
  curationStatus: CurationStatus;
  evaluationIds: string[];
  figureIds: string[];
}
interface EvaluationView {
  id: string;
  runId: string;
  evaluatedAt: string | null;
  metricIds: string[];
  protocolId: string | null;
  operatorId: string | null;
  sourceRefs: string[];               // referências internas, não caminhos privados públicos
}
interface MetricView {
  id: string;
  evaluationId: string;
  key: string;                        // nome bruto preservado
  label: string;                      // nome legível
  category: 'accuracy' | 'physics' | 'training' | 'other';
  value: number | null;
  unit: string | null;
  scope: string | null;
  reference: string | null;
  calculationMethod: string | null;
  nPoints: number | null;
  evidenceStatus: EvidenceStatus;
}
```

**Não exigir migração de todos os dados para esses nomes**: o objetivo é definir uma camada de leitura com adaptadores e validação de campos reais.

### 6.4 Regras de ingestão

- **Idempotência:** importar o mesmo checkout duas vezes não duplica runs, avaliações ou figuras.
- **Identidade canônica:** usar run ID + origem do projeto + evidências; hashes ajudam a auditar, mas não devem ser usados isoladamente para fundir runs distintos com a mesma configuração.
- **Relação 1:N:** um run → múltiplas avaliações e métricas.
- **Métricas heterogêneas:** mapear todas as métricas numéricas pertinentes dos JSONs de logs/avaliação, com categoria e proveniência; não inventar unidades.
- **Campos ambíguos:** manter chave original e sinalizar “unidade/escopo não confirmado”. Não agregar automaticamente.
- **Conflitos:** produzir relatório de divergências de timestamps, unidades, seeds, referências e vínculos.
- **Não modificar fontes científicas:** gerar apenas artefatos derivados versionados ou de build.
- **Tamanho:** evitar enviar Parquets, checkpoints ou centenas de PNGs brutos ao frontend; publicar apenas metadados e imagens aprovadas.

### 6.5 Manifesto de cobertura

Gerar resumo auditável do processo:

- runs descobertos, runs canônicos, duplicatas detectadas;
- runs com timestamp confirmado, inferido e ausente;
- avaliações encontradas e métricas reconhecidas;
- runs por família/fase;
- runs publicados, arquivados e pendentes;
- registros ignorados e justificativa.

Não tratar contagens do inventário Markdown como números fixos do dashboard; calcular a partir do catálogo gerado.

---

## 7. Explorador de execuções e métricas

### 7.1 Catálogo de execuções

Substituir grade extensa de cards por **tabela compacta, ordenável e filtrável**, com colunas iniciais:

| Execução | Data/hora | Família/modelo | Caso/Re | Seed | Avaliações | Curadoria |
|---|---|---|---|---|---|---|
| Nome científico curto | Data e hora reais ou pendentes | MLP / PINN-cont etc. | BFS / Reynolds | Seed | Contagem | Estado |

Filtros: fase, investigação, modelo, Reynolds, turbulência, período, seed, curadoria, disponibilidade de métricas. Clique na linha abre página ou drawer de detalhes; preservar link direto.

### 7.2 Página/drawer da execução

**Cabeçalho:** título legível, `executedAt`, seed, fase, CFD, referência, status.  
**Resumo:** objetivo, variante, arquitetura, entradas/alvos, dataset e protocolo.  
**Métricas:** tabela com grupos e filtros.  
**Treinamento:** duração, épocas, loss, pesos físicos, pontos, hardware, histórico, quando documentados.  
**Figuras:** galeria filtrada para a execução.  
**Auditoria:** IDs, hashes, fontes, método de extração e confiança temporal.

### 7.3 Tabela de métricas dinâmica

O Hub deve exibir **todas as métricas elegíveis existentes nos JSONs**, não somente quatro métricas pré-selecionadas. Diferenciar métricas de avaliação, logs de treino e estatísticas de execução.

**Modo A — Matriz comparativa (padrão em investigação):** linhas = runs/avaliações, colunas = métricas selecionadas; identificador visual inclui **timestamp e modelo**. Cabeçalhos apresentam unidade e escopo. Só permitir comparação quantitativa entre colunas de protocolo compatível.

**Modo B — Lista detalhada (padrão em execução):**

| Métrica | Valor | Unidade | Escopo | Referência | Método | Avaliação |
|---|---:|---|---|---|---|---|
| RMSE velocidade | do JSON | conforme fonte | Teste | RANS fine | conforme fonte | timestamp/ID interno |

**Filtros:** categoria (Acurácia, Consistência física, Treinamento, Todas), métrica, escopo, modelo, seed, Reynolds, intervalo temporal, método e evidência. Ordenação, pesquisa textual, reset e exportação CSV **apenas de dados públicos/filtrados**.

**Exibição:** formatação numérica consistente, unidades explícitas, `null → Não informado`, tooltips com definição, painel “Detalhes da medida” com origem e cálculo. Valores de métricas distintas não devem compartilhar uma mesma coluna apenas por nome parecido.

### 7.4 Métricas de treinamento

Quando disponíveis nos logs, incluir duração de treino, melhor validação, número de épocas executadas, early stopping, pesos `w_data`, `w_cont`, `w_mom`, batch size e séries de loss. Não apresentar `best_val` genérico como se fosse RMSE de teste; preservar sua semântica e protocolo.

### 7.5 Performance

Usar paginação/virtualização somente se necessária; não carregar todos os logs ou figuras de todas as execuções na primeira renderização. Preparar índices/agregados estáticos no build quando conveniente.

---

## 8. Comparabilidade e gráficos científicos

### 8.1 Separar três estados

- `compatible`: comparação quantitativa permitida pelo protocolo documentado.
- `descriptive_only`: resultados individuais exibidos lado a lado; diferenças relevantes impedem inferência direta.
- `blocked`: faltam campos críticos ou há incompatibilidade de definição/unidade/escopo/operador; não mostrar delta nem ranking.

### 8.2 Regras científicas

A compatibilidade de **métricas** requer equivalência de definição, unidade, domínio/partição, referência e método/operador; a compatibilidade de **desenho experimental** deve ser avaliada separadamente. Mudanças intencionais de peso de perda, orçamento de treino ou fração de supervisão **podem ser a variável estudada**; não bloqueá-las automaticamente, mas explicitar o que foi controlado e o que mudou.

Não comparar diretamente divergência de OpenFOAM com divergência obtida por autograd/LSQ sem identificar operador e discretização. Não inferir conservação integral apenas de RMSE de divergência. Não equiparar RANS fine a DNS, LES ou verdade experimental.

### 8.3 Interface para comparação indisponível

Substituir múltiplos alertas por **um resumo de elegibilidade**, com contador de pendências e checklist expansível:

`Comparação quantitativa indisponível — unidade e fração supervisionada não confirmadas.`

Exibir medidas individuais, quando válidas, sem delta ou conclusão comparativa. Não repetir o mesmo alerta para cada métrica.

### 8.4 Gráficos de comparação

- Barras pareadas para métricas compatíveis.
- Dispersão acurácia × divergência para análises de compromisso (trade-off).
- Séries de loss para runs com histórico e eixos identificados.
- Quando houver replicações adequadas, média ± desvio-padrão, com `n` e seeds explícitos.
- Gráficos devem conter título, unidade, referência, escopo, operador e link para fonte; figuras pré-geradas continuam acessíveis na galeria.

---

## 9. Narrativa científica e uso do artigo como referência

### 9.1 Estrutura editorial por investigação

Cada investigação deve conter, quando houver evidência:

1. **Pergunta/objetivo** — hipótese científica, não nome de pasta.
2. **Método** — caso CFD, referência, modelos, split, treinamento e restrição física.
3. **Resultados** — tabelas e gráficos efetivamente sustentados por fontes.
4. **Interpretação** — o que os resultados permitem afirmar.
5. **Limitações** — escopo, dados, operadores, custos e generalização.
6. **Próximo passo** — decisão experimental vinculada à timeline/roadmap.

Textos editoriais devem ser curtos, legíveis e vinculados a `investigationId`, `comparisonId`, `evaluationId` e/ou referências de fonte.

### 9.2 Exemplo sustentado pelo artigo (fase k–ε, Re ≈ 36.000)

O artigo compara MLP supervisionada e PINN regularizada por continuidade, com **três seeds** e **RANS fine como referência numérica**. No conjunto de teste, a MLP apresenta menor MAE de velocidade e pressão cinemática, enquanto a PINN reduz fortemente o diagnóstico de divergência em relação à MLP. A interpretação é um **compromisso entre fidelidade de campo e regularização de continuidade**, não superioridade geral da PINN nem garantia de conservação exata.

**Uso permitido:** orientar linguagem, títulos, agrupamento de métricas, limites de inferência e, **se os runs exatos do artigo forem rastreados aos JSONs**, construir um painel de resultado publicado com fonte explícita.  
**Uso proibido:** copiar valores agregados do artigo para execuções individuais, atribuir resultados k–ε à fase SST ou anunciar DNS/LES como referência onde a fonte usa RANS fine.

### 9.3 Terminologia

Preferir: “correção de campos RANS coarse → fine”, “referência numérica RANS refinada”, “erro de reconstrução”, “diagnóstico de divergência”, “regularização de continuidade”, “comparação por seeds” e “limitações do protocolo”. Evitar: “solução fisicamente correta” como conclusão de divergência isolada; “verdade de alta fidelidade” para RANS fine; “PINN resolve RANS” quando apenas continuidade é imposta.

### 9.4 Referências

Incluir no catálogo de recursos a referência ao manuscrito, com status de publicação **conforme metadados efetivamente confirmados**. Não inferir publicação final apenas da existência do PDF submetido/diagramado.

---

## 10. Timeline, roadmap e galeria

### 10.1 Timeline

Preservar `RESEARCH_TIMELINE.md` como referência editorial: fases k–ε e SST, marcos, decisões, evidência, investigação e links. **A data do evento científico não substitui a data/hora de cada run associado.** Mostrar resumo por evento e expandir lista de execuções com timestamps individuais.

### 10.2 Roadmap

Manter milestones e prioridades, com hierarquia mais leve (linhas, etapas, barra de progresso **somente de tarefas concluídas**, não percentual de maturidade científica). Prioridades devem ligar às hipóteses/investigações pertinentes.

### 10.3 Galeria

Agrupar por investigação e execução, permitir filtro por variável, categoria, escopo e modelo. Mostrar legenda científica, escala, unidade, referência, método, timestamp do run e fonte. Usar miniaturas e visualizador ampliado. Não reproduzir centenas de imagens indistinguíveis na página principal.

---

## 11. Estrutura técnica sugerida

Adaptar à estrutura atual, sem renomeações em massa:

```text
src/
  components/
    dashboard/        # KPIs, gráficos, destaque
    experiments/      # catálogo, detalhes, filtros
    metrics/          # matriz, lista, metadados
    scientific/       # achados, comparabilidade, evidência
    timeline/         # marcos e navegação
    shared/           # design system enxuto
  data/
    adapters/         # leitura e normalização dos JSONs existentes
    selectors/        # agregações e filtros derivados
    validators/       # schemas, datas, relações, publicação
  types/              # tipos de run, avaliação, métrica, investigação
  pages/              # rotas existentes e páginas revisadas
scripts/
  ...                 # estender importador/validador existentes
public/data/
  ...                 # SOMENTE projeção aprovada para publicação
```

### Agregações

Implementar seletores puros e testáveis: `countCanonicalRuns`, `countPublishedRuns`, `runsByFamily`, `runsOverTime`, `runsByReynolds`, `runsByTurbulence`, `lastConfirmedRun`, `metricsByEvaluation`, `eligibleComparisons`. Os nomes são sugestões; priorizar consistência com o código real.

### Segurança e publicação

- Validar dados JSON externos e escapar conteúdo editorial.
- Não renderizar HTML arbitrário de fontes; sanitizar URLs.
- Não incluir paths locais, dados privados, hashes sensíveis ou artefatos não aprovados no build público.
- Não confiar apenas em filtros do frontend para ocultar registros privados.
- Preservar comportamento do Vite `base` e GitHub Pages no subdiretório do repositório.

---

## 12. Plano incremental de implementação

### Etapa A — Auditoria e contrato

1. Mapear schemas reais, importador, componentes, rotas e dados públicos.
2. Criar tabela de rastreabilidade dos timestamps (`run_name`, logs, manifests, metadados).
3. Registrar riscos de duplicidade, cobertura parcial e divergências de unidades.
4. Definir migração sem perder IDs ou referências existentes.

**Aceite A:** documento curto com fontes por campo e amostra de runs confirmados/inferidos/sem data.

### Etapa B — Modelo canônico e curadoria

1. Separar TrainingRun, EvaluationRecord, MetricView e Investigation.
2. Introduzir timestamps e níveis de confiança.
3. Deduplicar runs com justificativa e vincular reavaliações.
4. Produzir projeção pública e relatório de cobertura.

**Aceite B:** importação idempotente; nenhum run contado duas vezes por possuir múltiplos JSONs.

### Etapa C — Design system e navegação

1. Refatorar layout reduzindo caixas, bordas e repetição de badges.
2. Implementar hierarquia visual, tabela de execuções e painel de detalhes.
3. Preservar rotas, PT/EN e deep links.

**Aceite C:** interface legível em desktop e mobile, com timestamp visível na listagem e no detalhe.

### Etapa D — Dashboard analítico

1. KPIs baseados em catálogo canônico e escopo declarado.
2. Gráficos G1–G4 com filtros e drill-down.
3. G5 apenas para dados cientificamente comparáveis.
4. Testar contagens contra catálogo e manifesto de cobertura.

**Aceite D:** nenhuma contagem derivada de quantidade de JSONs/PNGs ou de dados ocultos.

### Etapa E — Métricas e comparações

1. Mapear métricas de logs e resultados de avaliação.
2. Implementar matriz e lista detalhada, com timestamps e filtros.
3. Unificar avisos de comparabilidade e manter medições individuais.
4. Adicionar gráficos científicos elegíveis e painel de auditoria.

**Aceite E:** métricas exibidas com unidade/escopo corretos, sem conversões silenciosas.

### Etapa F — Narrativa, qualidade e deploy

1. Revisar textos científicos conforme artigo e evidências da fase correspondente.
2. Integrar timeline, galeria, investigação e roadmap.
3. Rodar validações, testes, build e inspeção responsiva.
4. Atualizar README, documentação de importação e changelog de migração.

**Aceite F:** deploy GitHub Pages funcional; sem vazamento de registros locais ou pendentes.

---

## 13. Testes obrigatórios e critérios de aceite

### Identidade e integridade

- [ ] Dois runs no mesmo dia, com timestamps diferentes, aparecem como execuções distintas.
- [ ] Reimportar a mesma fonte não altera a contagem de runs canônicos.
- [ ] Múltiplos JSONs de métricas de um run não multiplicam execuções.
- [ ] Reavaliações preservam vínculo com run original e data própria quando disponível.
- [ ] Timestamp ausente ou inferido é sinalizado; `importedAt` não substitui `executedAt`.
- [ ] A timezone não é inventada a partir do nome do arquivo.
- [ ] IDs/hashes ficam disponíveis em auditoria, não em títulos principais.

### Dashboard

- [ ] KPIs têm definições e escopo visível.
- [ ] G1–G4 são gerados de runs canônicos e filtros funcionam.
- [ ] Gráficos permitem navegar até execuções correspondentes.
- [ ] Runs sem timestamp não são distribuídos artificialmente na série temporal.
- [ ] Dados privados não entram nas contagens nem no bundle público.
- [ ] G5 só aparece quando há conjunto comparável.

### Métricas e ciência

- [ ] Métricas pertinentes dos JSONs originais estão acessíveis com chave, unidade e escopo.
- [ ] Matriz inclui timestamp/modelo/seed e evita colisões de nomes de métricas.
- [ ] `null` e campo ausente não aparecem como zero.
- [ ] Loss de treinamento não é confundida com erro de teste.
- [ ] Comparação bloqueada não exibe delta/ranking; justificativa não se repete em vários painéis.
- [ ] Diferenças experimentais intencionais não são tratadas automaticamente como invalidade.
- [ ] RANS fine permanece identificada como referência numérica, não DNS/LES/experimento.
- [ ] Sínteses baseadas no artigo não são atribuídas a runs SST ou seeds individuais sem vínculo de fonte.

### Qualidade de produto

- [ ] Redução perceptível de cards e bordas, mantendo hierarquia e legibilidade.
- [ ] Navegação por teclado, labels, estados vazios e contraste adequados.
- [ ] PT/EN sem regressão.
- [ ] Mobile 375 px, tablet 768 px e desktop testados.
- [ ] Rotas/reload no GitHub Pages funcionando.
- [ ] Typecheck, testes e build executados; falhas e pendências documentadas.

---

## 14. Fora do escopo

- Banco de dados, backend, autenticação e edição de registros via navegador.
- Reprocessar CFD, treinar PINNs ou recalcular métricas físicas de campos brutos.
- Importar automaticamente todo o histórico para publicação sem curadoria.
- Criar métricas científicas novas a partir de nomes de arquivo ou imagens.
- Ranking global entre diferentes casos, turbulências, Reynolds ou operadores incompatíveis.
- Transformar o artigo em fonte de valores individuais de runs sem vínculo rastreável.
- Reformulação completa do projeto, da timeline ou do pipeline científico original.

---

## 15. Entregáveis esperados do Codex

1. Auditoria inicial com mapa de fontes, riscos e plano de migração.
2. Normalização temporal e deduplicação com testes.
3. Projeções local/pública e manifesto de cobertura.
4. Design system enxuto e navegação revisada.
5. Dashboard com KPIs e gráficos G1–G4; G5 condicionado à elegibilidade.
6. Catálogo tabular de execuções com timestamp, filtros e detalhes.
7. Explorador de métricas alimentado pelos JSONs reais.
8. Comparador simplificado, com avaliação explícita de elegibilidade.
9. Investigação e timeline com narrativa científica e evidência.
10. Testes, documentação, build e relatório de mudanças/pontos pendentes.

---

## 16. Decisões de produto consolidadas

| Decisão | Justificativa |
|---|---|
| React + TypeScript + Vite | Preservar implementação atual e facilitar componentes analíticos. |
| Sem banco de dados na v0.5 | JSONs derivados e agregados estáticos atendem ao escopo atual. |
| Timeline como narrativa | Explica a evolução e as decisões científicas. |
| Dashboard como análise | Resume volume, distribuição e atividade experimental. |
| Run com timestamp como entidade central | Diferencia execuções repetidas no mesmo dia. |
| Avaliação separada de run | Impede duplicidade e preserva mudanças de protocolo. |
| Catálogo completo separado da publicação | Permite rastreabilidade sem sobrecarregar ou expor o portal público. |
| Tabelas + detalhes sob demanda | Melhoram legibilidade sem perder profundidade técnica. |
| Artigo como referência de narrativa | Mantém rigor sobre acurácia, continuidade e limitações. |

**Definição de pronto:** a v0.5 permite identificar *qual investigação*, *qual execução e quando*, *quais métricas e como foram calculadas*, *o que pode ser comparado* e *qual conclusão é sustentada*, sem sacrificar clareza visual nem integridade científica.
