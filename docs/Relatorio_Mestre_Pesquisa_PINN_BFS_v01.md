# Relatório mestre da pesquisa — PINNs aplicadas à correção CFD/RANS em Backward-Facing Step

**Versão:** 0.1 (primeira camada)  
**Data de consolidação:** 19/11/2026  
**Repositório de referência:** https://github.com/borges12matheus/bfs-physics-informed-learning  
**Natureza:** inventário científico preliminar; não substitui auditoria de código, commits, logs e dados experimentais.

## 1. Resumo executivo

A pesquisa evoluiu de estudos de PINNs/PIML para problemas clássicos de dinâmica dos fluidos, inicialmente com ênfase na cavidade com tampa móvel, para a investigação de **modelos corretores de campos CFD/RANS coarse→fine** no escoamento sobre degrau para trás (*Backward-Facing Step*, BFS). O eixo científico atual é o compromisso entre **acurácia preditiva, consistência física, generalização e dependência de dados de maior fidelidade**. Foram discutidos e testados baselines MLP, PINNs com continuidade e momento, avaliação multi-Re, estratégias de escalonamento, gradientes de entrada e operadores de derivação espacial. As conversas registram ganhos de acurácia na correção entre malhas, mas dificuldades de generalização para Reynolds não vistos e benefícios físicos que não são uniformes.

**Regra de interpretação:** proposta ≠ implementação ≠ experimento concluído ≠ contribuição demonstrada. Resultados qualitativos citados abaixo exigem vinculação posterior a métricas, gráficos, configuração e commit.

## 2. Linha evolutiva

| Fase | Abordagem | Motivação | Situação e implicação |
|---|---|---|---|
| Fundamentação | PINNs/PIML, Navier–Stokes, CFD, RANS/LES e otimização | Construir base teórica | Planejada/documentada |
| Pipeline inicial | Cavidade com tampa móvel; PINN corretora após MLP | Reduzir divergência mantendo acurácia | Roteiro proposto, não confundir com arquitetura atual |
| Mudança de caso | BFS com campos RANS coarse/fine | Estudar separação e recirculação | Caso central da pesquisa |
| Modelagem | MLP versus PINNs com perdas de continuidade e momento | Isolar contribuição da física | Experimentos relatados |
| Robustez | Multi-Re, splits, z-score/RobustScaler e gradientes | Examinar generalização e sensibilidade | Resultados parciais relatados |
| Validação | ERCOFTAC/Le et al., divergência, derivadas LSQ/KDTree | Verificar validade física | Em consolidação |
| Próxima investigação | Pesos de perdas, adimensionalização, menos dados fine | Melhorar compromisso físico e eficiência de dados | Hipóteses abertas |

## 3. Matriz de decisões e iniciativas

**Estados:** A = adotada; I = implementada; T = testada; P = proposta; E = em estudo; V = validação parcial. Estados baseados em relatos, não em auditoria independente.

| ID | Iniciativa/decisão | Motivação | Estado | Evidência ou resultado relatado | Uso na dissertação |
|---|---|---|---|---|---|
| DEC-01 | Selecionar BFS como benchmark | Separação e recirculação | A | Caso principal atual | Introdução/metodologia |
| DEC-02 | Simular RANS em malhas coarse/fine com OpenFOAM | Construir pares de campos | I | Malhas e configurações discutidas | Metodologia |
| DEC-03 | Aprender correção coarse→fine | Aumentar fidelidade de campo | I/T | Melhoria de acurácia relatada | Resultados |
| DEC-04 | Usar MLP como baseline | Isolar efeito das restrições físicas | I/T | Comparações MLP/PINN | Metodologia/resultados |
| DEC-05 | Acrescentar continuidade à loss | Penalizar divergência | I/T | Ganho físico não uniforme | Resultados |
| DEC-06 | Acrescentar momento à loss | Melhorar aderência às equações | I/T | cont_mom aproximou-se de cont em multi-Re | Resultados |
| DEC-07 | Testar Reynolds não visto | Medir generalização | T | Queda de acurácia e física | Limitações |
| DEC-08 | Comparar RobustScaler e z-score | Investigar escalonamento | T | Pequena piora com RobustScaler | Ablação |
| DEC-09 | Incluir gradientes de velocidade/pressão | Enriquecer features locais | T | Menor ruído visual em parte do domínio | Resultados |
| DEC-10 | Calcular derivadas via LSQ + KDTree | Tornar avaliação espacial consistente | I | Alinhamento de métodos relatado | Metodologia |
| DEC-11 | Usar no-slip, balanço de massa, Cp/Cf e perfis | Validar física além da divergência | V | Indicadores discutidos | Validação |
| DEC-12 | Adimensionalizar variáveis | Separar escala física de normalização estatística | E | Discussão conceitual | Metodologia futura |
| DEC-13 | Calibrar wcont e wmom | Equilibrar perdas | P | Investigação sugerida | Próximos experimentos |
| DEC-14 | Reduzir fração de dados fine | Menor custo de supervisão | P | Limitação identificada | Discussão |
| DEC-15 | Investigar PINN pura/menos supervisionada | Diminuir dependência de fine | P | Alternativa ainda não validada | Trabalhos futuros |
| DEC-16 | Utilizar ERCOFTAC BFS/Le et al. | Validação com benchmark | A | Perfis e ajuste de domínio relatados | Validação |
| DEC-17 | Publicar comparação física/acurácia | Comunicar limites e resultados | I | Submissão relatada; aceite não confirmado | Produção científica |
| DEC-18 | Explorar Neural ODE/PDE, surrogates e transferência | Arquiteturas alternativas | E | Revisão/discussões | Trabalhos futuros |

