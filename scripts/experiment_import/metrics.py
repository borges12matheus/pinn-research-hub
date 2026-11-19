"""Map lab metrics to the Hub contract, retaining the original keys."""
from .normalization import integer
from .predictions import inspect_predictions

FIELDS = {
    "coarse": ("divergence_coarse", "div_u", "Divergência do campo coarse em relação a zero."),
    "fine": ("divergence_fine", "div_u_f", "Divergência da referência fine em relação a zero."),
    "delta": ("divergence_delta_pred", "div_delta_pred", "Divergência da correção prevista em relação a zero."),
    "corrected": ("divergence_corrected", "div_corrected", "Divergência do campo corrigido em relação a zero."),
    "error": ("divergence_error_corrected_vs_fine", "div_error_vs_fine", "Diferença ponto a ponto entre as divergências do campo corrigido e do fine."),
}
STATS = {
    "mae": "Média dos valores absolutos.",
    "rmse": "Raiz da média dos quadrados.",
    "l2": "Norma L2 sem normalização pelo número de pontos.",
    "linf": "Maior valor absoluto.",
    "mean_signed": "Média assinada.",
    "std": "Desvio-padrão.",
    "n_valid": "Quantidade de pontos finitos.",
    "valid_fraction": "Fração de pontos finitos.",
}


def accuracy_specs():
    specs = {}
    for field, unit, label in (("uv", "velocity", "velocidade vetorial (u,v)"), ("p", "pressure", "pressão")):
        for statistic, description in (
            ("mae", "MAE vetorial (média das normas do erro)" if field == "uv" else "MAE"),
            ("rmse", "RMSE vetorial (raiz da média das normas ao quadrado)" if field == "uv" else "RMSE"),
            ("l2_rel", "Norma L2 do erro dividida pela norma L2 da referência"),
        ):
            for stage, field_label in (("coarse", "campo coarse"), ("corrected", "campo corrigido")):
                key = f"{statistic}_{field}_{stage}"
                original = key if statistic == "l2_rel" else f"{key}_to_fine"
                if original == "mae_p_coarse_to_fine":
                    original = "mae_p_pressure_coarse_to_fine"
                specs[original] = (key, f"{description} de {label} do {field_label} frente ao RANS fine.",
                                   "1" if statistic == "l2_rel" else unit, True)
        delta = f"mae_{field}_deltas_pred_vs_true"
        specs[delta] = (delta, f"MAE de {label} entre a correção prevista e a de referência.", unit, True)
        pct = "melhora_MAE_pct" if field == "uv" else "melhora_MAE_pct_pressure"
        rer = "RER (u,v)" if field == "uv" else "RER (p)"
        definition = f"Redução do MAE de {label}, 1 menos o erro corrigido dividido pelo erro coarse."
        specs[rer] = (f"rer_{field}", definition, "1", False)
        specs[pct] = (f"rer_{field}_pct", definition + " Em porcentagem.", "%", False)
    return specs


ACCURACY = accuracy_specs()


def metric_scope(path):
    name = path.stem
    for suffix, scope, physical in (
        ("_physics_full_domain", "full_domain", True), ("_physics_test", "test", True),
        ("_physics", None, True), ("_full_domain", "full_domain", False),
        ("_test", "test", False), ("_eval", None, False),
    ):
        if name.endswith(suffix):
            base = name.removesuffix(suffix)
            pred = name + "_predictions" if physical else base + "_predictions" + suffix
            return scope, physical, path.with_name(f"{pred}.parquet")
    return None, False, path.with_name(f"{name}_predictions.parquet")


def _operator(data, repo, audit, identifier):
    recorded = data.get("divergence_source") or {}
    name = recorded.get("corrected")
    if name == "local_least_squares":
        method = data.get("divergence_method") or {}
        return "local_least_squares_kdtree", {"neighbors": integer(method.get("n_neighbors"))}
    if name == "openfoam_coarse_plus_autograd_delta":
        actual = repo.get("legacy_divergence_operator")
        if actual == "etl_grid_differences_plus_autograd":
            audit.add("info", "legacy_operator_label", identifier, "ETL attribution replaces the historical OpenFOAM label")
            return actual, {"edgeOrder": repo.get("legacy_edge_order")}
        return actual, {}
    return None, {}


def _metric(record, original, name, value, unit, definition, scope, operator, parameters, points, mask, ref, lower):
    return {
        "id": f"{record['id']}:{scope or 'unknown'}:{name}",
        "experimentId": record["id"], "originalName": original, "name": name,
        "value": value, "unit": unit, "definition": definition, "evaluationSet": scope,
        "referenceType": record["referenceType"], "calculationMethod": operator, "operatorParameters": parameters,
        "pointCount": points, "validityMask": mask, "source": ref,
        "lowerIsBetter": lower,
        "evidenceStatus": "verified" if scope and value is not None and record["referenceType"] else "preliminary",
        "visibility": record["visibility"], "updatedAt": record["updatedAt"], "sources": [],
    }


