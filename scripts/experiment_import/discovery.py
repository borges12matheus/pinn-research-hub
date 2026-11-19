"""Discover independent runs, paired manifests and incomplete comparisons."""
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
import re

from .parsers import digest, token


@dataclass
class Run:
    name: str
    metrics: list[Path]
    metadata: list[Path]
    standalone: bool = False


def inside(root, paths):
    return sorted(path for path in paths if path.is_file() and path.resolve().is_relative_to(root))


def discover(root, phase, audit):
    discovered = {}
    for file in inside(root, root.glob("results/metrics/**/*.json")):
        if file.parent == root / "results/metrics" or not token(file.parent.name):
            audit.add("warning", "unassigned_metric", phase, file.name)
            continue
        standalone = "standalone" in file.relative_to(root).parts
        name = f"eval-{file.parent.name}" if standalone else file.parent.name
        run = discovered.setdefault(name, Run(name, [], [], standalone))
        if run.metrics and run.metrics[0].parent != file.parent:
            audit.add("error", "duplicate_id", name, "multiple metric directories")
            continue
        run.metrics.append(file)

    metadata = defaultdict(list)
    for file in inside(root, root.glob("logs/**/*.json")):
        if re.search(r"_\d{8}_\d{6}$", file.parent.name):
            metadata[file.parent.name].append(file)
    for name, files in metadata.items():
        run = discovered.setdefault(name, Run(name, [], []))
        run.metadata.extend(files)
        if len(files) > 1:
            audit.add("error", "duplicate_metadata", name, "multiple training metadata JSON files")
        if not run.metrics:
            audit.add("warning", "missing_metrics", name, "training metadata without metric artifacts")

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
