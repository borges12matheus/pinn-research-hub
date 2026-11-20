"""Coordinate discovery, normalization and selection for one offline import."""
from collections import Counter, defaultdict
from pathlib import Path
import re

from .comparability import assess_comparability, summarize_checks
from .discovery import discover
from .evaluations import evaluation, link_reevaluation, training_measurements
from .featured import filter_metrics, select_featured
from .figures import curate
from .metrics import extract_metrics, metric_scope
from .normalization import normalize, run_id
from .parsers import Audit, digest, read_json, resolve_input, token
from .predictions import pq
from .temporal import execution_time, iso_time, log_start
from .timeline import read_timeline
from .validation import check_public, index_by_id

PRIMARY = {"rmse_uv_corrected", "rmse_p_corrected", "divergence_corrected_rmse", "divergence_error_rmse"}


def color_scales(scales):
    result = {}
    if not isinstance(scales, dict):
        return result
    for key, value in scales.items():
        if key in {"absolute_common", "signed_common"} and isinstance(value, dict):
            low, high = value.get("vmin"), value.get("vmax")
        elif key in {"absolute_common", "signed_common", "error_common_abs_vmax"} and type(value) in (int, float):
            low, high = (0 if key == "absolute_common" else -value), value
        else:
            continue
        if type(low) in (int, float) and type(high) in (int, float) and low < high:
            result[key] = {"min": low, "max": high}
    return result


def _manifest_file(root, reference, audit, identifier):
    try:
        path = resolve_input(root, reference, container=True)
        if path.relative_to(root).parts[:2] != ("results", "metrics") or path.suffix != ".parquet":
            raise ValueError("manifest must use prediction files")
        if path.is_file():
            return path
        alternative = root / "results" / "metrics" / "old" / path.parent.name / path.name
        if alternative.is_file() and alternative.resolve().is_relative_to(root):
            audit.add("info", "archived_artifact", identifier, path.name)
            return alternative
        audit.add("warning", "missing_manifest_prediction", identifier, path.name)
    except ValueError:
        audit.add("error", "unsafe_manifest_path", identifier, "prediction outside the allowed tree")
    return None


def load_pairs(paths, phase, repo, audit):
    root = repo["root"]
    pairs = []
    controls = defaultdict(dict)
    control_refs = defaultdict(dict)
    for path in paths:
        stamp = path.stem.removeprefix("baseline_pair_manifest_")
        if not re.fullmatch(r"\d{8}_\d{6}", stamp):
            audit.add("error", "invalid_manifest_id", phase, path.name)
            continue
        identifier = f"cmp-{repo['id_prefix']}-{stamp.replace('_', '-')}"
        manifest = read_json(path, audit, identifier)
        if manifest is None:
            continue
        if manifest.get("timestamp") not in (None, stamp):
            audit.add("error", "manifest_timestamp_conflict", identifier, path.name)
        fairness_path = path.with_name(f"fairness_report_{stamp}.json")
        report_path = path.parent / "plots" / "comparison_report.json"
        if not all(p.resolve().is_relative_to(root) for p in (fairness_path, report_path)):
            audit.add("error", "unsafe_manifest_path", identifier, "report outside source repository")
            continue
        fairness = read_json(fairness_path, audit, identifier) or {}
        report = read_json(report_path, audit, identifier) or {}
        refs = [audit.record(phase, path, root, "pair_manifest")]
        for item, data, kind in ((fairness_path, fairness, "fairness_report"), (report_path, report, "comparison_report")):
            if data:
                refs.append(audit.record(phase, item, root, kind))
        members = {model: _manifest_file(root, manifest.get(f"{model}_predictions"), audit, identifier)
                   for model in ("mlp", "pinn")}
        if not all(members.values()):
            pairs.append({"id": identifier, "paths": members, "refs": refs, "report": report,
                          "valid": False, "folder": path.parent.name, "phase": phase})
            continue
        for model, prediction in members.items():
            name = prediction.parent.name
            check_values = {}
            checks = fairness.get("checks", [])
            if fairness.get("valid") is True and isinstance(checks, list):
                check_values = {item["field"]: item.get(f"{model}_value") for item in checks
                                if isinstance(item, dict) and token(item.get("field")) and item.get("status") in
                                {"ok", "match", "warning"}}
                if model == "pinn" and isinstance(fairness.get("pinn_physics"), dict):
                    check_values.update(fairness["pinn_physics"])
                if check_values:
                    ref = next(ref for ref in refs if ref["kind"] == "fairness_report")
                    control_refs[name][ref["id"]] = ref
            for key, value in check_values.items():
                previous = controls[name].setdefault(key, value)
                if previous != value:
                    audit.add("error", "historical_config_conflict", name, key)
        pairs.append({"id": identifier, "paths": members, "refs": refs, "report": report,
                      "valid": fairness.get("valid") is True, "folder": path.parent.name, "phase": phase})
    return pairs, controls, control_refs


