# SPEC — PINN Research Hub v0.2

**Versão:** 2.0 · **Data:** 19/11/2026 · **Status:** pronto para implementação orientada por especificação  
**Produto:** PINN Research Hub — Scientific Research & Experimentation Portal  
**Entrada:** repositório existente `borges12matheus/pinn-research-hub`, PRD v0.1 e SPEC v0.1  
**Fonte técnica principal:** `borges12matheus/bfs-physics-informed-learning`  
**Hospedagem:** GitHub Pages em `/pinn-research-hub/`

## 0. Instruções obrigatórias ao Codex

1. **Inspecione primeiro o repositório atual**: estrutura, arquivos, dados JSON, navegação, alternância PT/EN, workflows e configuração do GitHub Pages. Não sobrescreva conteúdo válido sem migrá-lo.
2. Leia o PRD e SPEC anteriores como contexto histórico. **Esta SPEC prevalece para a v0.2** quando houver conflito (especialmente na escolha de framework).
3. Implemente **React + Vite + TypeScript**, com build estático e deploy no GitHub Pages. Não introduza Next.js, backend, banco, autenticação ou dependência de serviços pagos.
4. Preserve as funcionalidades existentes, incluindo alternância PT/EN, âncoras/links e conteúdo editorial validado.
5. Não invente métricas, datas de experimentos, publicações, conclusões ou percentuais. Separe **fato confirmado**, **observação preliminar**, **hipótese** e **planejamento**.
6. Nunca publique datasets privados, manuscritos não autorizados, segredos ou dados não liberados. O conteúdo em `public/` é público.
7. Execute cada fase incrementalmente, rode os testes e reporte arquivos alterados, decisões e limitações. Se o repositório tiver escolhas técnicas compatíveis, adapte em vez de recriar tudo.

## 1. Diagnóstico da v0.1 (evidência: capturas de tela fornecidas)

| Observação | Impacto | Ação v0.2 |
|---|---|---|
| Hero muito alto, dominado por título e descrição | Resultados importantes ficam abaixo da dobra | Hero compacto, resumo científico e CTA para resultados |
| Três KPIs administrativos: marcos, atividades, publicações | Não mostram contribuição científica | KPIs de evidências reais, com estado `não disponível` quando necessário |
| Roadmap linear com três etapas amplas | Não comunica a evolução metodológica | Timeline interativa por marcos e eventos |
| Atualizações com um único registro editorial | Histórico pouco informativo | Diário científico cronológico e filtros |
| Ausência de gráficos, imagens de campos e métricas | Portal genérico | Galeria de resultados e comparação de experimentos |
| Paleta clara com cards repetitivos | Baixa identidade visual científica | Design system escuro, sóbrio e responsivo |
| Recursos e publicações pouco estruturados | Dificulta consulta e interpretação de status | Links categorizados e estados de publicação explícitos |

**Limite do diagnóstico:** baseado nas imagens enviadas, não em auditoria de código, acessibilidade ou performance do site em produção. O Codex deve validar o código real antes de implementar.

## 2. Objetivo da entrega

Criar um portal científico visual e intuitivo que explique **o problema**, **a trajetória metodológica** e **as evidências experimentais** da pesquisa BFS/PINN. O portal deve continuar sendo editável por arquivos versionados, sem exigir infraestrutura de servidor.

### Critérios de sucesso

- Um visitante entende o tema e o estágio da pesquisa na primeira tela.
- Timeline permite explorar eventos e suas evidências.
- Resultados reais aparecem com origem, configuração, unidades e limitações.
- Ausência de métricas não gera valores fictícios nem gráficos enganosos.
- Layout funciona em desktop e mobile; idioma PT/EN permanece funcional.
- Build e deploy no GitHub Pages funcionam após `npm run build`.

## 3. Escopo funcional v0.2

### 3.1 Navegação

Seções: **Visão geral**, **Evolução**, **Resultados**, **Roadmap**, **Publicações e recursos**. Cabeçalho compacto e fixo opcional, navegação acessível por teclado, indicador da seção ativa. Em mobile, menu recolhível. Preservar PT/EN: todos os textos de UI e dados editoriais precisam de tradução ou fallback explícito.

### 3.2 Visão geral

- Hero reduzido: título, resumo de 2–3 linhas, etapa atual, última atualização **dos dados**, botões `Explorar resultados` e `Ver evolução`.
- Uma área de contexto: problema BFS, CFD coarse/fine, PINN como correção/regularização física.
- Indicadores úteis: modelos investigados, conjuntos/condições de Reynolds **confirmados**, experimentos documentados e publicações por status. Não contar registros demonstrativos.
- Destaque editorial **Resultado/limitação em foco**, com referência à evidência correspondente.

