# Importação experimental

O utilitário Python lê os dois checkouts locais do laboratório e gera os contratos de dados da SPEC v0.2. A curadoria padrão seleciona os runs vinculados em `RESEARCH_TIMELINE.md`. O scan também descobre execuções fora da seleção, reavaliações e pares incompletos. O Hub atual pode continuar servindo os JSONs editoriais da v0.1 enquanto os novos dados são revisados.

## Executar offline

Use Python 3.10+ em Linux ou macOS, com PyYAML instalado no ambiente. PyArrow é opcional para leitura de JSONs e necessário para confirmar a identidade dos pontos e as máscaras via Parquet. A lista de dependências está em [requirements-experiment-import.txt](../scripts/requirements-experiment-import.txt). Ambos podem vir de um ambiente existente ou de wheels locais. A CLI funciona sem conexão.

```sh
python scripts/import_experiments.py scan --config config/experiment_import.yaml
python scripts/import_experiments.py validate --config config/experiment_import.yaml
python scripts/import_experiments.py export --config config/experiment_import.yaml --dry-run
python scripts/import_experiments.py export --config config/experiment_import.yaml
python -B -m unittest discover -s tests -v
```

- **Scan** imprime contagens e ocorrências no stdout. **Validate** grava os relatórios. **Dry-run** mostra os arquivos previstos e os artefatos gerenciados que ficariam obsoletos, sem gravar relatórios ou criar diretórios. Código de retorno `1` indica erro; avisos permitem staging com as lacunas explícitas.
- Os caminhos no YAML são relativos ao arquivo de configuração. `--output` substitui o destino e é relativo ao diretório de execução. O staging padrão, ignorado pelo Git, fica em `.experiment-import/staging/`, com `data/`, `figures/` quando há aprovação e `reports/import_report.{json,md}`.
- Para descobrir e selecionar todo o acervo, use `selection: all` em uma cópia do YAML. A opção padrão, `timeline`, usa os IDs da timeline. As raízes dos laboratórios e os casos que têm identificação, tamanho, escala ou unidade confirmados são declarados no YAML.
- A importação abre apenas metadados, configurações de curadoria, Parquets de predição para projeções numéricas verificáveis, arquivos de autoria explicitamente referenciados para hashing e PNGs aprovados. Acesso ao laboratório é somente leitura. O importador não executa scripts científicos nem carrega checkpoints ou pickles.

## Curadoria para publicação

A configuração entregue está sem aprovações. Informar `--public` ativa a seleção pública explícita do YAML. A opção grava arquivos estáticos em `public/` e guarda o relatório local em `.experiment-import/public-audit/`.

1. Adicione a `public_approvals.experiments` apenas IDs de execuções autorizadas. Comparações exigem autorização para os dois participantes.
2. Adicione a `public_approvals.timeline` apenas eventos revisados com `visibility: public` na fonte editorial. Todos os experimentos vinculados precisam de aprovação. Links locais são representados por IDs opacos. Use URLs públicas verificadas durante a curadoria. A validação offline detecta referências locais quebradas e esquemas/hosts inseguros. A disponibilidade HTTP deve ser verificada na curadoria.
3. Para cada PNG, inclua uma entrada em `figures` com os campos abaixo. Marque `approved: true` depois de revisar o gráfico. Para publicação, inclua também o ID em `public_approvals.figures`.

| Campo de figura | Conteúdo |
| --- | --- |
| `id`, `phase`, `source`, `sha256` | ID estável, fase do YAML, caminho relativo dentro de `results/plots/` ou `results/comparisons/` e SHA-256 do PNG aprovado. |
| `experiment_id` ou `comparison_id` | Um único proprietário da figura, incluído na seleção de destino. |
| `scope`, `unit` | `test` ou `full_domain`, e unidade que coincide com uma medida documentada no mesmo escopo. |
| `spatial_scale`, `color_scale` | Escala espacial com `axis_unit` e `h` positivo. Escala de cor com `mode`, `min` e `max` finitos. Figuras individuais usam a revisão explícita desses campos. Para figuras de comparação, o importador confere o escopo, `h` e a escala nos relatórios. Esta versão aceita os mapas de divergência absoluta, assinada e erro em escala comum. |
| `caption`, `alt` | Objetos com textos `pt` e `en`. |