def load_experiment(run, phase, repo, controls, control_refs, cases, audit, verify):
    root = repo["root"]
    metadata = read_json(run.metadata[0], audit, run.name) if run.metadata else {}
    record = normalize(run, phase, repo, metadata or {}, controls.get(run.name, {}), cases, audit)
    record["sourceRefs"].extend(control_refs.get(run.name, {}).values())
    metadata_ref = audit.record(phase, run.metadata[0], root, "training_metadata") if run.metadata and metadata else None
    if metadata_ref:
        record["sourceRefs"].append(metadata_ref)
        for field, key in (("dataset_path", "datasetHash"), ("split_path", "splitHash")):
            if record[key] and metadata.get(field):
                try:
                    path = resolve_input(root, metadata[field], container=True)
                    if not path.is_file():
                        audit.add("warning", "missing_historical_input", record["id"], field)
                    elif digest(path) != record[key]:
                        audit.add("warning", "historical_hash_differs", record["id"], field)
                except ValueError:
                    audit.add("warning", "unresolved_historical_input", record["id"], field)
    log_stamp, log_ref = None, None
    if not run.standalone:
        valid = [(stamp, path) for path in run.logs if (stamp := log_start(path))]
        if len({stamp for stamp, _ in valid}) > 1:
            audit.add("warning", "conflicting_log_timestamps", record["id"], "different training starts in original logs")
        elif valid:
            log_stamp, path = valid[0]
            metadata_stamp = iso_time((metadata or {}).get("start_time"))
            if not metadata_stamp or metadata_stamp[:19] != log_stamp[:19]:
                log_ref = audit.record(phase, path, root, "training_log")
                record["sourceRefs"].append(log_ref)
            if metadata_stamp and metadata_stamp[:19] != log_stamp[:19]:
                audit.add("warning", "conflicting_start_timestamps", record["id"], "metadata start differs from original log start")
    record["temporal"] = execution_time(run.name, metadata or {}, log_stamp, metadata_ref, log_ref, repo.get("execution_timezone"))
    for field in ("start_time", "end_time"):
        if (metadata or {}).get(field) is not None and not iso_time(metadata[field]):
            audit.add("warning", "invalid_training_timestamp", record["id"], field)
    if metadata_ref and token(metadata.get("run_id")):
        expected = run.name.rsplit("_", 2)[-2:]
        if metadata["run_id"].rsplit("_", 2)[-2:] != expected:
            audit.add("warning", "training_identity_timestamp_conflict", record["id"], "run metadata ID and folder differ")
    case = cases.get(record["dataset"], {})
    metrics = []
    evaluations = []
    metric_ids = set()
    align = {}
    for path in run.metrics:
        raw = read_json(path, audit, record["id"])
        if raw is not None:
            ref = audit.record(phase, path, root, "metric_json")
            record["sourceRefs"].append(ref)
            items, detail = extract_metrics(record, raw, path, ref, case, repo, audit, verify)
            for item in items:
                if item["id"] in metric_ids:
                    item["id"] += f":{ref['id']}"
                    audit.add("warning", "multiple_evaluations_same_scope", record["id"], item["originalName"])
                metric_ids.add(item["id"])
            if items:
                evaluations.append(evaluation(record, raw, ref, items, run.standalone))
                metrics.extend(items)
            if detail:
                align[detail["prediction"]] = detail
    record["evidenceStatus"] = "verified" if record["caseId"] and record["seed"] is not None and metrics else (
        "preliminary" if metrics or metadata else "unknown")
    record["_metrics"] = metrics
    record["_evaluations"] = evaluations
    record["_standalone"] = run.standalone
    record["_training"] = training_measurements(record, metadata, metadata_ref) if metadata_ref else (None, [])
    record["_originName"] = run.name
    artifacts = [*run.metadata, *run.metrics]
    record["_archived"] = bool(artifacts) and all("old" in path.relative_to(root).parts for path in artifacts)
    record["_predictionScopes"] = align
    return record