### 3.3 Evolução da pesquisa (prioridade máxima)

Timeline visual e interativa, ordenada por data, com filtros `Todos`, `Metodologia`, `Experimento`, `Validação`, `Publicação`, `Decisão`.

Cada evento mostra título, período/data, categoria, resumo, status de evidência, repositório/commit/artigo vinculado e, se existir, miniatura. Ao expandir, mostrar `problema → hipótese → abordagem → observação → conclusão/limitação → próximo passo`. Eventos sem data exata devem usar período textual, sem inventar dia.

**Marcos candidatos para curadoria (não assumir como fatos automaticamente):** pipeline inicial BFS/MLP/PINN; correção coarse-to-fine; introdução da continuidade; inclusão de termos de momento; avaliação multi-Re; mudanças de normalização; gradientes como features; refinamento da avaliação de divergência; investigação de dependência de dados fine. Validar datas, resultados e links com os registros reais antes de publicar.

### 3.4 Resultados e experimentos

- Cards de experimentos com `modelo`, `dataset`, `Re`, `objetivo`, `configuração`, `estado` e link para evidência.
- Filtros por modelo, Reynolds, categoria e dataset.
- Comparação de métricas **apenas entre experimentos compatíveis**: mesmo conjunto de teste, unidade, normalização, definição e método numérico da métrica. Indicar claramente incompatibilidades.
- Gráficos com Plotly (ou alternativa leve aprovada): barras/linhas de RMSE, MAE, erro relativo, divergência e, quando houver, métricas físicas de parede ou balanço de massa.
- Galeria de figuras reais (campos, perfis, divergência, convergência), com legenda, origem, versão e texto alternativo. Não fabricar gráficos de CFD a partir de dados ausentes.
- Para resultados indisponíveis, mostrar estado vazio útil: `Resultados quantitativos ainda não publicados`, com link ao repositório, sem números placeholder.
- Distinguir **referência fine RANS** de **DNS/experimento**: fine RANS não é verdade física absoluta. Quando houver apenas perfis DNS, não afirmar validação DNS em campo completo.

### 3.5 Roadmap e prioridades

Roadmap por fases e objetivos com estados `concluído`, `em andamento`, `planejado`, `bloqueado`; data real ou previsão identificada. Cada objetivo pode vincular eventos, experimentos e publicações. Não calcular percentual global subjetivo. Prioridades com descrição, motivo e critério de conclusão.

### 3.6 Publicações e recursos

Distinguir `rascunho`, `em revisão interna`, `submetido`, `aceito`, `publicado`. Uma submissão **não** deve contar como publicação publicada. Exibir apenas metadados publicáveis. Links para repositórios atuais e históricos, documentação e artigos com DOI quando confirmado.

## 4. Design system

### 4.1 Direção visual

**Estilo:** dashboard de computação científica, profissional, denso em evidências e leve na navegação. Preferir tema escuro como padrão; tema claro é opcional se implementado com qualidade. Evitar excesso de glow, gradientes chamativos, emojis em excesso e cartões sem função.

| Token | Valor inicial |
|---|---|
| `--bg` | `#0B1220` |
| `--surface` | `#162235` |
| `--surface-raised` | `#1C2B41` |
| `--border` | `#304158` |
| `--text` | `#E5E7EB` |
| `--muted` | `#AAB8CA` |
| `--accent` | `#22D3EE` |
| `--accent-secondary` | `#60A5FA` |
| `--success` | `#34D399` |
| `--warning` | `#FBBF24` |

Verificar contraste WCAG AA para texto e controles; não depender apenas de cor para indicar status. Tipografia legível, grade responsiva, conteúdo principal com largura máxima adequada a gráficos (aprox. 1200–1360px), espaçamento consistente. Gráficos devem ter legenda, unidades, tooltips e versão acessível em tabela.

### 4.2 Hierarquia de tela (desktop)

```text
┌─────────────────────────────────────────────────────────────────────┐
│ PINN Research Hub         Visão geral Evolução Resultados Roadmap EN│
├─────────────────────────────────────────────────────────────────────┤
│ Título curto + resumo        │ Estado atual / evidência em destaque │
│ [Explorar resultados]        │ Última atualização dos dados         │
├─────────────────────────────────────────────────────────────────────┤
│ Indicadores reais e contextualizados                               │
├─────────────────────────────────────┬───────────────────────────────┤
│ Resultado científico em destaque    │ Figura real / visualização    │
├─────────────────────────────────────┴───────────────────────────────┤
│ Evolução da pesquisa: timeline navegável                           │
├─────────────────────────────────────────────────────────────────────┤
│ Experimentos e métricas / filtros / comparação                     │
├─────────────────────────────────────┬───────────────────────────────┤
│ Roadmap e próximos passos           │ Publicações e recursos       │
└─────────────────────────────────────┴───────────────────────────────┘
```

