"""Keep measurement artifacts and training observations attached to their own sources."""
from pathlib import PurePosixPath

from .normalization import integer
from .parsers import token
from .temporal import iso_time

TRAINING_COLUMNS = ("loss_train", "loss_val", "loss_total", "loss_data", "loss_cont", "loss_mom",
                    "val_score", "val_data", "val_cont", "val_mom", "lr", "best_val")


def evaluation(record, raw, ref, metrics, standalone):
    identifier = f"evaluation-{record['id']}:{ref['id']}"
    owner = None if standalone else record["id"]
    for metric in metrics:
        metric.update(evaluationId=identifier, experimentId=owner)
    return {
        "id": identifier, "experimentId": owner, "phaseId": record["phaseId"],
        "evaluatedAt": iso_time(raw.get("evaluated_at")),
        "scope": metrics[0]["evaluationSet"],
        "operator": metrics[0]["calculationMethod"],
        "kind": "reevaluation" if standalone else "evaluation",
        "metricIds": [metric["id"] for metric in metrics], "sourceRefs": [ref],
        "visibility": record["visibility"], "evidenceStatus": metrics[0]["evidenceStatus"],
        "_trainingRunId": token(raw.get("training_run_id")) if standalone else None,
        "_checkpointParent": checkpoint_parent(raw) if standalone else None,
    }


def checkpoint_parent(raw):
    value = raw.get("checkpoint_path")
    if not isinstance(value, str):
        return None
    parts = PurePosixPath(value.removeprefix("/app/")).parts
    return token(parts[-2]) if parts[:2] == ("results", "models") and len(parts) >= 5 and ".." not in parts else None


def link_reevaluation(item, metrics, lookup, audit):
    names = [item.pop(key) for key in ("_trainingRunId", "_checkpointParent")]
    owners = {lookup.get((item["phaseId"], name)) for name in names if name}
    if len(owners) == 1 and None not in owners:
        owner, = owners
        item["experimentId"] = owner
        for metric in metrics:
            metric["experimentId"] = owner
        return owner
    audit.add("warning", "reevaluation_origin_unverified", item["id"], "original training run could not be confirmed")
    return None


def training_measurements(record, metadata, ref):
    budget = record["trainingBudget"]
    hardware = metadata.get("hardware")
    hardware_keys = ("processor", "cpu_count_logical", "cpu_count_physical", "ram_total_gb",
                     "torch_version", "cuda_version", "gpu_name", "gpu_count", "gpu_memory_gb")
    if isinstance(hardware, dict):
        record["trainingHardware"] = {key: value for key in hardware_keys if
                                      type(value := hardware.get(key)) in (str, float, int)}
    history = metadata.get("training_history")
    points = []
    stages = {}
    for row in history if isinstance(history, list) else []:
        if not isinstance(row, dict) or integer(row.get("epoch")) is None:
            continue
        stage = row.get("stage")
        if not isinstance(stage, str) or not stage or any(mark in stage for mark in ("/", "\\")):
            continue
        values = {key: row[key] for key in TRAINING_COLUMNS if type(row.get(key)) in (int, float)}
        points.append({"stage": stage, "epoch": row["epoch"], "values": values})
        stages.setdefault(stage, set()).add(row["epoch"])
    record["executedEpochs"] = {stage: len(epochs) for stage, epochs in stages.items()}
    fields = [
        ("wall_time_sec", budget["wallTimeSeconds"], "s", "Tempo decorrido registrado pelo treino."),
        ("cpu_time_sec", budget["cpuTimeSeconds"], "s", "Tempo de CPU registrado pelo treino."),
        ("final_metrics.best_val", (metadata.get("final_metrics") or {}).get("best_val"), None,
         "Melhor valor de seleção registrado pelo treinamento, conforme a função de validação da execução."),
    ]
    fields.extend((f"training_history.{stage}.epochs", len(epochs), "epochs",
                   "Épocas distintas registradas no histórico desta etapa.") for stage, epochs in stages.items())
    identifier = f"training-{record['id']}"
    metrics = [{
        "id": f"{record['id']}:training:{i}", "experimentId": record["id"], "trainingId": identifier,
        "originalName": key, "name": key.replace("[", "-").replace("]", ""), "value": value, "unit": unit,
        "definition": definition, "category": "training", "evaluationSet": None,
        "referenceType": None, "calculationMethod": "training_log", "pointCount": None, "validityMask": None,
        "source": ref, "lowerIsBetter": None, "visibility": record["visibility"], "evidenceStatus": "verified",
    } for i, (key, value, unit, definition) in enumerate(fields) if type(value) in (int, float)]
    return {"id": identifier, "experimentId": record["id"], "points": points, "sourceRefs": [ref],
            "visibility": record["visibility"], "evidenceStatus": "verified"}, metrics