## 4. Matriz de evidências, interpretações e lacunas

| Questão | Evidência disponível no histórico | Interpretação cautelosa | Validação ainda necessária |
|---|---|---|---|
| Correção coarse→fine | Ganhos de acurácia relatados | Rede aprende diferenças entre soluções RANS de malhas | Quantificar erro por região e comparar a DNS/experimento quando possível |
| PINN versus MLP | Desempenho físico e preditivo variável | Física adicionada não garante melhora simultânea | Fronteira de Pareto e múltiplas sementes |
| Momento versus continuidade | cont_mom próximo de cont em cenário multi-Re | Benefício incremental ainda incerto | Ablação controlada dos pesos |
| Generalização em Reynolds | Piora em Re não visto | Extrapolação é limitação importante | Leave-one-Re-out, mais Re e adimensionalização |
| RobustScaler | Pequena piora frente ao z-score | Troca não ajudou nesses testes | Mesmo split, seed e arquitetura |
| Gradientes como features | Redução visual de ruído em x/H ~7–12 | Informação diferencial pode ser útil | Comparação quantitativa com/sem features |
| Derivadas e divergência | Revisão de np.gradient versus LSQ/KDTree | Operador numérico afeta métricas físicas | Teste de campos analíticos e convergência espacial |
| Referência DNS | Perfis em posições específicas, não campo completo | Não permite comparar mapas completos de divergência DNS | Perfis, reattachment, Cp/Cf quando disponíveis |

**Nota física:** divergência próxima de zero, não deslizamento nas paredes e balanço de massa são verificações necessárias e úteis, mas não suficientes para demonstrar consistência completa com RANS, momento e condições de contorno.

## 5. Hipóteses e questões científicas

| ID | Questão | Hipótese provisória | Experimento de verificação |
|---|---|---|---|
| H01 | É possível melhorar fidelidade e consistência simultaneamente? | Existe compromisso superior ao baseline MLP | Pareto RMSE × divergência × balanço de massa |
| H02 | O termo de momento acrescenta benefício? | Melhora regiões de separação | Ablação cont versus cont_mom |
| H03 | Como melhorar generalização multi-Re? | Escalas adimensionais e amostragem de Re ajudam | Leave-one-Re-out |
| H04 | Gradientes melhoram a correção? | Features locais reduzem erro em regiões críticas | Ablação de gradientes |
| H05 | É possível usar menos dados fine? | Restrições físicas reduzem dependência de supervisão | Curva de desempenho versus fração de fine |
| H06 | As métricas físicas são confiáveis? | Operadores consistentes melhoram robustez de avaliação | Campos analíticos, teste de malha e comparação de operadores |

## 6. Protocolo para catálogo de experimentos

Cada registro deve armazenar `EXP-ID`, data, hipótese, decisão associada, commit, dataset e versão, Reynolds de treino/teste, split, features, normalização, arquitetura, pesos da loss, seed, otimizador, épocas, hardware, custo, métricas, gráficos, limitações e conclusão.

```yaml
experiment_id: EXP-XXX
date: YYYY-MM-DD
hypotheses: [H01]
decisions: [DEC-05]
commit: null
dataset_version: null
reynolds_train: []
reynolds_test: []
split: null
normalization: null
features: []
model: null
loss_weights: {data: null, continuity: null, momentum: null}
metrics: {rmse: null, divergence_l2: null, mass_imbalance: null}
figures: []
conclusion: "Pendente de auditoria"
evidence_status: "não auditado"
```

## 7. Correspondência com capítulos da dissertação

| Capítulo | Material que já pode ser organizado | Lacuna |
|---|---|---|
| Introdução | Motivação do custo CFD, correção coarse→fine e consistência física | Delimitar contribuição central |
| Fundamentação | PINNs, RANS, BFS, otimização e modelos híbridos | Bibliografia com referências completas |
| Metodologia | OpenFOAM, datasets, redes, losses, splits e métricas | Versões, equações e parâmetros finais |
| Resultados | MLP/PINN, multi-Re, escalonamento, gradientes | Tabelas e figuras rastreadas por EXP-ID |
| Discussão | Trade-off, generalização, limites de fine RANS | Evidência independente e ameaças à validade |
| Conclusões | Achados confirmados e questões abertas | Relacionar cada afirmação a experimento |

## 8. Plano de auditoria (segunda camada)

1. Vincular cada DEC-ID à conversa de origem, data e decisão efetiva.
2. Auditar histórico de commits e configurações do repositório atual.
3. Criar registros EXP-ID com métricas, artefatos e gráficos.
4. Validar operadores numéricos e métricas físicas independentemente.
5. Planejar ablações de pesos, gradientes, escalas e frações de dados fine.

## 9. Fontes e proveniência

- **Escopo Projeto Mestrado.pdf:** plano inicial de fundamentação, problemas clássicos, turbulência, otimização e dissertação.
- **Roteiro_Pipeline_PINN_CFD.pdf:** proposta de PINN corretora após MLP, continuidade, amostragem e métricas.
- **Notas Estudo Bibliográfico - PINN - Documentos Google.pdf:** anotações sobre PIML, dados, surrogate modeling e CFD.
- **Histórico de conversas do projeto Mestrado:** discussões sobre BFS, correção RANS, avaliação física, multi-Re, normalização, features, otimização e artigo.
- **Repositório principal:** https://github.com/borges12matheus/bfs-physics-informed-learning (indicado como fonte técnica; **não auditado nesta versão**).

**Limitação de proveniência:** esta primeira camada consolida o material disponível, sem rastreamento individual de mensagens, commits ou execuções. Não apresentar observações qualitativas como resultados quantitativos comprovados.
