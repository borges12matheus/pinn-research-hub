# Auditoria técnica, funcional e documental

## Resumo executivo

A implementação corresponde funcionalmente à **v0.5**. O portal usa HTML, CSS e módulos ES nativos, build estático em Node.js e importador offline em Python. O PRD e a SPEC originais descrevem a v0.1. As especificações v0.2 a v0.4 registram a evolução e a v0.5 orienta a experiência analítica atual. A proposta de migrar para React e Vite nas especificações antigas não corresponde à arquitetura entregue. A v0.5 condiciona essa preservação à existência prévia da stack.

A distribuição aprovada passou no build e nas verificações funcionais. O conteúdo científico versionado permaneceu intacto. A auditoria encontrou lacunas de validação e tratamento de falhas que poderiam afetar a apresentação de dados, além de instruções operacionais desatualizadas.

## Problemas encontrados

| ID | Severidade | Área | Evidência e impacto | Tratamento |
| --- | --- | --- | --- | --- |
| AUD-01 | Média | README e guia do importador | A versão descrita era v0.3. Os comandos misturavam o build editorial, os perfis privados e a distribuição já aprovada. | Documentação atualizada para a v0.5, com os três fluxos e os comandos dos testes. |
| AUD-02 | Baixa | Marcador de `dist/` | O sufixo v0.3 do identificador pode ser confundido com a versão funcional. Ele é usado para reconhecer uma saída que o build pode substituir. | Mantido por compatibilidade e documentado no código. |
| AUD-03 | Média | `project.json` e renderização | `isDemoData: true` era obrigatório no schema, mas o texto demonstrativo não era usado. O campo global também não representa as diferentes evidências. | Removidos o campo e o texto obsoleto. A indicação de revisão local e os estados individuais de evidência continuam visíveis. |
| AUD-04 | Alta | Contratos de comparação | O verificador do frontend reavaliava o caso e os fingerprints, porém aceitava uma condição declarada compatível com diferenças no número de pontos válidos, na política da máscara ou nos controles de treino. | Exigir referência RANS fine, operador e máscara verificáveis e controles compatíveis para gráficos e rankings. Manter apresentação descritiva quando o protocolo só autoriza essa leitura. |
| AUD-05 | Média | Comparador e estados de falha | Se `experiments.json` estivesse ausente, uma tabela podia tentar nomear uma execução inexistente e lançar exceção. A mensagem genérica não identificava o recurso. | Exibir apenas medidas vinculadas à condição, usar nome indisponível sem link órfão e identificar o JSON e o status HTTP quando disponível. Testes simulam os dois arquivos ausentes. |
| AUD-06 | Média | Build editorial | A validação durante o build se concentrava nos IDs. Campos editoriais inválidos podiam passar pelo CI e só falhar no navegador. Links de prioridades para marcos não eram conferidos nessa etapa. | Compartilhar o schema entre carregador e build e incluir a verificação referencial das prioridades. |
| AUD-07 | Baixa | Links externos | Os dois repositórios técnicos responderam 200. Em 20 destinos externos testados, 14 responderam 200, um respondeu 202 e cinco responderam 403 após a resolução de DOI. | Preservar os DOIs da bibliografia. 403 indica acesso recusado neste ambiente e não comprova um destino inválido. A abertura desses cinco destinos para o leitor segue pendente. |

## Alterações implementadas

- `README.md` e `docs/EXPERIMENT_IMPORT.md` descrevem a versão atual, a revisão privada, o pacote aprovado e a publicação.
- `assets/js/data.js`, `data/project.json` e `assets/js/render.js` removem a indicação demonstrativa obsoleta e preservam os estados de carregamento.
- `scripts/build_site.mjs` aplica o schema editorial compartilhado e documenta o marcador de propriedade da saída. `package.json` explicita módulos ES para que Node use o mesmo formato que o navegador.
- `assets/js/science/contracts.mjs`, `results.mjs` e `portal.mjs` reforçam a comparabilidade, os vínculos e os avisos de indisponibilidade.
- `tests/science.test.mjs`, `tests/fixtures/science.mjs` e `tests/browser_science.mjs` cobrem as regressões e o percurso em produção.

## Testes executados

