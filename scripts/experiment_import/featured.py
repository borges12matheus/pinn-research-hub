"""Curated selection and audit notes built from the existing import records."""
from statistics import mean

from .comparability import summarize_checks
from .parsers import token


def metric_key(metric):
    return metric["evaluationSet"], metric["name"]


def same_test(candidate, baseline):
    names = {"rmse_uv_corrected", "rmse_p_corrected"}

    def test_metrics(record):
        return {metric["name"]: metric for metric in record["_metrics"]
                if metric["evaluationSet"] == "test" and metric["name"] in names}

    candidate_metrics, baseline_metrics = map(test_metrics, (candidate, baseline))
    if set(candidate_metrics) != names or set(baseline_metrics) != names:
        return False
    for name in names:
        a, b = candidate_metrics[name], baseline_metrics[name]
        mask = a["validityMask"] or {}
        if (not mask.get("evaluationFingerprint") or not mask.get("fingerprint") or mask != b["validityMask"]
                or any(a[key] is None or a[key] != b[key] for key in ("pointCount", "definition", "calculationMethod"))
                or a["value"] is None or b["value"] is None):
            return False
    return True


def select_featured(config, runs, comparisons, timeline, audit):
    selected, pairs, events = {}, {}, {}
    for group in config["groups"]:
        event_id = group["event"]
        event = timeline.get(event_id)
        if event is None or event_id in events:
            audit.add("error", "invalid_featured_event", group["id"], event_id)
            continue
        members = set()
        included_pairs = []
        for identifier in group["comparisons"]:
            pair = comparisons.get(identifier)
            if pair is None or len(pair["experimentIds"]) != 2 or not set(pair["experimentIds"]) <= set(event["experimentIds"]):
                audit.add("error", "invalid_featured_comparison", event_id, identifier)
                continue
            pairs[identifier] = pair
            included_pairs.append(identifier)
            members.update(pair["experimentIds"])
        if group.get("include_event_runs"):
            members.update(set(event["experimentIds"]) & runs.keys())
        verified = {}
        for identifier in group.get("require_shared_test", []):
            match = None
            if identifier in event["experimentIds"] and identifier in runs:
                match = next((member for member in sorted(members)
                              if identifier != member and same_test(runs[identifier], runs[member])), None)
            if match:
                members.add(identifier)
                verified[identifier] = match
            else:
                audit.add("warning", "featured_test_unverified", event_id, identifier)
        requested = {(scope, name) for scope, names in group["metrics"].items() for name in names}
        for identifier in sorted(members):
            allowed = requested
            if identifier in verified:
                allowed = {key for key in requested if key[0] == "test" and key[1].startswith("rmse_")}
            selected.setdefault(identifier, set()).update(allowed)
        events[event_id] = {**event, "comparisonIds": included_pairs, "experimentIds": sorted(members),
                            "verifiedTestMatches": verified, "curationGroupId": group["id"],
                            "priority": group["priority"], "curationStatus": "pending_review"}
        if group.get("preliminary"):
            events[event_id]["evidenceStatus"] = "preliminary"
    by_group = {event["curationGroupId"]: event for event in events.values()}
    for figure in config.get("figures", []):
        event = by_group.get(figure["group"], {})
        if (figure.get("comparison_id") not in event.get("comparisonIds", [])
                and figure.get("experiment_id") not in event.get("experimentIds", [])):
            audit.add("error", "figure_outside_featured_group", figure["id"], figure["group"])
    return selected, pairs, events


def filter_metrics(selected_metrics, runs, comparisons, restrict_runs=True):
    all_ids = set()
    for identifier, requested in selected_metrics.items():
        record = runs[identifier]
        accepted = [metric for metric in record["_metrics"] if metric_key(metric) in requested]
        all_ids.update(metric["id"] for metric in accepted)
        if restrict_runs:
            record["_metrics"] = accepted
    for pair in comparisons.values():
        pair["conditions"] = [check for check in pair["conditions"] if set(check["metricIds"]) <= all_ids]
        pair["status"] = summarize_checks(pair["conditions"])
        pair["limitations"] = sorted({reason for check in pair["conditions"] for reason in check["reasons"]})
        if not pair["conditions"]:
            pair["limitations"] = ["no_shared_verified_metric_scope"]


def validate_groups(config):
    groups = config.get("groups")
    if not isinstance(groups, list) or not groups:
        raise ValueError("featured selection requires a nonempty groups list")
    ids = set()
    for group in groups:
        identifier = token(group["id"])
        if not identifier or identifier in ids or group["priority"] not in {"P0", "P1"} or not token(group["event"]):
            raise ValueError("invalid or duplicated featured group")
        ids.add(identifier)
        for key in ("comparisons", "require_shared_test"):
            values = group.get(key, [])
            if not isinstance(values, list) or not all(token(x) for x in values) or len(values) != len(set(values)):
                raise ValueError(f"invalid featured {key}")
        if not group["comparisons"] or not group["metrics"] or any(
            scope not in {"test", "full_domain"} or not isinstance(names, list) or not names
            or not all(token(name) for name in names) for scope, names in group["metrics"].items()
        ):
            raise ValueError("featured group requires comparisons and scoped metric names")
        for key in ("title", "limitations", "pending"):
            if not isinstance(group[key], str) or not group[key].strip():
                raise ValueError(f"invalid featured {key}")
    for figure in config.get("figures", []):
        if figure.get("group") not in ids:
            raise ValueError("figure candidate needs a known featured group")