def extract_metrics(record, data, path, ref, case, repo, audit, verify_predictions):
    scope, physical, prediction = metric_scope(path)
    operator, parameters = _operator(data, repo, audit, record["id"]) if physical else ("pointwise_field_error", {})
    if not prediction.resolve().is_relative_to(repo["root"]):
        audit.add("error", "unsafe_predictions", record["id"], prediction.name)
        return [], None
    inspected = inspect_predictions(prediction, physical, operator, audit, record["id"]) if verify_predictions else None
    counted = inspected["count"] if inspected else None
    observed_n = integer(data.get("N")) if not physical else integer(data.get("n_valid_common"))
    corrected = data.get("divergence_corrected") or {} if physical else {}
    physical_rows = observed_n if data.get("valid_fraction_common") == 1 else None
    if physical and corrected.get("valid_fraction") == 1:
        physical_rows = integer(corrected.get("n_valid"))
    if scope is None and path.name.endswith("_eval.json"):
        scope = "full_domain" if counted and counted == case.get("rows") else None
    if scope is None and not physical and path.stem.endswith(tuple(repo.get("legacy_accuracy_suffixes", []))):
        scope = "test" if record["splitVersion"] == "v1" and observed_n == case.get("test_rows") else None
    if scope is None and physical and (counted or physical_rows) == case.get("rows") and case.get("rows") is not None:
        scope = "full_domain"
    if scope is None:
        audit.add("warning", "unknown_scope", record["id"], path.name)
    if operator is None:
        audit.add("warning", "unknown_operator", record["id"], path.name)
    if counted is not None and not physical and observed_n != counted:
        audit.add("error", "point_count_conflict", record["id"], path.name)
    units = case.get("units") or {}
    cohort = inspected["cohort"] if inspected else None

    def make(original, name, value, unit, definition, detail, lower):
        if value is not None and type(value) not in (int, float):
            audit.add("error", "invalid_metric", record["id"], original)
            return None
        known_unit = unit if unit in {"1", "%", "points"} else units.get(unit)
        points = counted if counted is not None else (physical_rows if physical else observed_n)
        return _metric(record, original, name, value, known_unit, definition, scope, operator,
                       parameters, points, detail, ref, lower)

    def mask(field, valid_count, fraction):
        proof, computed = inspected["masks"][field] if inspected else (None, None)
        if computed is not None and valid_count is not None and computed != valid_count:
            audit.add("error", "mask_count_conflict", record["id"], f"{path.name}:{field}")
        if not physical:
            policy = "all_evaluation_rows"
        elif operator == "local_least_squares_kdtree":
            policy = "common_finite_fields"
        else:
            policy = "finite_per_field"
        return {"policy": policy, "validCount": valid_count, "validFraction": fraction,
                "fingerprint": proof, "evaluationFingerprint": cohort}

    result = []
    if physical:
        for role, (key, field, definition) in FIELDS.items():
            bucket = data.get(key, {})
            if not isinstance(bucket, dict):
                audit.add("error", "invalid_metric_group", record["id"], key)
                continue
            valid_count = integer(bucket.get("n_valid"))
            fraction = bucket.get("valid_fraction")
            if ("n_valid" in bucket and valid_count is None) or (
                fraction is not None and (type(fraction) not in (int, float) or not 0 <= fraction <= 1)
            ):
                audit.add("error", "invalid_mask_summary", record["id"], key)
                continue
            detail = mask(field, valid_count, fraction)
            for stat, text in STATS.items():
                if stat in bucket:
                    unit = {"n_valid": "points", "valid_fraction": "1"}.get(stat, "divergence")
                    lower = None if stat == "mean_signed" else stat not in {"n_valid", "valid_fraction"}
                    result.append(make(f"{key}.{stat}", f"divergence_{role}_{stat}", bucket[stat], unit,
                                       f"{definition} {text}", detail, lower))
        for field in ("RER_divergence_rmse_vs_coarse", "RER_divergence_mae_vs_coarse",
                      "RER_divergence_rmse_vs_fine", "improvement_divergence_rmse_pct",
                      "improvement_divergence_mae_pct", "improvement_vs_fine_rmse_pct"):
            if field in data:
                pct = field.startswith("improvement")
                result.append(make(field, field.lower(), data[field], "%" if pct else "1",
                                   "Redução relativa da magnitude da divergência corrigida frente à magnitude de referência especificada pela chave.",
                                   None, False))
    else:
        detail = mask("accuracy", observed_n, 1.0 if observed_n is not None else None)
        for original, (name, definition, unit, lower) in ACCURACY.items():
            if original in data:
                result.append(make(original, name, data[original], unit, definition, detail, lower))
    if not result:
        audit.add("error", "empty_metric_file", record["id"], path.name)
    # Unknown scope may occur more than once in historical runs. Its source ID disambiguates it.
    result = [item for item in result if item is not None]
    if scope is None:
        for item in result:
            item["id"] += f":{ref['id']}"
    return result, {"scope": scope, "physical": physical, "prediction": prediction.name, "stem": path.stem}