PNG é a única mídia aceita. O importador verifica o hash e os chunks e remove metadados embutidos preservando os dados de imagem. A figura recebe um caminho estático sob `figures/phase_01/` ou `figures/phase_02/`. O hash registrado em `source` identifica a imagem original aprovada.

```sh
python scripts/import_experiments.py export --config config/experiment_import.yaml --public --dry-run
python scripts/import_experiments.py export --config config/experiment_import.yaml --public
```

Ao remover aprovações, execute a exportação pública novamente para atualizar os JSONs e remover as figuras antes geradas que ficaram sem autorização. A primeira exportação pública exige pelo menos um registro aprovado. A geração preserva arquivos alheios e recusa sobrescrever saídas editadas manualmente. O índice de propriedade e o registro de uma exportação interrompida ficam no diretório de auditoria. Reexecutar o comando conclui uma gravação parcial sem perder a proteção dos arquivos.

## Contratos e comparabilidade

| Arquivo | Contrato e extensões |
| --- | --- |
| `experiments.json` | Mantém os campos da SPEC. Acrescenta `runId`, `phaseId`, `modelFamily`, `caseId`, `turbulenceModel`, `seed`, hashes, versão e método de split, entradas/alvos, arquitetura, escala do dataset, orçamento e estado de curadoria. `metrics` contém IDs das medidas. `figures` contém os metadados das imagens selecionadas. `configurationPath` fica `null` para preservar caminhos internos. |
| `metrics.json` | Mantém os campos da SPEC e acrescenta `id`, `experimentId`, `originalName`, `operatorParameters`, `pointCount` e `validityMask`. O objeto de máscara pode conter política, número e fração válidos, impressão digital da máscara e do conjunto avaliado. Métricas derivadas com mais de uma referência podem ter máscara única desconhecida. `source` contém ID opaco, tipo e hash da fonte. |
| `comparisons.json` | Novo contrato, com participantes por ID, manifesto por referência opaca, protocolo registrado, condições por métrica e escopo, limitações e figuras. Consumidores devem olhar `conditions[].measurementCompatible` e os IDs de métrica antes de gerar gráficos. O status do par resume as condições; pares `descriptive_only` podem conter condições bloqueadas. |
| `timeline.json` | Usa o array do Markdown da timeline ou um JSON editorial equivalente. Preserva o contrato da SPEC e os vínculos `experimentIds`, `decisionIds`, `hypothesisIds` e campos editoriais adicionais. Títulos e resumos preservam PT/EN e fallback por campo. |
| `reports/import_report.{json,md}` | Inventário de contagens, avisos e erros. O JSON registra IDs opacos, tipo, nome do arquivo e SHA-256 para reconstruir a proveniência local, sem expor caminhos absolutos ou internos. |

`assess_comparability(a, b)` recebe dois registros, cada um com uma medida normalizada na propriedade `evaluation`. `compatible` exige evidência da mesma medição e controles documentados. `descriptive_only` permite um contraste descritivo quando a medição coincide e há diferenças ou lacunas nas condições de treino. `blocked` impede a comparação quantitativa para aquela medida. Nenhum desses rótulos é um teste de atribuição causal.

A avaliação compara caso, Reynolds, turbulência, referência RANS fine, hash do dataset, partição, escopo, definição, unidade e operador. Com PyArrow, verifica a projeção ordenada de coordenadas e dos campos de referência e as máscaras finitas. As avaliações LSQ usam uma máscara comum aos campos. As variantes históricas usam máscaras por campo. O operador histórico SST é registrado como diferenças na grade do ETL mais autograd, com a ordem das diferenças do ETL. Split v1, split v2, domínio completo e teste seguem escopos distintos. Acurácia e divergência são séries separadas, e a divergência frente a zero mantém uma chave diferente da diferença frente à divergência do fine.

O escopo de saídas legadas exige evidência do caso e do artefato. Campos desconhecidos permanecem `null`. A fração supervisionada vem apenas dos metadados. As seeds vêm dos metadados do run ou do relatório histórico do par. O nome do diretório fornece apenas uma checagem diagnóstica. Os JSONs de treino têm prioridade sobre os YAMLs atuais.

