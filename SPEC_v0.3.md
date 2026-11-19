# PINN Research Hub — SPEC v0.3

**Versão:** 0.3 — Proposta  
**Data:** 19/11/2026  
**Status:** Aguardando reconciliação com a SPEC v0.2  
**Arquitetura:** Static-first, data-driven

## 1. Visão geral

O PINN Research Hub é uma plataforma de acompanhamento, documentação e apresentação dos resultados de uma pesquisa de mestrado em Physics-Informed Neural Networks aplicadas à correção de campos CFD.

A versão 0.3 evolui o dashboard inicial para um portal científico com:

- Histórico da pesquisa.
- Catálogo experimental.
- Métricas de desempenho.
- Comparações científicas.
- Galeria de resultados.
- Timeline vinculada às evidências.
- Acompanhamento do progresso científico.

A implementação deverá preservar a arquitetura estática e a compatibilidade com GitHub Pages.

## 2. Princípios arquiteturais

### 2.1 Static-first

O portal deve funcionar sem backend obrigatório.

Os dados serão produzidos por um pipeline Python executado localmente e disponibilizados como JSONs e imagens estáticas.

### 2.2 Separação de responsabilidades

**Laboratório científico:** executa treinamentos, avaliações e gera resultados.

**Pipeline de importação:** seleciona, valida, normaliza e exporta os resultados.

**Research Hub:** apresenta e organiza as informações.

O portal não deverá executar modelos científicos.

### 2.3 Rastreabilidade

Toda métrica deverá estar vinculada a uma execução identificável.

Toda comparação deverá informar quais experimentos participaram.

Todo evento experimental da timeline deverá apontar para as evidências disponíveis.

### 2.4 Integridade científica

O sistema não deverá ocultar diferenças metodológicas relevantes nem gerar rankings entre experimentos incompatíveis.

### 2.5 Publicação controlada

Dados privados e resultados não aprovados deverão permanecer fora dos arquivos públicos.

A aplicação estática não deverá depender de controles de acesso implementados apenas no frontend.

## 3. Modelo conceitual

```text
Research Project
      |
      +-- Research Phase
      |       |
      |       +-- Timeline Event
      |       |       |
      |       |       +-- Decisions
      |       |       +-- Hypotheses
      |       |       +-- Experiments
      |       |
      |       +-- Experiment Group
      |               |
      |               +-- Comparisons
      |                       |
      |                       +-- Runs
      |                               |
      |                               +-- Metrics
      |                               +-- Figures
      |                               +-- Metadata
      |
      +-- Roadmap
      +-- Literature
      +-- Publications
      +-- Research Reports
```

Os identificadores devem ser estáveis e únicos.

Não duplicar valores quantitativos em diferentes entidades.

## 4. Módulos funcionais

### 4.1 Dashboard geral

**Prioridade: P0**

O dashboard deverá responder rapidamente:

- Em qual fase está a pesquisa?
- Qual é o estado experimental atual?
- Quais hipóteses estão sendo investigadas?
- Quais resultados estão disponíveis?
- Quais são os próximos passos?

#### Componentes

**Cabeçalho**

- Identidade do projeto.
- Descrição curta.
- Navegação.
- Data da última atualização.

**Resumo executivo**

Cards com:

- Fase atual.
- Hipóteses em investigação.
- Grupos experimentais catalogados.
- Última atualização experimental.

**Pesquisa em andamento**

Exibir o experimento de referência da fase atual, com:

- Caso CFD.
- Reynolds.
- Modelo de turbulência.
- Modelos comparados.
- Métricas principais.
- Estado da evidência.

**Resultados em destaque**

Apresentar até três grupos experimentais relevantes.

**Timeline resumida**

Exibir os últimos marcos científicos, com acesso à timeline completa.

**Próximos passos**

Integrar os itens prioritários do roadmap existente.

#### Requisitos de design

- Hierarquia visual clara.
- Cards compactos.
- Boa distribuição de espaço.
- Estados vazios informativos.
- Identificação visual de fase e status.
- Responsividade.
- Evitar excesso de gráficos na página inicial.

O dashboard deverá apresentar uma síntese, não substituir o catálogo.

### 4.2 Timeline científica

**Prioridade: P0**

A timeline deverá apresentar a evolução metodológica e experimental.

Cada evento poderá conter:

- Data ou período.
- Fase.
- Categoria.
- Título.
- Hipótese.
- Observação.
- Interpretação.
- Próximo passo.
- Status da evidência.
- Decisões relacionadas.
- Experimentos vinculados.
- Fontes.

#### Funcionalidades

- Ordenação cronológica.
- Filtro por fase.
- Filtro por categoria.
- Filtro por status.
- Expansão de detalhes.
- Navegação para experimentos relacionados.

Eventos sem data confirmada deverão aparecer em uma seção própria.

Eventos planejados não poderão ser apresentados como resultados concluídos.

### 4.3 Catálogo experimental

**Prioridade: P0**