def compare_pair(pair, all_records, repo, audit):
    phase, identifier = pair["phase"], pair["id"]
    members = []
    scopes = []
    for path in pair["paths"].values():
        record = all_records.get(run_id(repo["id_prefix"], path.parent.name)) if path else None
        if record and record["id"] not in [item["id"] for item in members]:
            members.append(record)
            scopes.append(record["_predictionScopes"].get(path.name, {}).get("scope"))
    if len(members) != 2:
        audit.add("warning", "unresolved_comparison_members", identifier, "fewer than two distinct mapped runs")
    if len(members) == 2:
        seeds = [record["seed"] for record in members]
        match = re.search(r"_seed(\d+)_", pair["folder"])
        if match and any(seed is not None and seed != int(match[1]) for seed in seeds):
            audit.add("warning", "directory_seed_label_mismatch", identifier, "effective seeds come from historical records")
        if None not in seeds and seeds[0] != seeds[1]:
            audit.add("error", "inconsistent_pair_seed", identifier, "manifest members have different effective seeds")
    selected_scope = scopes[0] if len(scopes) == 2 and scopes[0] == scopes[1] else None
    checks = []
    if len(members) == 2:
        def eligible(record):
            candidates = defaultdict(list)
            for metric in record["_metrics"]:
                if metric["name"] in PRIMARY and metric["evaluationSet"] is not None:
                    candidates[(metric["evaluationSet"], metric["name"])].append(metric)
            return {key: items[0] for key, items in candidates.items() if len(items) == 1}
        left, right = map(eligible, members)
        for key in sorted(left.keys() & right.keys()):
            assessment = assess_comparability({**members[0], "evaluation": left[key]},
                                              {**members[1], "evaluation": right[key]})
            if not pair["valid"]:
                assessment.update(status="blocked", measurementCompatible=False)
                assessment["reasons"].append("fairness_report_unverified")
            checks.append({"scope": key[0], "metric": key[1], "unit": left[key]["unit"],
                           "operator": left[key]["calculationMethod"], "metricIds": [left[key]["id"], right[key]["id"]],
                           **assessment})
    reasons = sorted({reason for check in checks for reason in check["reasons"]})
    if not checks:
        reasons.append("no_shared_verified_metric_scope")
    report = pair["report"]
    return {
        "id": identifier, "phaseId": phase, "experimentIds": [member["id"] for member in members],
        "sourceRefs": pair["refs"], "manifestSource": pair["refs"][0], "sources": [],
        "protocol": {
            "fairnessRecorded": pair["valid"], "physicsScope": selected_scope,
            "plotHeight": report.get("h") if type(report.get("h")) in (int, float) else None,
            "plotPercentile": report.get("percentile") if type(report.get("percentile")) in (int, float) else None,
            "colorScales": color_scales(report.get("scales")),
            "pairFolder": pair["folder"],
        },
        "status": summarize_checks(checks), "conditions": checks, "limitations": reasons,
        "evidenceStatus": "verified" if pair["valid"] and len(members) == 2 else "preliminary",
        "visibility": "private", "figures": [], "updatedAt": None,
    }


def has_public_identity(run):
    return bool(all(token(run.get(key)) for key in ("phaseId", "caseId", "turbulenceModel", "runId", "modelFamily"))
                and run.get("reynolds") and type(run.get("seed")) is int and run["seed"] >= 0)


