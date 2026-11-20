# PINN Research Hub · v0.3

Portal estático de acompanhamento da pesquisa de mestrado em aprendizado informado por física aplicado à correção de campos CFD. O painel registra a primeira fase, `bfs_2d_pinn_corrector`, e a etapa atual, `bfs-physics-informed-learning`.

## Executar localmente

Monte e sirva a distribuição estática na raiz do projeto:

```sh
node scripts/build_site.mjs
python3 -m http.server 8000 --directory dist
```

Abra [localhost:8000](http://localhost:8000/). Node.js 22+ é usado na montagem. O navegador usa HTML, CSS e JavaScript nativos e recebe somente os arquivos da distribuição.

## Validar a coleção científica privada

Abra a revisão local com a coleção prioritária de staging:

```sh
node scripts/preview_site.mjs
```

Acesse [127.0.0.1:8000](http://127.0.0.1:8000/). A página indica **Revisão local**. O servidor escuta apenas em loopback e serve em memória o frontend e os arquivos gerenciados de `.experiment-import/featured/`, após conferir seus hashes. O comando preserva a visibilidade privada dos registros e usa os mesmos critérios de comparabilidade do portal. `dist/` e `public/` permanecem separados da revisão.

Para validar a navegação da v0.4, abra [Evolução](http://127.0.0.1:8000/#/evolucao), escolha um marco e selecione **Explorar resultados**. A investigação reúne as comparações, métricas e figuras vinculadas. Para testar um link direto, abra a [investigação das réplicas k–ε](http://127.0.0.1:8000/#/resultados/replicas-ke).

Para rever dados atualizados, gere novamente o staging com `python scripts/import_experiments.py export --config config/featured_experiments.yaml` e reinicie a prévia. Se necessário, passe `--port 8011` para escolher outra porta. Para testar o fluxo completo no Chromium com o acervo real, use `node tests/browser_science.mjs --local-review`.

## Atualizar o conteúdo

Edite os arquivos editoriais em `data/`, remonte `dist/` e recarregue a página. Use IDs únicos dentro de cada coleção e mantenha-os estáveis. Preencha datas no formato `YYYY-MM-DD`. Use `[]` para coleções vazias e `null` para datas previstas e referências opcionais desconhecidas.

| Arquivo | Campos e apresentação |
| --- | --- |
| `project.json` | `id` identifica o projeto, `name` nomeia o portal, `researchTitle` e `summary` apresentam a pesquisa e `currentPhase` alimenta o badge de fase. `lastUpdated` é a data da revisão editorial. `isDemoData` controla o aviso de dados demonstrativos. `repositoryUrl` registra a referência ao repositório técnico. Para publicar ou atualizar um link exibido, edite `resources.json`. |
| `roadmap.json` | `id`, `order` numérico, `title`, `description`, `status` e `targetDate` opcional. Estados aceitos: `planned`, `in_progress`, `completed` e `blocked`. Ordenação crescente por `order`. |
| `updates.json` | `id`, `date`, `title`, `summary` e `category` em texto livre. As cinco atualizações mais recentes aparecem primeiro, com expansão para as demais. |
| `priorities.json` | `id`, `order` numérico, `title`, `status` e `roadmapId` opcional para apontar a um marco. Estados aceitos: `open`, `in_progress` e `done`. As cinco primeiras ações ativas aparecem em ordem crescente. |
| `resources.json` | `id`, `title`, `description`, `url` e `type` em texto livre, por exemplo, `repository`. Cadastre links públicos. |
| `publications.json` | `id`, `title`, `status` e `url` opcional. Estados editoriais: `draft`, `internal_review`, `submitted`, `accepted` e `published`. O indicador conta registros, enquanto cada item exibe seu estado. |

Empates por data nas atualizações ou por ordem nos marcos e prioridades são resolvidos por ID em ordem crescente. As contagens usam todos os registros válidos, inclusive as prioridades ativas que excedem o limite visual. Marcos concluídos são contados por status, sem percentual de progresso científico. Um arquivo inválido ou ausente gera um aviso e, quando é uma coleção, conta como vazio.

O português é o idioma padrão. Para traduzir um texto, inclua um objeto opcional `en` no próprio registro, com apenas os campos que deseja traduzir, como `{ "en": { "title": "Milestone name" } }`. Campos de conteúdo sem tradução usam o texto original. O botão EN/PT altera o idioma da sessão de página, sem armazenar preferências.

## Publicar no GitHub Pages

O workflow [Publicar no GitHub Pages](./.github/workflows/pages.yml) executa o typecheck, os testes e o build com as coleções aprovadas em `public/`. O artefato enviado ao Pages é `dist/`. O build verifica os hashes de `config/public_release_manifest.json`. Os dados e relatórios da revisão local permanecem em `.experiment-import/`.

1. Integre a versão revisada à branch padrão do repositório (`main`).
2. Em **Settings → Pages**, no próprio repositório, selecione **GitHub Actions** como source.
3. Em **Actions → Publicar no GitHub Pages → Run workflow**, selecione `main`.
4. Abra o endereço informado na etapa de deploy ou em **Settings → Pages**.

Para conferir o pacote antes de enviar, execute `npm run build -- --approved` e abra `dist/` por um servidor HTTP local. Se optar por publicar via branch, use uma branch dedicada com o conteúdo de `dist/` na raiz, incluindo `.nojekyll`, e configure essa branch como source.

O site usa URLs relativas e navegação por fragmento para funcionar no subdiretório do repositório. [Documentação oficial do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

O recorte público atual inclui seis investigações. A investigação isolada de Re 32.000 permanece na revisão local. Para regenerar os arquivos públicos após atualizar as aprovações em `config/public_experiments.yaml`, rode os comandos a seguir a partir da raiz.

```sh
python scripts/import_experiments.py export --config config/public_experiments.yaml --public
cp .experiment-import/public-audit/managed.json config/public_release_manifest.json
npm run build -- --approved
```

Versione `public/` e o manifesto juntos. A branch utilizada no GitHub Actions precisa conter ambos. Na primeira exportação feita em outro checkout, o importador exige o índice de propriedade local para atualizar arquivos públicos já existentes. O manifesto versionado pode ser usado como índice em `.experiment-import/public-audit/managed.json` para essa atualização.

## Escopo dos dados iniciais

A descrição editorial das fases foi preparada a partir da documentação local dos dois projetos de pesquisa. Os marcos e prioridades são exemplos para revisão. A data inicial registra a criação do conteúdo do portal. A pasta `lab_experimentos` continua sendo a fonte local dos experimentos e não é lida pelo site. A distribuição padrão inclui o recorte editorial. Resultados experimentais são adicionados após curadoria e exportação pública.

## Importação experimental

O importador offline gera dados curados em staging local. Consulte os comandos, os critérios de comparabilidade e a política de aprovação em [Importação experimental](./docs/EXPERIMENT_IMPORT.md).

## Portal científico v0.3

A montagem padrão inclui os dados editoriais e coleções experimentais vazias. Após uma curadoria e uma exportação pública explícitas pelo [importador](./docs/EXPERIMENT_IMPORT.md), execute `node scripts/build_site.mjs --approved` para montar a versão com evidências aprovadas. O comando exige que os arquivos em `public/` correspondam aos hashes gerenciados em `.experiment-import/public-audit/managed.json`. O staging privado, relatórios, configurações e artefatos pesados ficam fora do pacote. A coleção `featured` permanece restrita ao staging conforme sua política.

Os textos editoriais de fases, hipóteses e grupos estão em `data/scientific-context.json`. A montagem gera `data/overview.json` com índices e referências aprovadas. Valores de métricas seguem no catálogo, carregado sob demanda. `data/literature.json` é opcional e aceita registros públicos validados.

```sh
node --test --test-isolation=none tests/science.test.mjs
python3 -B -m unittest discover -s tests -v
node tests/browser_science.mjs
```

O teste de navegador exige Chromium Headless ou Google Chrome e acesso ao loopback. Se necessário, defina `CHROME_BIN` com o executável disponível. Ele serve em memória o pacote editorial e um pacote sintético isolado, com verificação na raiz e no subdiretório de projeto. [Plano de migração](./docs/MIGRACAO_V0.3.md)

A auditoria e o registro de implementação da v0.4 estão em [UX_AUDIT_v0.4.md](./docs/UX_AUDIT_v0.4.md).

## Validar o catálogo analítico v0.5

A prévia sem argumentos usa a coleção prioritária com figuras curadas. O perfil `--catalog` inclui o histórico importado dos dois projetos, as figuras curadas e os registros de reavaliação separados. Ambos escutam somente em loopback.

```sh
python scripts/import_experiments.py export --config config/featured_experiments.yaml
python scripts/import_experiments.py export --config config/catalog_experiments.yaml
node scripts/preview_site.mjs --catalog
```

Consulte [Visão geral](http://127.0.0.1:8000/#overview), [Execuções](http://127.0.0.1:8000/#/execucoes) ou [Reavaliações](http://127.0.0.1:8000/#/reavaliacoes). O dashboard exclui horários inferidos da série temporal. O catálogo conserva a origem de cada horário. Os relatórios de cobertura ficam sob `.experiment-import/<perfil>/reports/`.

```sh
npm ci
npm run typecheck
npm test
npm run build
node tests/browser_science.mjs --local-review
```

O typecheck verifica os seletores e tipos da camada analítica em módulos ES. O build usa o empacotador estático existente e o TypeScript é uma dependência de desenvolvimento. [Auditoria e migração v0.5](./docs/MIGRACAO_V0.5.md)

As 23 referências fornecidas em `references.bib` são mantidas como metadados bibliográficos em `data/literature.json`. A seção Literatura oferece busca por título, autor, ano ou DOI. O boletim bibliográfico semanal tem uma rota própria e está em construção.
