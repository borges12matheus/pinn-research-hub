# PINN Research Hub · v0.1

Portal estático de acompanhamento da pesquisa de mestrado em aprendizado informado por física aplicado à correção de campos CFD. O painel registra a primeira fase, `bfs_2d_pinn_corrector`, e a etapa atual, `bfs-physics-informed-learning`.

## Executar localmente

Na raiz do projeto, execute:

```sh
python3 -m http.server 8000
```

Abra [localhost:8000](http://localhost:8000/). Use HTTP para permitir que o navegador carregue os módulos JavaScript e os JSONs. O portal usa HTML, CSS e JavaScript nativos, sem build, instalação de dependências, backend ou serviços externos.

## Atualizar o conteúdo

Edite os arquivos em `data/`, salve e recarregue a página. Use IDs únicos dentro de cada coleção e mantenha-os estáveis. Preencha datas no formato `YYYY-MM-DD`. Use `[]` para coleções vazias e `null` para datas previstas e referências opcionais desconhecidas.

| Arquivo | Campos e apresentação |
| --- | --- |
| `project.json` | `id` identifica o projeto, `name` nomeia o portal, `researchTitle` e `summary` apresentam a pesquisa e `currentPhase` alimenta o badge de fase. `lastUpdated` é a data da revisão editorial. `isDemoData` controla o aviso de dados demonstrativos. `repositoryUrl` registra a referência ao repositório técnico. Para publicar ou atualizar um link exibido, edite `resources.json`. |
| `roadmap.json` | `id`, `order` numérico, `title`, `description`, `status` e `targetDate` opcional. Estados aceitos: `planned`, `in_progress`, `completed` e `blocked`. Ordenação crescente por `order`. |
| `updates.json` | `id`, `date`, `title`, `summary` e `category` em texto livre. As cinco atualizações mais recentes aparecem primeiro, com expansão para as demais. |
| `priorities.json` | `id`, `order` numérico, `title`, `status` e `roadmapId` opcional para apontar a um marco. Estados aceitos: `open`, `in_progress` e `done`. As cinco primeiras ações ativas aparecem em ordem crescente. |
| `resources.json` | `id`, `title`, `description`, `url` e `type` em texto livre, por exemplo, `repository`. Cadastre links públicos. |
| `publications.json` | `id`, `title`, `status` e `url` opcional. Estados sugeridos: `draft`, `submitted`, `accepted` e `published`. Cada registro conta no painel independentemente do estado. |

Empates por data nas atualizações ou por ordem nos marcos e prioridades são resolvidos por ID em ordem crescente. As contagens usam todos os registros válidos, inclusive as prioridades ativas que excedem o limite visual. Marcos concluídos são contados por status, sem percentual de progresso científico. Um arquivo inválido ou ausente gera um aviso e, quando é uma coleção, conta como vazio.

O português é o idioma padrão. Para traduzir um texto, inclua um objeto opcional `en` no próprio registro, com apenas os campos que deseja traduzir, como `{ "en": { "title": "Milestone name" } }`. Campos de conteúdo sem tradução usam o texto original. O botão EN/PT altera o idioma da sessão de página, sem armazenar preferências. A v0.1 usa tema claro.

## Publicar no GitHub Pages

1. Revise o conteúdo de `data/` e inclua apenas informações aprovadas para divulgação. Os JSONs publicados ficam acessíveis diretamente pelo navegador.
2. Envie os arquivos do portal para a raiz da branch `main` do repositório GitHub dedicado ao site.
3. No GitHub, abra **Settings → Pages**. Em **Source**, escolha **Deploy from a branch**, selecione **main** e **/(root)**, e clique em **Save**.
4. Depois da publicação, abra o endereço informado em **Settings → Pages**, normalmente `https://<usuario>.github.io/<repositorio>/`.

Os caminhos de CSS, JavaScript e JSON são relativos ao site. Recursos e publicações geram links somente para URLs HTTP ou HTTPS, em nova aba. Consulte a [documentação de configuração da origem no GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Escopo dos dados iniciais

A descrição editorial das fases foi preparada a partir da documentação local dos dois projetos de pesquisa. Os marcos e prioridades são exemplos para revisão. A data inicial registra a criação do conteúdo do portal. A pasta `lab_experimentos` continua sendo a fonte local dos experimentos e não é lida pelo site. A v0.1 não inclui conjuntos de dados, valores de métricas, resultados experimentais ou publicações sem confirmação.
