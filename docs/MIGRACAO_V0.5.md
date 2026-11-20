# Auditoria e migração para a SPEC v0.5

## Diagnóstico anterior à implementação

O checkout contém HTML, CSS e módulos ES nativos, com build estático em `scripts/build_site.mjs`. As rotas por fragmento preservam links diretos sem servidor de aplicação. O importador Python descobre metadados, avaliações, pares e figuras, valida os vínculos e gera relatórios e um índice de hashes. A distribuição pública usa exclusivamente artefatos aprovados e verificados por hash. A curadoria local v0.4 reúne 32 execuções e 126 métricas de destaque. O inventário também contém registros históricos fora desse recorte.

| Fonte observada | Campo/adaptação | Componente |
| --- | --- | --- |
| JSON de treino `start_time` e `end_time` | `temporal` com começo, fim, confiança, origem e offset se registrado | Catálogo, detalhe, auditoria e G2 |
| Log original com início explícito, quando presente | Segunda fonte temporal vinculada ao run | Catálogo e auditoria |
| Sufixo `YYYYMMDD_HHMMSS` do identificador do run | Horário inferido, fuso ausente | Catálogo, separado da série confirmada |
| Árvore de resultados e identidade da origem | Run canônico por projeto e identificador; avaliações por fonte | Dashboard, catálogo e reavaliações |
| JSONs escalares de avaliação e logs estruturados | Métrica original, definição, unidade, método, operador, máscara e referência, ou lacuna explícita | Matriz, lista e auditoria |
| Manifesto, isonomia e validação de coorte | Elegibilidade por condição, com limites de desenho experimental | Comparador |
| Seleção e manifesto de hashes | Projeções separadas para revisão e distribuição | Dashboard e build |
| Manuscrito local, seções 2–4 | Leitura do compromisso entre acurácia e divergência apenas para o protocolo k–ε | Investigação de réplicas, sem publicar o PDF |

Amostras. O JSON da MLP k–ε de 19/09 registra início às 02:45:35.773313. O JSON da PINN SST de 13/11 registra início às 21:32:59.062285, enquanto o nome termina em 21:32:58. Ambos carecem de fuso. Há runs de origem com apenas sufixo e reavaliações cujos JSONs não declaram horário ou checkpoint original. Datas de comparação, de evento e de atualização não preenchem esses campos.

O manuscrito descreve três seeds, menor MAE de velocidade e pressão cinemática na MLP e menor diagnóstico de divergência na PINN em teste e domínio completo. Usa referência numérica RANS fine. O diagnóstico não mede conservação integral e o protocolo não demonstra generalização. O estado editorial do manuscrito não está confirmado.

## Plano incremental

1. Acrescentar metadados temporais, identidade de avaliações, cobertura e projeções compatíveis com a v0.4.
2. Conectar os seletores e filtros ao dashboard e ao catálogo tabular.
3. Exibir medidas individuais e matrizes protegidas por protocolo. Consolidar razões de bloqueio e preservar timeline, figuras, PT/EN e auditoria.
4. Testar importação, isolamento público, typecheck da camada de dados, build e navegação responsiva em subdiretório.

## Resultado com os checkouts locais

| Projeção | Runs | Inícios confirmados | Horários inferidos | Avaliações | Métricas | Figuras |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Prioritária | 32 | 25 | 7 | 93 | 2.927 | 7 |
| Histórica | 70 | 50 | 20 | 201 | 6.261 | 7 |
| Pública padrão | 0 | 0 | 0 | 0 | 0 | 0 |

As 201 avaliações históricas incluem 14 artefatos de reavaliação em sete diretórios. Os registros ficam separados porque escopo e operador podem variar por fonte. Nenhum dos 14 declara checkpoint de origem ou horário próprio confirmado. O relatório registra essas pendências e contabiliza 14 runs históricos arquivados e dois artefatos duplicados. As fontes de treino gravam horários sem offset. A configuração dos dois projetos declara UTC conforme confirmação do responsável pela pesquisa. `importedAt` e `publishedAt` permanecem nulos por falta de recibo de ingestão ou publicação reutilizável como evidência.

A série temporal usa apenas horários de início confirmados e segue o calendário registrado pelas fontes. O catálogo ordena por confiança e ordena instantes com offset conhecido antes dos horários sem fuso dentro de cada classe. No gráfico de Reynolds, o conjunto multicaso é uma categoria única. Gráficos e catálogo compartilham filtros por fragmento, inclusive ao recarregar a página.

A coleção prioritária tem cinco comparações descritivas e oito bloqueadas. A histórica tem nove descritivas e dez bloqueadas. A elegibilidade continua dependendo de definição, unidade, escopo, referência, operador, partição e máscara. A matriz e as barras pareadas foram exercitadas com um par sintético compatível. A coleção real usa lista de medições individuais e mantém as razões descritas em painel expansível. A dispersão de acurácia e divergência fica indisponível enquanto faltar um conjunto compatível.

O manuscrito foi usado para contextualizar o compromisso observado entre acurácia e divergência na investigação k–ε, com referência numérica RANS fine. Sua identificação bibliográfica aparece apenas na revisão local, com estado editorial não confirmado. O PDF e seus agregados não integram os pacotes de dados. A pressão SST e as demais grandezas sem unidade comprovada conservam a lacuna.

## Verificação e pendências

- `npm run typecheck` checa os tipos e seletores da camada analítica. A arquitetura segue nativa, sem React ou Vite no checkout.
- `npm test` e `python -B -m unittest discover -s tests` cobrem identidade, idempotência, proveniência temporal, escopo, comparabilidade e isolamento da publicação.
- `npm run build` produz a distribuição estática. A suíte `node tests/browser_science.mjs --local-review` valida raiz pública, fixture aprovada em subdiretório e os dois perfis privados. Inclui filtros, PT/EN, navegação, teclado, contraste e layouts em 375, 768 e 1440 px.
- A distribuição padrão segue editorial. O deploy remoto, a aprovação pública da coleção e a resolução dos horários e checkpoints pendentes dependem das respectivas fontes e aprovações.