O catálogo deverá permitir explorar os experimentos registrados.

#### Visualização principal

Tabela ou cards contendo:

- Identificador.
- Data.
- Fase.
- Modelo.
- Caso.
- Reynolds.
- Referência.
- Seed.
- Split.
- Status.
- Métricas disponíveis.

#### Filtros

- Fase.
- Família do modelo.
- Reynolds.
- Tipo de experimento.
- Status de evidência.
- Status de curadoria.

#### Página de detalhes

Cada experimento deverá apresentar:

1. Objetivo experimental.
2. Configuração do modelo.
3. Dataset e referência.
4. Parâmetros de treinamento.
5. Métricas de acurácia.
6. Métricas físicas.
7. Figuras disponíveis.
8. Comparações relacionadas.
9. Limitações.
10. Proveniência.

Dados desconhecidos devem aparecer como não informados, nunca como zero.

### 4.4 Comparador experimental

**Prioridade: P0**

Permitir comparar modelos dentro de protocolos compatíveis.

#### Funcionalidades

- Seleção de comparação catalogada.
- Tabela de métricas.
- Gráficos de barras ou pontos.
- Identificação da melhor métrica, quando a direção estiver definida.
- Exibição das configurações relevantes.
- Avisos de comparabilidade.

#### Regras

Bloquear comparações incompatíveis.

Permitir comparações descritivas com aviso explícito.

Não apresentar causalidade quando variáveis experimentais relevantes não estiverem controladas.

Não misturar:

- Diferentes referências.
- Diferentes escopos.
- Operadores de divergência incompatíveis.
- Splits não equivalentes.
- Grandezas com unidades desconhecidas ou incompatíveis.

#### Métricas iniciais

**Acurácia**

- RMSE de velocidade.
- RMSE de pressão.
- Redução relativa do erro, quando disponível.

**Consistência física**

- RMSE de divergência.
- Erro de divergência em relação ao fine.
- Cobertura de pontos válidos.

**Eficiência experimental**

- Fração supervisionada.
- Pontos supervisionados.
- Pontos físicos.
- Tempo de treinamento, quando comparável.

### 4.5 Galeria científica

**Prioridade: P1**

Galeria de figuras selecionadas e rastreáveis.

#### Categorias

- Campos de velocidade.
- Pressão.
- Mapas de erro.
- Divergência.
- Comparações MLP × PINN.
- Histórico de treinamento.

#### Funcionalidades

- Miniaturas.
- Ampliação de imagem.
- Legendas técnicas.
- Identificação do experimento.
- Filtros por categoria.
- Navegação para a comparação correspondente.

#### Requisitos

Utilizar imagens estáticas já produzidas.

Não recalcular figuras no navegador.

Priorizar versões otimizadas para web, preservando legibilidade e escala.

### 4.6 Roadmap e acompanhamento

**Prioridade: P1**

Preservar as funcionalidades de planejamento já existentes.

Relacionar tarefas e marcos aos experimentos e às hipóteses.

Distinguir:

- Planejado.
- Em andamento.
- Concluído.
- Bloqueado.

A conclusão de uma tarefa não implica validação científica da hipótese.

### 4.7 Literatura e publicações

**Prioridade: P1**

Preservar os módulos existentes da SPEC v0.2.

Permitir vínculos entre artigos, hipóteses e experimentos quando houver relação documentada.

Não alterar o estado editorial de publicações sem evidência.

## 5. Estrutura dos dados

Contratos propostos:

```text
data/
  project.json
  roadmap.json
  timeline.json
  experiments.json
  comparisons.json
  metrics.json
  figures.json
  literature.json
  publications.json
```

Os caminhos finais deverão respeitar a estrutura atual do build.

### 5.1 Identificadores

Adotar:

- `phaseId`
- `eventId`
- `experimentId`
- `comparisonId`
- `metricId`
- `figureId`
- `decisionId`
- `hypothesisId`

IDs devem permanecer estáveis entre importações.

### 5.2 Integridade referencial

Validar:

- Eventos apontam para experimentos existentes.
- Comparações apontam para runs existentes.
- Métricas apontam para experimentos existentes.
- Figuras apontam para runs ou comparações existentes.
- Caminhos de imagens são válidos.
- Não existem IDs duplicados.

### 5.3 Estados de evidência

Preservar os estados documentais:

- `verified`
- `preliminary`
- `planned`
- `unknown`

Esses estados indicam a situação das evidências documentadas.

Não representam automaticamente qualidade científica, aprovação editorial ou validação externa.

### 5.4 Estados de curadoria

Adicionar:

- `featured`
- `validated`
- `historical`
- `partial`
- `excluded`

A curadoria determina como o experimento será apresentado.

Ela deve permanecer separada do status da evidência.

## 6. Importação experimental

**Prioridade: P0**

O pipeline de importação será a fonte dos catálogos experimentais publicados.

### Requisitos

