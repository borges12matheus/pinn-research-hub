"""Discover independent runs, paired manifests and incomplete comparisons."""
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
import re

from .parsers import digest, token


@dataclass
class Run:
    name: str
    metrics: list[Path]
    metadata: list[Path]
    standalone: bool = False
    logs: list[Path] = field(default_factory=list)


def inside(root, paths):
    return sorted(path for path in paths if path.is_file() and path.resolve().is_relative_to(root))


def discover(root, phase, audit):
    discovered = {}
    artifacts = {}
    metric_paths = inside(root, root.glob("results/metrics/**/*.json"))
    for file in sorted(metric_paths, key=lambda item: ("old" in item.relative_to(root).parts, item)):
        if file.parent == root / "results/metrics" or not token(file.parent.name):
            audit.add("warning", "unassigned_metric", phase, file.name)
            continue
        standalone = "standalone" in file.relative_to(root).parts
        name = f"eval-{file.parent.name}" if standalone else file.parent.name
        run = discovered.setdefault(name, Run(name, [], [], standalone))
        key = (name, file.name)
        previous = artifacts.get(key)
        if previous is not None:
            if digest(previous) == digest(file):
                audit.add("info", "archived_duplicate_metric", name, file.name)
                continue
            audit.add("warning", "parallel_evaluation_source", name, file.name)
        else:
            artifacts[key] = file
        run.metrics.append(file)

    for file in inside(root, root.glob("logs/**/*.json")):
        if re.search(r"_\d{8}_\d{6}$", file.parent.name) and "standalone" not in file.relative_to(root).parts:
            run = discovered.setdefault(file.parent.name, Run(file.parent.name, [], []))
            if not run.metadata:
                run.metadata.append(file)
            elif digest(run.metadata[0]) == digest(file):
                audit.add("info", "archived_duplicate_metadata", run.name, file.name)
            else:
                audit.add("error", "duplicate_metadata", run.name, "conflicting training metadata JSON")
    logs = defaultdict(list)
    for file in inside(root, root.glob("logs/**/*.log")):
        if "standalone" not in file.relative_to(root).parts:
            logs[file.parent.name].append(file)
    for run in discovered.values():
        run.logs = logs.get(run.name, [])
        if not run.metrics:
            audit.add("warning", "missing_metrics", run.name, "training metadata without metric artifacts")

    manifests = {}
    for file in inside(root, root.glob("results/comparisons/**/baseline_pair_manifest_*.json")):
        previous = manifests.get(file.name)
        if previous is None:
            manifests[file.name] = file
        elif digest(previous) != digest(file):
            audit.add("error", "duplicate_id", phase, file.name)
        else:
            audit.add("info", "archived_duplicate", phase, file.name)

    manifest_dirs = {file.parent for file in manifests.values()}
    for file in inside(root, root.glob("results/comparisons/**/fairness_report_*.json")):
        if file.parent not in manifest_dirs and not list(file.parent.glob("baseline_pair_manifest_*.json")):
            audit.add("warning", "incomplete_comparison", phase, file.name)

    return [discovered[key] for key in sorted(discovered)], list(manifests.values())
