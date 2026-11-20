#!/usr/bin/env python3
"""CLI for the PINN Research Hub experimental import."""
import sys

# scan and dry-run must not leave Python bytecode or staging files.
sys.dont_write_bytecode = True

import argparse
from hashlib import sha256
import json
from pathlib import Path

import yaml

from experiment_import.configuration import load_config
from experiment_import.exporter import export, json_bytes, report_files, write_reports
from experiment_import.featured import curation_report
from experiment_import.pipeline import build
from experiment_import.validation import HUB, overlaps, validate_paths


def arguments(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    subcommands = parser.add_subparsers(dest="command", required=True)
    for command in ("scan", "validate", "export"):
        subparser = subcommands.add_parser(command)
        subparser.add_argument("--config", type=Path, default=HUB / "config/experiment_import.yaml")
        subparser.add_argument("--output", type=Path)
        if command == "export":
            subparser.add_argument("--dry-run", action="store_true")
            subparser.add_argument("--public", action="store_true")
    return parser.parse_args(argv)


def main(argv=None):
    args = arguments(argv)
    public = getattr(args, "public", False)
    dry_run = getattr(args, "dry_run", False)
    try:
        config = load_config(args.config.resolve())
        output = (args.output or config["public_output" if public else "staging_output"]).resolve()
        roots = [repo["root"] for repo in config["repositories"].values()]
        staging_area = (HUB / ".experiment-import").resolve()
        validate_paths(output, config["public_output"], staging_area, roots, public)
        reports = config["public_reports"] if public else output / "reports"
        if public and output != config["public_output"]:
            reports /= sha256(str(output).encode()).hexdigest()[:16]
        if reports.resolve() != reports or any(overlaps(reports, root) for root in [*roots, config["public_output"], HUB / "public"]):
            raise ValueError("report output overlaps protected inputs or public paths")
        if reports.is_relative_to(HUB) and not reports.is_relative_to(staging_area):
            raise ValueError("audit reports inside the Hub must stay under .experiment-import")
        if public and overlaps(output, reports):
            raise ValueError("audit report directory overlaps the public output")

        data, figures, audit, counts = build(config, public)
        report = report_files(audit, counts, public)
        if config.get("selection") == "featured" and not public:
            report["curation_summary.md"] = curation_report(config, data)
        if args.command == "scan":
            print(json_bytes({"counts": counts, "issues": audit.issues}).decode(), end="")
        elif args.command == "validate":
            write_reports(reports, report)
            print(f"Validação: {counts['discoveredExperiments']} execuções, {len(audit.issues)} ocorrências.")
        elif audit.has_errors:
            if not dry_run:
                write_reports(reports, report)
            print(report["import_report.json"].decode(), file=sys.stderr, end="")
        else:
            files = {f"data/{key}.json": json_bytes(value) for key, value in data.items()}
            files.update(figures)
            if public and not any(data.values()) and not any(
                (reports / filename).is_file() for filename in ("managed.json", "pending.json")
            ):
                raise ValueError("public export needs at least one approved record")
            stale = export(output, reports, files, report, dry_run)
            summary = {"dryRun": dry_run, "target": "public" if public else "staging",
                       "counts": counts, "outputs": sorted(files), "remove": stale}
            print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
        return 1 if audit.has_errors else 0
    except (OSError, ValueError, TypeError, KeyError, AttributeError, yaml.YAMLError) as error:
        print(f"Importação interrompida: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