def curation_report(config, data):
    runs = {record["id"]: record for record in data["experiments"]}
    pairs = {record["id"]: record for record in data["comparisons"]}
    events = {record["id"]: record for record in data["timeline"]}
    metrics = {record["id"]: record for record in data["metrics"]}
    exported_figures = {figure["id"]: figure for owner in [*runs.values(), *pairs.values()] for figure in owner["figures"]}
    lines = ["# Curadoria dos experimentos prioritários", "",
             "Coleção autorizada apenas para staging privado. Publicação pendente de revisão.",
             "As medições usam RANS fine como referência. Condições bloqueadas ficam disponíveis para inspeção individual.", ""]
    for group in config["groups"]:
        event = events.get(group["event"], {})
        lines += [f"## {group['priority']} · {group['title']}", "",
                  f"- Evento `{group['event']}`. Status de publicação **privado · revisão pendente**.",
                  f"- Limitações. {group['limitations']}",
                  f"- Pendências. {group['pending']}",
                  "- Evidências por par e manifesto."]
        checks = []
        for identifier in event.get("comparisonIds", []):
            pair = pairs[identifier]
            ref = pair["manifestSource"]
            checks.extend(pair["conditions"])
            lines.append(f"  - `{identifier}` · `{pair['status']}` · manifesto `{ref['id']}` · SHA-256 `{ref['sha256']}`.")
        if checks:
            blocked = sorted({reason for check in checks if check["status"] == "blocked" for reason in check["reasons"]
                              if any(reason.startswith(field) for field in (
                                  "unit", "evaluationFingerprint", "fingerprint", "dataset", "split", "pointCount"))})
            if blocked:
                lines.append("- Verificações pendentes na comparação quantitativa · " + ", ".join(f"`{reason}`" for reason in blocked) + ".")
        lines.append("- Execuções, métricas e referências locais.")
        for identifier in event.get("experimentIds", []):
            run = runs[identifier]
            seed = run["seed"] if run["seed"] is not None else "a confirmar"
            run_metrics = [metrics[key] for key in run["metrics"]]
            labels = ", ".join(f"`{m['evaluationSet']}:{m['name']}`" for m in run_metrics) or "sem métricas verificadas no escopo escolhido"
            ref_ids = ", ".join(f"`{ref}`" for ref in sorted({m["source"]["id"] for m in run_metrics}))
            budget = run["trainingBudget"]
            fraction = budget["supervisedFraction"]
            supervision = ""
            if group["id"] == "supervisao-sst":
                n = budget["supervisedPoints"]
                fraction_label = "fração a confirmar" if fraction is None else f"{fraction:.0%}"
                supervision = f" · supervisão {fraction_label}, pontos {n if n is not None else 'a confirmar'}"
            lines.append(f"  - `{identifier}` · seed {seed}{supervision}. {labels}. Fontes {ref_ids or 'a confirmar'}.")
        conditional = set(group.get("require_shared_test", []))
        for identifier in sorted(conditional):
            match = event.get("verifiedTestMatches", {}).get(identifier)
            result = f"mesmo teste verificado em `{match}`" if match else "inclusão pendente"
            lines.append(f"- Run complementar `{identifier}` · {result}. A confirmação do teste não resolve lacunas de unidade ou configuração de treino.")
        lines.append("- Figuras selecionadas para curadoria.")
        for figure in config.get("figures", []):
            if figure["group"] != group["id"]:
                continue
            if figure["id"] in exported_figures:
                item = exported_figures[figure["id"]]
                folder = f"../{item['path']}"
                lines.append(f"  - [{item['id']}]({folder}) · copiada para staging · {item['field']} · `{item['evaluationSet']}`.")
            else:
                lines.append(f"  - `{figure['id']}` · retida · {figure.get('review_note', 'Verificar os erros de curadoria no relatório de importação.')}")
        if group.get("paired_summary"):
            lines.extend(_paired_summary(event, pairs, runs, metrics))
        if group.get("observation"):
            lines.append(f"- Observação global. {group['observation']}")
        lines.append("")
    return "\n".join(lines).encode()


def _paired_summary(event, pairs, runs, metrics):
    deltas = {}
    for identifier in event.get("comparisonIds", []):
        pair = pairs[identifier]
        mlp_id, pinn_id = pair["experimentIds"]
        mlp, pinn = runs[mlp_id], runs[pinn_id]
        if mlp["modelFamily"] != "MLP" or pinn["modelFamily"] != "PINN-cont" or mlp["seed"] is None or mlp["seed"] != pinn["seed"]:
            continue
        for check in pair["conditions"]:
            if check["scope"] != "test" or not check["measurementCompatible"]:
                continue
            a, b = (metrics[key]["value"] for key in check["metricIds"])
            deltas.setdefault((check["metric"], check["unit"]), []).append((mlp["seed"], b - a))
    lines = ["- Diferenças emparelhadas PINN menos MLP por seed. A média simples resume splits distintos, sem combinar pontos de teste."]
    for (name, unit), values in sorted(deltas.items()):
        details = ", ".join(f"seed {seed} {value:+.6g}" for seed, value in sorted(values))
        lines.append(f"  - `{name}` ({unit}) · {details} · média {mean(value for _, value in values):+.6g}, n={len(values)} pares.")
    if not deltas:
        lines.append("  - Nenhuma condição com identidade de medição confirmada.")
    return lines