## Verificações nesta entrega

A suíte automatizada inclui descoberta, JSON inválido e números não finitos, IDs duplicados, referências ausentes, sementes conflitantes, diferenças entre operadores e máscaras, links privados, autorização e revogação de PNGs, retomada de exportação, idempotência e dry-run. Para verificar também o acervo real com as projeções de Parquet, os comandos acima foram executados com `../lab_experimentos/analytics/.venv/bin/python`, que já disponibilizava PyYAML e PyArrow.

## Coleção prioritária

O perfil [featured_experiments.yaml](../config/featured_experiments.yaml) herda as fontes do importador e restringe a seleção a sete grupos. Cada grupo fixa os IDs de pares, o evento e as métricas aceitas em cada escopo. O perfil permite incluir os runs históricos do evento de momento. O run complementar de Re 32.000 exige igualdade dos pontos, referências e máscaras das duas métricas de RMSE no teste. A confirmação não preenche metadados de treinamento ausentes nem libera uma comparação quantitativa sem unidade confirmada.

```sh
python scripts/import_experiments.py scan --config config/featured_experiments.yaml
python scripts/import_experiments.py validate --config config/featured_experiments.yaml
python scripts/import_experiments.py export --config config/featured_experiments.yaml --dry-run
python scripts/import_experiments.py export --config config/featured_experiments.yaml
```

A saída fica em `.experiment-import/featured/`. O relatório `reports/curation_summary.md` lista os sete grupos, as fontes e as pendências de cada figura. A configuração fixa as imagens por SHA-256. Nos mapas por par, os limites de cor vêm do relatório original. Nos mapas individuais de velocidade da seed 42, a curadoria reproduz os limites a partir dos três campos ou dos erros no Parquet de teste conforme a rotina de plotagem original. A seleção inclui somente PNGs com escopo e escala sustentados. Os candidatos retidos continuam no YAML e no relatório, sem cópias de imagem.

O perfil é exclusivo para staging privado. O JSON da timeline inclui `comparisonIds`, `experimentIds`, `curationGroupId`, prioridade e estado de revisão. A síntese dos pares k–ε resume os deltas por seed no relatório, preservando a distinção entre partições. Para validar o run complementar e as figuras com comparação, use um ambiente Python com PyArrow.

## Identidade e projeções na v0.5

`config/catalog_experiments.yaml` gera o catálogo histórico em `.experiment-import/catalog`. A configuração prioritária continua gerando `.experiment-import/featured`, com todas as medições reconhecidas dos runs selecionados. O recorte das condições usado nas comparações prioritárias permanece curado.

- `experiments.json` mantém o ID anterior de cada treinamento. `temporal.executedAt` representa o início e registra origem e confiança. Datas de atualização, importação e publicação são independentes.
- `evaluations.json` vincula medições por fonte, escopo e operador. Reavaliações exigem evidência do run original. Quando não houver vínculo confirmado, ficam no catálogo local com `experimentId: null`.
- `metrics.json` preserva chaves originais, máscaras e unidades documentadas. `training.json` contém somente campos numéricos permitidos do histórico, separados por etapa e época. O portal carrega o histórico ao abrir o painel de perdas.
- `public_approvals.experiments`, `comparisons`, `timeline` e `figures` controlam a divulgação. A aprovação de um par também exige os dois runs aprovados. `public_approvals.training` autoriza histórico estruturado somente para runs aprovados. Reavaliações ficam locais.
- O relatório separa runs, avaliações e reavaliações, com contagens por fase, família, confiança temporal, arquivamento e publicação.

Os dois projetos declaram `execution_timezone: UTC`. Timestamps sem offset usam UTC e timestamps com offset explícito são convertidos para UTC. A confiança de um horário recuperado do nome permanece `inferred`.

A projeção pública requer identificador do run, fase, família, caso CFD, Reynolds, modelo de turbulência e seed. Runs com esses campos incompletos ficam na revisão local. O build público também aplica a regra a exportações aprovadas anteriores e retira as métricas, avaliações, comparações, figuras e marcos dependentes. A aprovação explícita continua obrigatória.
