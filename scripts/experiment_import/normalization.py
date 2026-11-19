"""Normalize execution metadata without filling gaps from mutable training YAMLs."""
from datetime import date
import re

from .parsers import token

HASH = re.compile(r"[a-f0-9]{64}\Z")


def hash_value(value):
    return value if isinstance(value, str) and HASH.fullmatch(value) else None


def integer(value):
    return value if type(value) is int and value >= 0 else None


def scalar(value):
    if type(value) in (int, float):
        return value
    return token(value)


def run_id(prefix, name):
    return f"exp-{prefix}-{name.replace('_', '-')}"


def timestamp_date(value):
    try:
        return date.fromisoformat(value[:10]).isoformat()
    except (TypeError, ValueError):
        return None


def _choose(actual, recorded, audit, subject, field):
    if actual is not None and recorded is not None and actual != recorded:
        audit.add("error", "metadata_conflict", subject, field)
    return actual if actual is not None else recorded


def normalize(run, phase, repo, metadata, paired, cases, audit):
    subject = run_id(repo["id_prefix"], run.name)
    config = metadata.get("config") or {}
    exp = config.get("experiment") or {}
    fit = config.get("training") or {}
    pinn = config.get("pinn") or {}
    network = config.get("model") or {}
    dataset = (config.get("dataset") or {}).get("parquet") or metadata.get("dataset_path")
    if isinstance(dataset, str):
        dataset = token(dataset.split("/")[-1])
    dataset = _choose(dataset, token(paired.get("dataset.parquet")), audit, subject, "dataset")
    dataset_hash = _choose(hash_value(metadata.get("dataset_hash")), hash_value(paired.get("dataset_sha256")),
                           audit, subject, "datasetHash")
    seed = _choose(integer(exp.get("seed")), integer(metadata.get("seed")), audit, subject, "seed")
    seed = _choose(seed, integer(paired.get("seed")), audit, subject, "seed")
    for path in run.metrics:
        match = re.search(r"_seed(\d+)(?:_|\.)", path.name)
        if match and seed is not None and int(match[1]) != seed:
            audit.add("error", "inconsistent_seed", subject, path.name)
    if seed is None:
        audit.add("warning", "unconfirmed_seed", subject, "no run metadata or historical fairness seed")

    split = config.get("split") or {}
    version = _choose(token(split.get("version")), token(paired.get("split.version")), audit, subject, "split version")
    method = token(metadata.get("split_method"))
    if method:
        match = re.search(r"_(v\d+)$", method)
        if match:
            version = _choose(version, match[1], audit, subject, "split version")
    elif version and (split.get("strategy") or paired.get("split.strategy")) == "spatial_x_quantile":
        column = token(split.get("column") or paired.get("split.column"))
        if column:
            method = f"spatial_x_quantile_{column}_{version}"
    split_hash = hash_value(metadata.get("split_hash"))
    case = cases.get(dataset) or {}
    turbulence = _choose(token(exp.get("type") or metadata.get("experiment_type")),
                         token(paired.get("experiment.type")), audit, subject, "turbulence")
    turbulence = _choose(turbulence, case.get("turbulence"), audit, subject, "case turbulence")
    model_family = next((model for prefix, model in (
        ("mlp_", "MLP"), ("pinn_cont_mom_", "PINN-cont-mom"), ("pinn_mom_", "PINN-mom"),
        ("pinn_cont_", "PINN-cont"),
    ) if run.name.removeprefix("eval-").startswith(prefix)), None)

    def columns(value):
        return value if isinstance(value, list) and value and all(token(column) for column in value) else None

    features = _choose(columns(config.get("features")), columns(paired.get("features")), audit, subject, "features")
    supervised = _choose(scalar(metadata.get("supervised_frac")), scalar(fit.get("supervised_frac")),
                         audit, subject, "supervised fraction")
    if supervised is not None and (type(supervised) not in (int, float) or not 0 < supervised <= 1):
        audit.add("error", "invalid_supervision", subject, "expected a fraction in (0, 1]")
        supervised = None
    optimizer_controls = {
        "batchSize": scalar(fit.get("batch_size", paired.get("training.batch_size"))),
        "learningRate": scalar(fit.get("lr", paired.get("training.lr"))),
        "weightDecay": scalar(fit.get("weight_decay", paired.get("training.weight_decay"))),
        "earlyStoppingPatience": scalar((config.get("early_stopping") or {}).get("patience", paired.get("early_stopping.patience"))),
        "schedulerPatience": scalar((config.get("scheduler") or {}).get("patience", paired.get("scheduler.patience"))),
        "schedulerFactor": scalar((config.get("scheduler") or {}).get("factor", paired.get("scheduler.factor"))),
    }
    training = {
        **optimizer_controls,
        "supervisedFraction": supervised,
        "supervisedPoints": integer(metadata.get("n_supervised")),
        "physicsPoints": integer(metadata.get("n_physics")),
        "supervisedEpochLimit": integer(pinn.get("epochs_pre", fit.get("epochs"))) or integer(paired.get("supervised_epochs")),
        "physicsEpochLimit": integer(pinn.get("epochs_phys", paired.get("pinn.epochs_phys"))),
        "physicsMode": token(pinn.get("physics_mode", paired.get("pinn.physics_mode"))),
        "wallTimeSeconds": metadata.get("wall_time_sec") if type(metadata.get("wall_time_sec")) in (int, float) else None,
        "cpuTimeSeconds": metadata.get("cpu_time_sec") if type(metadata.get("cpu_time_sec")) in (int, float) else None,
        "lossWeights": {key: scalar(pinn.get(key, paired.get(f"pinn.{key}")))
                        for key in ("w_data", "w_cont", "w_mom")},
    }
    architecture = {key: scalar(network.get(key, paired.get(f"model.{key}"))) for key in ("width", "depth", "activation")}
    return {
        "id": subject,
        "runId": token(metadata.get("run_id")) or run.name,
        "phaseId": phase,
        "model": model_family,
        "modelFamily": model_family,
        "caseId": case.get("id"),
        "dataset": dataset,
        "reynolds": case.get("reynolds"),
        "turbulenceModel": turbulence,
        "referenceType": "fine_rans" if case else None,
        "seed": seed,
        "splitId": split_hash,
        "splitHash": split_hash,
        "splitMethod": method,
        "splitVersion": version,
        "datasetHash": dataset_hash,
        "configHash": hash_value(metadata.get("config_hash")),
        "commitSha": None,
        "configurationPath": None,
        "features": features,
        "targets": columns(config.get("targets")) or columns(paired.get("targets")),
        "architecture": architecture,
        "trainingBudget": training,
        "normalization": case.get("normalization"),
        "evidenceStatus": "unknown",
        "curationStatus": "discovered",
        "visibility": "private",
        "date": timestamp_date(metadata.get("start_time")),
        "updatedAt": timestamp_date(metadata.get("end_time")),
        "sourceRefs": [],
        "sources": [],
        "metrics": [],
        "figures": [],
    }
