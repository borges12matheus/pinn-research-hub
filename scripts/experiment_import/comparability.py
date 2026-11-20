"""Separate reproducible measurement comparisons from experimental attribution."""


def assess_comparability(experiment_a, experiment_b):
    """Assess two experiment records with one normalized metric each in 'evaluation'."""
    a, b = experiment_a, experiment_b
    measurements = []
    limitations = []
    left, right = a.get("evaluation") or {}, b.get("evaluation") or {}

    def require(label, first, second):
        if first is None or second is None:
            measurements.append(f"{label}_unverified")
        elif first != second:
            measurements.append(f"{label}_mismatch")

    for key in ("phaseId", "caseId", "reynolds", "turbulenceModel", "referenceType", "datasetHash", "normalization"):
        require(key, a.get(key), b.get(key))
    if a.get("referenceType") != "fine_rans" or b.get("referenceType") != "fine_rans":
        measurements.append("unsupported_reference")
    if left.get("evaluationSet") == "test" or right.get("evaluationSet") == "test":
        require("splitVersion", a.get("splitVersion"), b.get("splitVersion"))
        if a.get("splitHash") and b.get("splitHash"):
            require("splitHash", a["splitHash"], b["splitHash"])
    for key in ("name", "definition", "evaluationSet", "calculationMethod", "operatorParameters", "unit", "pointCount"):
        require(key, left.get(key), right.get(key))
    if left.get("value") is None or right.get("value") is None:
        measurements.append("metric_value_unavailable")
    if left.get("calculationMethod") == "local_least_squares_kdtree":
        require("neighbors", (left.get("operatorParameters") or {}).get("neighbors"),
                (right.get("operatorParameters") or {}).get("neighbors"))
    if left.get("calculationMethod") == "etl_grid_differences_plus_autograd":
        require("edgeOrder", (left.get("operatorParameters") or {}).get("edgeOrder"),
                (right.get("operatorParameters") or {}).get("edgeOrder"))
    mask_a, mask_b = left.get("validityMask") or {}, right.get("validityMask") or {}
    for key in ("evaluationFingerprint", "policy", "validCount", "fingerprint"):
        require(key, mask_a.get(key), mask_b.get(key))

    for key in ("seed", "features", "targets", "architecture"):
        first, second = a.get(key), b.get(key)
        if first is None or second is None or (isinstance(first, dict) and (None in first.values() or None in second.values())):
            limitations.append(f"{key}_unverified")
        elif first != second:
            limitations.append(f"{key}_differs")
    budget_a, budget_b = a.get("trainingBudget") or {}, b.get("trainingBudget") or {}
    for key in ("supervisedFraction", "supervisedEpochLimit", "batchSize", "learningRate", "weightDecay",
                "earlyStoppingPatience", "schedulerPatience", "schedulerFactor"):
        first, second = budget_a.get(key), budget_b.get(key)
        if first is None or second is None:
            limitations.append(f"{key}_unverified")
        elif first != second:
            limitations.append(f"{key}_differs")
    if budget_a.get("physicsEpochLimit") != budget_b.get("physicsEpochLimit"):
        limitations.append("physics_budget_differs")
    if budget_a.get("lossWeights") != budget_b.get("lossWeights"):
        limitations.append("loss_weights_differ")
    if any(0 < (budget.get("supervisedFraction") or 0) < 1 for budget in (budget_a, budget_b)):
        limitations.append("supervised_subset_identity_unverified")
    status = "blocked" if measurements else "descriptive_only" if limitations else "compatible"
    return {"status": status, "measurementCompatible": not measurements,
            "causalAttribution": False, "reasons": [*measurements, *limitations]}


def summarize_checks(checks):
    states = {check["status"] for check in checks}
    if not states or states == {"blocked"}:
        return "blocked"
    if states == {"compatible"}:
        return "compatible"
    return "descriptive_only"