| Comando | Resultado |
| --- | --- |
| `npm ci` com cache gravável em `/tmp` | Instalação reproduzida com o lockfile. |
| `npm run typecheck` | Passou na camada analítica tipada. |
| `npm test` | 12 testes passaram, incluindo recorte público, schemas, integridade referencial e controles de comparabilidade. |
| `npm run build -- --approved` | 39 arquivos de conteúdo e 1 marcador de propriedade em `dist/`. |
| `python -B -m unittest discover -s tests -v` (ambiente com PyYAML e PyArrow) | 19 testes passaram, incluindo Parquet, idempotência, segurança de paths e curadoria. |
| `node tests/browser_science.mjs --approved --local-review --production` | Passou nas edições editorial e aprovada, nos dois perfis privados e no smoke test remoto. |

No Chromium, a suíte cobriu menu, links profundos e recarga em subdiretório, filtros, tabelas, figuras, zoom, retorno, PT/EN, 404 parcial, foco de teclado e contraste dos controles verificados. Foram exercitadas larguras de 375, 768 e 1440 px. A validação de acessibilidade cobre essas interações e não equivale a uma auditoria integral de conformidade WCAG ou a testes em múltiplos navegadores.

## Validação científica

O pacote tem 6 marcos, 29 execuções, 84 avaliações, 2.561 métricas, 12 comparações, 7 figuras e 23 referências bibliográficas. Os contratos e os vínculos entre coleções foram verificados. As seis coleções científicas com registros no pacote contêm apenas itens públicos. O histórico bruto de treino, a revisão privada e os relatórios do importador ficam fora da distribuição. Os sete PNGs correspondem aos hashes aprovados. O catálogo local preserva as reavaliações separadas de seus runs, inclusive casos com vínculo pendente.

Todos os runs públicos indicam referência numérica RANS fine. Há 827 medidas de teste e 1.734 de domínio completo. As 700 medidas com unidade ausente preservam `null` e aparecem com unidade não informada. Na timeline, quatro marcos são verificados e dois preliminares. Dos 29 horários de início, 25 são confirmados e quatro inferidos, com UTC preservado. Essas classificações expressam a disponibilidade e a qualidade da evidência para o registro.

O recorte tem cinco comparações descritivas e sete bloqueadas, com 20 condições descritivas e 28 bloqueadas. A ausência de condição quantitativa compatível no recorte é respeitada pelo comparador. A visualização quantitativa foi exercitada com uma fixture sintética, e os gráficos individuais continuam sujeitos à sua própria validação de unidade, escopo e operador.

## GitHub Pages e produção

O workflow permanece manual na branch padrão. O job de build instala dependências, executa o typecheck e os testes e gera o pacote aprovado. O deploy só depende de um build bem-sucedido. O grupo de concorrência serializa publicações e o job de deploy recebe as permissões específicas do Pages. Automatizar cada push tornaria a atualização da branch suficiente para publicar qualquer novo pacote que passasse na integridade técnica. Mantive a etapa manual para preservar a decisão editorial explícita.

Em 20/11/2026, o portal respondeu HTTP 200. Antes das correções locais, 20 arquivos do site publicado eram idênticos por SHA-256 ao build local, entre HTML, CSS, contrato JS, JSONs e todos os PNGs. O smoke remoto confirmou seis marcos, abertura da investigação de réplicas, uma figura vinculada e recarga de rota interna. Nenhuma exceção JavaScript foi registrada nesse percurso. O SHA do deploy remoto é `5dc1316c6206af2cbc9e0894e58cb525e16e1790`, diferente do SHA do checkout auditado `bb2c0e76c15e7487cb2924669144c507395aef17`. A correspondência verificada é de conteúdo da distribuição anterior às correções. As correções desta auditoria foram testadas localmente. [Execução publicada](https://github.com/borges12matheus/pinn-research-hub/actions/runs/44670627262)

## Pendências

- Confirmar as unidades ausentes nas fontes antes de ampliar comparações quantitativas.
- Verificar em sessão humana os DOI `10.1073/pnas.2101784118`, `10.1111/cgf.13619`, `10.2514/3.8890`, `10.3390/en16052343` e `10.3390/fluids8020043`, que responderam 403. O DOI `10.1109/TII.2018.2873186` respondeu 202.
- Preencher e revisar a primeira edição do boletim semanal quando houver conteúdo.
- Integrar e publicar as correções após revisão do responsável. O workflow em produção permanece na versão anterior. A leitura do código não verificou regras administrativas de proteção de branches ou do ambiente `github-pages`.

## Recomendações futuras

- Avaliar versões menores das sete figuras para a web após revisão visual e nova aprovação dos artefatos. Os PNGs respondem pela maior parte dos cerca de 39 MiB de `dist/`. O carregamento de imagens e métricas já ocorre sob demanda.
- Avaliar deploy automático se a branch ganhar controles de revisão obrigatória para o pacote científico e o manifesto.