Em telas estreitas, empilhar as colunas e manter navegação e filtros operáveis por toque.

## 5. Arquitetura

**Stack:** React 18+ / React atual compatível, Vite, TypeScript estrito, CSS com variáveis (Tailwind opcional se justificar), Plotly para gráficos reais. Evitar dependências desnecessárias.

**Deploy:** configurar `base: '/pinn-research-hub/'` no Vite para GitHub Pages do repositório. Usar `import.meta.env.BASE_URL` para arquivos estáticos; evitar URLs absolutas de raiz. Preferir navegação em uma página por âncoras, evitando necessidade de fallback SPA. GitHub Actions para build e deploy em `main`, com permissões mínimas.

Estrutura sugerida (adaptar à existente):

```text
src/
  app/App.tsx
  components/{Header,Hero,MetricCard,ResearchTimeline,ExperimentCard,MetricChart,FigureGallery,Roadmap,PublicationList}/
  data/{loaders,validators}.ts
  i18n/{pt,en}.ts
  styles/{tokens,global}.css
  types/research.ts
public/
  data/{project,timeline,experiments,metrics,roadmap,publications}.json
  figures/README.md
.github/workflows/deploy.yml
vite.config.ts
README.md
```

## 6. Contratos de dados e rastreabilidade

Todo registro tem `id` estável, `updatedAt` (quando conhecido), `visibility` (`public`/`private` — **private nunca deve ir para `public/`**), `evidenceStatus` (`verified`, `preliminary`, `planned`, `unknown`) e `sources` (links verificáveis). Não usar `null` como zero.

### 6.1 Timeline — exemplo de **estrutura**, não de fato científico

```json
{
  "id": "evt-example",
  "date": null,
  "period": "Data a confirmar",
  "category": "methodology",
  "title": { "pt": "Título do marco", "en": "Milestone title" },
  "summary": { "pt": "Resumo", "en": "Summary" },
  "hypothesis": null,
  "observation": null,
  "conclusion": null,
  "evidenceStatus": "unknown",
  "sources": [],
  "visibility": "public",
  "updatedAt": null
}
```

### 6.2 Experimento

```json
{
  "id": "exp-example",
  "model": "PINN-cont",
  "dataset": "ERCOFTAC BFS",
  "reynolds": [],
  "splitId": null,
  "referenceType": "fine_rans",
  "commitSha": null,
  "configurationPath": null,
  "metrics": [],
  "figures": [],
  "evidenceStatus": "unknown",
  "sources": [],
  "visibility": "public",
  "updatedAt": null
}
```

### 6.3 Métrica

Campos obrigatórios por medida publicada: `name`, `value` (número finito ou `null`), `unit`, `evaluationSet`, `definition`, `calculationMethod`, `referenceType`, `source`, `lowerIsBetter`. Para divergência, registrar se calculada via autograd, diferenças finitas ou mínimos quadrados/KDTree; **não comparar diretamente definições divergentes sem aviso**. Para gráficos de múltiplos experimentos, o sistema valida comparabilidade antes de traçar séries.

### 6.4 Figuras

`path`, `caption.pt`, `caption.en`, `alt.pt`, `alt.en`, `source`, `experimentId`, `published`. Somente copiar imagens autorizadas e de origem rastreável para `public/figures/`.

### 6.5 Validação

Criar validadores TypeScript ou schema (por exemplo, Zod, se necessário) para impedir renderização de dados inválidos. Estados: carregando, vazio, erro, parcial. Exibir aviso editorial quando faltar evidência; não quebrar a página.

## 7. Política de ingestão de dados reais

1. **Inventariar** fontes: repositório técnico, resultados exportados, figuras, relatórios e metadados de artigos.
2. **Conferir** cada informação com fonte identificável; marcar itens não confirmados para revisão editorial.
3. **Publicar primeiro** metadados e links comprovados. Não copiar pesos, datasets ou arquivos grandes sem necessidade.
4. Criar script opcional `scripts/import-results` para converter JSON/CSV existentes em contratos estáticos; não acoplar a estrutura do pipeline sem inspecioná-la.
5. Nunca misturar datasets ou splits diferentes no mesmo gráfico como se fossem diretamente comparáveis.
6. Exibir data de atualização **do conteúdo**, não apenas data de build/deploy.
7. Separar dados científicos de conteúdo editorial; a timeline pode citar resultados sem duplicar seus valores.

## 8. Implementação incremental (tarefas para Codex)

### Fase A — Auditoria e preparação