def build(config, public=False):
    audit = Audit()
    featured = config.get("selection") == "featured"
    if featured and public and not config.get("public_approvals", {}).get("timeline"):
        raise ValueError("featured collection is pending review and restricted to private staging")
    verify = pq is not None and config.get("verify_predictions", True)
    if not verify:
        audit.add("warning", "prediction_verification_unavailable", "import", "comparisons needing Parquet proof remain blocked")
    timeline = read_timeline(config, audit)
    found = []
    pair_rows = []
    cases = config.get("cases", {})
    for phase, repo in sorted(config["repositories"].items()):
        if not repo["root"].is_dir():
            audit.add("error", "missing_repository", phase, "configured root is unavailable")
            continue
        runs, paths = discover(repo["root"], phase, audit)
        pairs, controls, control_refs = load_pairs(paths, phase, repo, audit)
        pair_rows.extend(pairs)
        for run in runs:
            try:
                found.append(load_experiment(run, phase, repo, controls, control_refs, cases, audit, verify))
            except (ValueError, TypeError, AttributeError, KeyError):
                audit.add("error", "invalid_metadata_or_metrics", run.name, "unexpected structure")
    discovered_evaluations = sum(len(record["_evaluations"]) for record in found)
    archived = {record["id"] for record in found if record["_archived"] and not record["_standalone"]}
    standalone = [record for record in found if record["_standalone"]]
    all_records = index_by_id([record for record in found if not record["_standalone"]], audit, "experiments")
    lookup = defaultdict(set)
    for record in all_records.values():
        for name in (record["runId"], record["_originName"]):
            lookup[(record["phaseId"], name)].add(record["id"])
    origins = {key: next(iter(ids)) for key, ids in lookup.items() if len(ids) == 1}
    reevaluations = []
    for record in standalone:
        by_id = {metric["id"]: metric for metric in record["_metrics"]}
        for item in record["_evaluations"]:
            measures = [by_id[key] for key in item["metricIds"]]
            owner = link_reevaluation(item, measures, origins, audit)
            reevaluations.append((item, measures, owner))
    all_comparisons = index_by_id(
        [compare_pair(pair, all_records, config["repositories"][pair["phase"]], audit) for pair in pair_rows],
        audit, "comparisons",
    )
    discovered_comparisons = len(all_comparisons)
    index_by_id([metric for record in found for metric in record["_metrics"]], audit, "metrics")
    for event in timeline.values():
        for experiment_id in event["experimentIds"]:
            if experiment_id not in all_records:
                audit.add("error", "broken_experiment_link", event["id"], experiment_id)
    curated_ids = {identifier for event in timeline.values() for identifier in event["experimentIds"]}
    selection = set(all_records) if config.get("selection") == "all" else curated_ids
    if featured:
        selected_metrics, all_comparisons, timeline = select_featured(config, all_records, all_comparisons, timeline, audit)
        selection = set(selected_metrics)
        filter_metrics(selected_metrics, all_records, all_comparisons,
                       restrict_runs=not config.get("show_all_featured_metrics"))
    approvals = config.get("public_approvals", {})
    excluded_identity = set()
    if public:
        catalog = selection if featured else all_records.keys()
        selection = set(approvals.get("experiments", []))
        for identifier in sorted(selection - catalog):
            audit.add("error", "unknown_experiment_approval", identifier, "experiment could not be discovered")
        for identifier in sorted(set(approvals.get("timeline", [])) - timeline.keys()):
            audit.add("error", "unknown_timeline_approval", identifier, "event could not be discovered")

        excluded_identity = {key for key in selection & all_records.keys()
                             if not has_public_identity(all_records[key])}
        selection -= excluded_identity
        for identifier in sorted(excluded_identity):
            audit.add("warning", "public_identity_incomplete", identifier, "run retained in private catalog only")

    selected = {key: all_records[key] for key in sorted(selection & all_records.keys())}
    comparisons = {key: row for key, row in sorted(all_comparisons.items())
                   if len(row["experimentIds"]) == 2 and set(row["experimentIds"]) <= selected.keys()}
    if public:
        removed_pairs = {key for key, pair in all_comparisons.items() if excluded_identity.intersection(pair["experimentIds"])}
        approved_pairs = set(approvals.get("comparisons", [])) - removed_pairs
        for identifier in sorted(approved_pairs - comparisons.keys()):
            audit.add("error", "unpublishable_comparison", identifier, "comparison or approved member missing")
        comparisons = {key: row for key, row in comparisons.items() if key in approved_pairs}
        for identifier in sorted(set(approvals.get("training", [])) - selected.keys() - excluded_identity):
            audit.add("error", "unpublishable_training_history", identifier, "training history requires an approved run")
    events = []
    for event in timeline.values():
        if public and event["id"] not in approvals.get("timeline", []):
            continue
        if public and (excluded_identity.intersection(event["experimentIds"])
                       or removed_pairs.intersection(event.get("comparisonIds", []))):
            audit.add("warning", "event_with_incomplete_identity", event["id"], "dependent event retained in private catalog")
            continue
        if public and ((not featured and event["visibility"] != "public") or not set(event["experimentIds"]) <= selected.keys()):
            audit.add("error", "unpublishable_event", event["id"], "review visibility and linked experiment approvals")
            continue
        if public and not set(event.get("comparisonIds", [])) <= comparisons.keys():
            audit.add("error", "unpublishable_event", event["id"], "linked comparison requires public approval")
            continue
        if public and featured:
            event = {**event, "visibility": "public", "curationStatus": "approved"}
        events.append(event)
    if public:
        for record in selected.values():
            record["visibility"] = "public"
            if not record["_metrics"]:
                audit.add("error", "unpublishable_experiment", record["id"], "no metric artifacts")
        for record in comparisons.values():
            record["visibility"] = "public"
    else:
        for event in events:
            event["visibility"] = "private"

    if excluded_identity:
        removed_figures = {item["id"] for item in config.get("figures", [])
                           if item.get("experiment_id") in excluded_identity or item.get("comparison_id") in removed_pairs}
        config = {**config, "public_approvals": {**approvals, "figures": [
            identifier for identifier in approvals.get("figures", []) if identifier not in removed_figures
        ]}}
    figures = curate(config, selected, comparisons, public, audit)
    metrics, evaluations, history = [], [], []
    for record in selected.values():
        training, training_metrics = record.pop("_training")
        publish_training = record["id"] in approvals.get("training", [])
        if training and (not public or publish_training):
            training["visibility"] = record["visibility"]
            history.append(training)
            record["_metrics"].extend(training_metrics)
        elif public and publish_training:
            audit.add("error", "unpublishable_training_history", record["id"], "training metadata missing")
        elif public:
            record.pop("trainingHardware", None)
            record.pop("executedEpochs", None)
        metric_ids = {metric["id"] for metric in record["_metrics"]}
        for item in record.pop("_evaluations"):
            item.pop("_trainingRunId")
            item.pop("_checkpointParent")
            item["visibility"] = record["visibility"]
            item["metricIds"] = [key for key in item["metricIds"] if key in metric_ids]
            if item["metricIds"]:
                evaluations.append(item)
        record.pop("_originName")
        record.pop("_standalone")
        record.pop("_archived")
        record["curationStatus"] = (
            "pending_review" if featured and not public else "archived" if record["id"] in archived else "supporting" if public else "staged"
        )
        for metric in record.pop("_metrics"):
            metric["visibility"] = record["visibility"]
            record["metrics"].append(metric["id"])
            metrics.append(metric)
        record.pop("_predictionScopes")
    if not public:
        for item, measures, owner in reevaluations:
            if owner in selected or (owner is None and config.get("selection") == "all"):
                if owner:
                    selected[owner]["metrics"].extend(item["metricIds"])
                metrics.extend(measures)
                evaluations.append(item)
    for record in comparisons.values():
        record["protocol"].pop("pairFolder", None)
        if featured:
            record["curationStatus"] = "approved" if public else "pending_review"

    payloads = {
        "experiments": list(selected.values()), "metrics": sorted(metrics, key=lambda metric: metric["id"]),
        "comparisons": list(comparisons.values()), "timeline": events,
        "evaluations": sorted(evaluations, key=lambda item: item["id"]),
        "training": sorted(history, key=lambda item: item["id"]),
    }
    try:
        check_public(payloads)
    except ValueError as error:
        audit.add("error", "private_or_invalid_output", "export", str(error))
    counts = {
        "discoveredExperiments": len(all_records), "canonicalRuns": len(all_records),
        "standaloneDirectories": len(standalone), "discoveredReevaluations": len(reevaluations),
        "selectedEvaluations": len(evaluations), "discoveredEvaluations": discovered_evaluations,
        "duplicateArtifacts": sum(issue["code"].startswith("archived_duplicate") for issue in audit.issues),
        "runsByFamily": dict(Counter(record["modelFamily"] for record in all_records.values())),
        "runsByPhase": dict(Counter(record["phaseId"] for record in all_records.values())),
        "executionTimeConfidence": dict(Counter(record["temporal"]["executedAtConfidence"] for record in all_records.values())),
        "selectedExecutionTimeConfidence": dict(Counter(record["temporal"]["executedAtConfidence"] for record in selected.values())),
        "publishedRuns": len(selected) if public else 0,
        "pendingRuns": len(all_records) - (len(selected) if public else 0), "archivedRuns": len(archived), "discoveredComparisons": discovered_comparisons,
        "selectedExperiments": len(selected), "selectedComparisons": len(comparisons),
        "selectedMetrics": len(metrics), "selectedTimelineEvents": len(events), "selectedFigures": len(figures),
        **{f"{label}Comparisons": sum(row["status"] == state for row in comparisons.values())
           for state, label in (("compatible", "compatible"), ("descriptive_only", "descriptiveOnly"), ("blocked", "blocked"))},
    }
    for row in comparisons.values():
        audit.add("info" if row["status"] == "compatible" else "warning", "comparison_" + row["status"],
                  row["id"], ", ".join(row["limitations"]) or "measurement checks matched")
    return payloads, figures, audit, counts