- Execução offline.
- Configuração declarativa.
- Seleção explícita.
- Validação de schemas.
- Relatórios de auditoria.
- Exportação determinística.
- Dry-run.
- Publicação controlada.
- Ausência de dependência dos laboratórios em tempo de execução.

### Política de dados

**Importar:**

- Metadados.
- Métricas escalares.
- Informações de proveniência.
- Comparações.
- Figuras aprovadas.

**Não importar:**

- Checkpoints.
- Datasets completos.
- Parquets de predição.
- Escaladores.
- Logs brutos.
- Arquivos privados.

## 7. Design system

**Prioridade: P0**

A versão 0.3 deverá estabelecer um sistema visual consistente.

### Diretrizes

**Identidade**

Visual científico e tecnológico, com estética limpa e profissional.

**Tipografia**

Hierarquia clara entre títulos, subtítulos, métricas, descrições e metadados.

**Cores**

Definir tokens semânticos para:

- Superfícies.
- Texto.
- Destaques.
- Estados.
- Alertas.
- Categorias experimentais.

Não depender exclusivamente de cores para comunicar status.

**Componentes reutilizáveis**

- MetricCard.
- ExperimentCard.
- TimelineEvent.
- StatusBadge.
- PhaseBadge.
- ComparisonTable.
- ScientificFigure.
- FilterBar.
- EmptyState.
- MethodologyWarning.

**Layout**

- Navegação consistente.
- Grid responsivo.
- Espaçamento padronizado.
- Largura adequada para leitura.
- Tabelas com rolagem horizontal em telas pequenas.
- Gráficos e imagens com legendas visíveis.

### Acessibilidade

- Navegação por teclado.
- Contraste adequado.
- Estados de foco.
- Textos alternativos.
- Rótulos acessíveis.
- Layout adaptável a dispositivos móveis.

### Internacionalização

Preservar suporte PT/EN, quando já implementado.

Não remover traduções existentes.

## 8. Desempenho

**Prioridade: P1**

- Carregar inicialmente apenas dados necessários ao dashboard.
- Carregar detalhes experimentais sob demanda.
- Evitar incluir milhares de imagens no bundle inicial.
- Utilizar imagens otimizadas.
- Minimizar dependências JavaScript.
- Preservar compatibilidade com GitHub Pages.

A adoção de um framework frontend não é requisito desta versão.

## 9. Segurança e publicação

**Prioridade: P0**

Como o portal poderá ser publicado no GitHub Pages:

- Não exportar informações privadas.
- Não expor caminhos internos.
- Não incluir credenciais.
- Não depender de ocultação visual para proteger dados.
- Não publicar documentos sem aprovação.
- Não incluir arquivos científicos pesados.

Os dados públicos deverão passar por uma etapa explícita de aprovação.

## 10. Estratégia de implementação

### Etapa A — Importação

- Implementar pipeline.
- Criar schemas.
- Validar rastreabilidade.
- Gerar staging.

### Etapa B — Curadoria

- Selecionar grupos prioritários.
- Validar métricas.
- Selecionar figuras.
- Vincular eventos.
- Revisar publicação.

### Etapa C — Catálogo

- Implementar visualização de experimentos.
- Implementar detalhes.
- Implementar filtros.
- Implementar comparações.

### Etapa D — Timeline integrada

- Relacionar eventos aos experimentos.
- Criar navegação cruzada.
- Exibir status e limitações.

### Etapa E — Dashboard

- Atualizar resumo executivo.
- Adicionar resultados destacados.
- Adicionar fase experimental atual.
- Integrar últimos marcos e prioridades.

### Etapa F — Refinamento

- Aplicar design system.
- Melhorar responsividade.
- Otimizar carregamento.
- Implementar testes de interface.
- Revisar acessibilidade.

## 11. Critérios de aceite

A versão 0.3 estará concluída quando:

1. O portal consumir dados experimentais normalizados.
2. A timeline estiver vinculada às evidências.
3. Os grupos prioritários estiverem catalogados.
4. O usuário puder consultar experimentos e comparações.
5. As diferenças metodológicas forem explicitadas.
6. Comparações incompatíveis forem bloqueadas ou identificadas como exclusivamente descritivas.
7. O dashboard apresentar o estado científico atual.
8. O layout funcionar em desktop e dispositivos móveis.
9. O portal continuar funcionando estaticamente.
10. Dados privados permanecerem fora da publicação.
11. Os contratos existentes da SPEC v0.2 forem preservados ou migrados com testes.

## 12. Compatibilidade com a SPEC v0.2

Antes de implementar esta especificação, o Codex deverá:

1. Ler integralmente a SPEC v0.2 existente.
2. Identificar requisitos já implementados.
3. Identificar requisitos ainda pendentes.
4. Comparar os contratos de dados existentes com os propostos.
5. Preservar módulos e funcionalidades anteriores.
6. Documentar incompatibilidades.
7. Elaborar um plano incremental de migração.

Não substituir automaticamente arquivos ou componentes existentes.

A versão 0.3 é uma evolução da v0.2, não uma reescrita integral do portal.