- [ ] Inspecionar v0.1, registrar arquitetura e dados existentes.
- [ ] Identificar e preservar PT/EN, URLs, conteúdo, roadmap e acessibilidade existente.
- [ ] Listar fontes científicas disponíveis e lacunas de evidência.
- [ ] Criar branch de trabalho; não alterar `main` diretamente sem instrução.

**Aceite:** resumo curto do inventário e plano de migração sem perda de dados.

### Fase B — Migração de frontend e identidade

- [ ] Configurar Vite + React + TS e `base` correto.
- [ ] Migrar conteúdo existente e internacionalização.
- [ ] Aplicar tokens visuais e novo layout responsivo.
- [ ] Implementar hero compacto, cabeçalho e navegação.

**Aceite:** navegação e PT/EN funcionam; build local passa; GitHub Pages serve assets sem 404.

### Fase C — Timeline científica

- [ ] Criar contrato e carregamento `timeline.json`.
- [ ] Implementar filtros, expansão, links de evidência e estados vazios.
- [ ] Popular apenas marcos confirmados; pendências sem datas inventadas.

**Aceite:** timeline funcional em desktop/mobile, navegação por teclado e ordenação previsível.

### Fase D — Resultados e figuras

- [ ] Criar contratos de experimentos/métricas/figuras.
- [ ] Importar apenas dados e figuras reais, após checagem de origem e autorização.
- [ ] Construir cards, filtros e pelo menos um gráfico **se houver dados comparáveis**.
- [ ] Se não houver dados quantitativos públicos, apresentar seção vazia elegante com explicação.

**Aceite:** nenhum número fictício; gráficos possuem unidades, fonte e definição de métrica; comparações incompatíveis são bloqueadas ou claramente separadas.

### Fase E — Roadmap, publicações e entrega

- [ ] Relacionar roadmap a eventos/experimentos.
- [ ] Distinguir status de submissão/publicação.
- [ ] Adicionar testes de contratos, navegação e estados vazios.
- [ ] Revisar performance, contraste, mobile, links e deploy.
- [ ] Atualizar README com como editar conteúdo e publicar.

**Aceite:** deploy concluído e checklist de QA aprovado.

## 9. Testes e critérios de aceitação finais

- `npm run build` sem erros de TypeScript; lint/testes configurados e aprovados.
- GitHub Pages abre em `/pinn-research-hub/`, inclusive assets, dados JSON e imagens.
- PT/EN cobre todos os componentes e conteúdos visíveis, com fallback seguro.
- Layout funcional em 360px, 768px e 1440px, sem overflow horizontal.
- Links externos seguros (`rel="noopener noreferrer"` quando `target="_blank"`).
- Navegação por teclado, foco visível, semântica de headings e contraste AA.
- Estados de ausência de dados não exibem `0`, `NaN`, gráfico vazio enganoso ou erro de console.
- Timeline exibe ao menos marcos **verificados**, com fontes ou sinalização de evidência pendente.
- Figuras têm legenda, texto alternativo e fonte.
- Métricas mostram unidade, referência e metodologia; gráficos não comparam experimentos incompatíveis sem ressalva.
- Publicações exibem status correto (submetido ≠ publicado).
- Nenhum segredo, dataset privado ou manuscrito não autorizado é enviado ao Pages.
- Preservadas funcionalidades existentes da v0.1.

## 10. Fora do escopo da v0.2

Backend, login, banco de dados, edição via interface, sincronização em tempo real, treino/inferência de modelos no navegador, integração automática completa com GitHub API, scraping de artigos, IA generativa no portal, gráficos 3D volumétricos, Next.js e infraestrutura paga. Esses itens podem ser avaliados na v0.3+.

## 11. Entrega esperada do Codex

1. Código da v0.2 em branch/PR revisável.
2. Arquivos JSON curados, sem dados fabricados.
3. README atualizado com instruções de desenvolvimento, build, deploy e atualização editorial.
4. Relatório breve de migração, testes e limitações.
5. Lista de pendências científicas para curadoria: métricas, figuras, datas e referências ainda não confirmadas.

## 12. Prompt inicial sugerido para Codex

> Leia o PRD e a SPEC v0.1 e, principalmente, `SPEC_PINN_Research_Hub_v0.2.md`. Audite o repositório existente antes de alterar código. Implemente a v0.2 em fases, usando React + Vite + TypeScript e mantendo o GitHub Pages. Preserve a alternância PT/EN e os conteúdos válidos. Priorize redesign científico, timeline visual e apresentação rastreável de resultados reais. Não invente dados; sinalize lacunas e peça confirmação quando necessário. Valide os critérios de aceitação, documente o que mudou e entregue em branch revisável.
