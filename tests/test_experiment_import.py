import copy
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zlib

sys.dont_write_bytecode = True
HUB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HUB / "scripts"))

from experiment_import.comparability import assess_comparability
from experiment_import import exporter
from experiment_import.exporter import export, json_bytes
from experiment_import.featured import filter_metrics, select_featured
from experiment_import.parsers import Audit, public_url
from experiment_import.pipeline import color_scales
from experiment_import.predictions import REFERENCE, inspect_predictions, pa, pq
from experiment_import.validation import check_public


def chunk(kind, data):
    return (struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data)))


def png():
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 0, 0, 0, 0))
        + chunk(b"tEXt", b"Comment\0/home/researcher/private")
        + chunk(b"IDAT", zlib.compress(b"\x00\x02"))
        + chunk(b"IEND", b"")
    )


class ComparabilityTest(unittest.TestCase):
    def setUp(self):
        self.experiment = {
            "phaseId": "phase-1", "caseId": "ke", "reynolds": [36000],
            "turbulenceModel": "k_epsilon", "referenceType": "fine_rans",
            "datasetHash": "dataset-a", "normalization": "native",
            "splitHash": "split-a", "splitVersion": "v2", "seed": 42,
            "features": ["x", "y"], "targets": ["du"], "architecture": {"width": 64},
            "trainingBudget": {"supervisedFraction": 1, "supervisedEpochLimit": 2000, "batchSize": 4096,
                               "learningRate": 0.001, "weightDecay": 0, "earlyStoppingPatience": 20,
                               "schedulerPatience": 10, "schedulerFactor": 0.5},
            "evaluation": {
                "name": "divergence_corrected_rmse", "definition": "RMS relative to zero",
                "evaluationSet": "test", "calculationMethod": "local_least_squares_kdtree",
                "operatorParameters": {"neighbors": 12}, "unit": "s⁻¹", "value": 3, "pointCount": 10,
                "validityMask": {"evaluationFingerprint": "table", "policy": "shared",
                                 "validCount": 9, "fingerprint": "mask"},
            }
        }

    def compare(self, modified):
        return assess_comparability(self.experiment, modified)

    def test_qualified_results(self):
        other = copy.deepcopy(self.experiment)
        self.assertEqual(self.compare(other)["status"], "compatible")
        other["features"] = ["x", "y", "nut"]
        status = self.compare(other)
        self.assertEqual(status["status"], "descriptive_only")
        self.assertTrue(status["measurementCompatible"])
        self.assertFalse(status["causalAttribution"])

    def test_incompatible_method_scope_split_units_phase_and_mask(self):
        edits = [
            ("calculationMethod", "openfoam_plus_autograd", "calculationMethod_mismatch"),
            ("operatorParameters", {"neighbors": 9}, "neighbors_mismatch"),
            ("evaluationSet", "full_domain", "evaluationSet_mismatch"),
            ("unit", None, "unit_unverified"),
            ("name", "divergence_error_rmse", "name_mismatch"),
        ]
        for key, value, reason in edits:
            with self.subTest(key=key):
                other = copy.deepcopy(self.experiment)
                other["evaluation"][key] = value
                result = self.compare(other)
                self.assertEqual(result["status"], "blocked")
                self.assertIn(reason, result["reasons"])
        for key, value in (("splitVersion", "v1"), ("phaseId", "phase-2"), ("seed", 123)):
            with self.subTest(key=key):
                other = copy.deepcopy(self.experiment)
                other[key] = value
                self.assertEqual(self.compare(other)["status"], "descriptive_only" if key == "seed" else "blocked")
        other = copy.deepcopy(self.experiment)
        other["evaluation"]["validityMask"]["fingerprint"] = "different mask"
        self.assertEqual(self.compare(other)["status"], "blocked")

    @unittest.skipIf(pq is None, "PyArrow is optional")
    def test_parquet_projection_distinguishes_masks_with_same_count(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "data.parquet"
            identity = {field: [1.0, 2.0] for field in REFERENCE}
            data = {**identity, "div_u": [0.1, 0.2], "div_u_f": [0.1, 0.2],
                    "div_delta_pred": [0.3, 0.4], "div_corrected": [0.4, None],
                    "div_error_vs_fine": [0.3, None]}
            pq.write_table(pa.table(data), path)
            first = inspect_predictions(path, True, "openfoam_plus_autograd", Audit(), "one")
            data["div_corrected"] = [None, 0.6]
            data["div_error_vs_fine"] = [None, 0.4]
            pq.write_table(pa.table(data), path)
            second = inspect_predictions(path, True, "openfoam_plus_autograd", Audit(), "two")
            self.assertEqual(first["cohort"], second["cohort"])
            a, b = first["masks"]["div_corrected"], second["masks"]["div_corrected"]
            self.assertEqual(a[1], b[1])
            self.assertNotEqual(a[0], b[0])


class PipelineTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.lab = self.root / "lab"
        self.stage = self.root / "staging"
        self.public = self.root / "site"
        self.config_path = self.root / "experiment_import.yaml"
        self.name = "mlp_base_20261113_212943"
        self.identifier = "exp-ke-" + self.name.replace("_", "-")
        self.metric = f"results/metrics/mlp/{self.name}/mlp_base_d4_w64_seed42_test.json"
        self.metadata = f"logs/mlp/{self.name}/training.json"
        self.dataset = "dataset_bfs.parquet"
        self.write(self.lab / self.metric, {
            "N": 2, "rmse_uv_corrected_to_fine": 1.25, "rmse_p_corrected_to_fine": 1.4,
        })
        self.write(self.lab / self.metadata, {
            "run_id": self.name,
            "config": {"experiment": {"seed": 42, "type": "k_epsilon"},
                       "dataset": {"parquet": self.dataset}, "features": ["x", "y"], "split": {"version": "v2"}},
        })
        self.event = {
            "id": "evt-test", "date": "2026-11-13", "category": "experiment",
            "title": {"pt": "Experimento"}, "summary": {"pt": "Teste local"},
            "evidenceStatus": "verified", "visibility": "private", "sources": [],
            "experimentIds": [self.identifier],
        }
        self.write(self.root / "timeline.json", [self.event])
        self.config = {
            "staging_output": "staging", "public_output": "site", "public_reports": "public-audit",
            "timeline": "timeline.json", "selection": "timeline", "verify_predictions": False,
            "repositories": {"phase-one": {"root": "lab", "id_prefix": "ke", "figure_directory": "phase_01"}},
            "cases": {self.dataset: {"id": "bfs", "turbulence": "k_epsilon", "rows": 10, "test_rows": 2,
                                     "reynolds": [36000], "normalization": "native", "units": {"velocity": "m/s"}}},
        }

    @staticmethod
    def write(path, data):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data), encoding="utf-8")

    def cli(self, *options, expected=0):
        self.write(self.config_path, self.config)
        process = subprocess.run(
            [sys.executable, str(HUB / "scripts/import_experiments.py"), *options, "--config", str(self.config_path)],
            cwd=self.root, text=True, capture_output=True, check=False,
        )
        self.assertEqual(process.returncode, expected, process.stdout + process.stderr)
        return process

    def audit(self):
        return json.loads((self.stage / "reports/import_report.json").read_text())

    @staticmethod
    def snapshot(root):
        return {file.relative_to(root): (file.read_bytes(), file.stat().st_mtime_ns)
                for file in root.rglob("*") if file.is_file()}

    def test_scan_dry_run_export_are_idempotent_and_laboratory_is_read_only(self):
        before = self.snapshot(self.lab)
        scan = self.cli("scan")
        self.assertEqual(json.loads(scan.stdout)["counts"]["discoveredExperiments"], 1)
        self.assertFalse(self.stage.exists())
        result = json.loads(self.cli("export", "--dry-run").stdout)
        self.assertTrue(result["dryRun"])
        self.assertFalse(self.stage.exists())
        self.cli("export")
        first = self.snapshot(self.stage)
        self.cli("export")
        self.assertEqual(first, self.snapshot(self.stage))
        self.assertEqual(before, self.snapshot(self.lab))
        self.assertFalse(self.public.exists())
        record, = json.loads((self.stage / "data/experiments.json").read_text())
        self.assertEqual(record["seed"], 42)
        self.assertIsNone(record["trainingBudget"]["supervisedFraction"])

    def test_absent_files_are_audited(self):
        (self.lab / self.metric).unlink()
        self.cli("validate")
        self.assertIn("missing_metrics", {issue["code"] for issue in self.audit()["issues"]})

    def test_physics_scope_and_the_two_rmse_definitions_are_preserved(self):
        path = self.lab / self.metric.replace("_test", "_physics_full_domain")
        self.write(path, {
            "divergence_source": {"corrected": "local_least_squares"},
            "divergence_method": {"n_neighbors": 12},
            "divergence_corrected": {"rmse": 2, "n_valid": 10, "valid_fraction": 1},
            "divergence_error_corrected_vs_fine": {"rmse": 1.5, "n_valid": 10, "valid_fraction": 1},
        })
        self.cli("export")
        metrics = {record["originalName"]: record for record in
                   json.loads((self.stage / "data/metrics.json").read_text())}
        zero = metrics["divergence_corrected.rmse"]
        fine = metrics["divergence_error_corrected_vs_fine.rmse"]
        self.assertNotEqual(zero["name"], fine["name"])
        self.assertEqual((zero["value"], fine["value"]), (2, 1.5))
        self.assertEqual(zero["evaluationSet"], "full_domain")
        self.assertEqual(zero["calculationMethod"], "local_least_squares_kdtree")
        self.assertEqual(zero["operatorParameters"], {"neighbors": 12})
        self.assertEqual(zero["pointCount"], 10)
        self.assertIsNone(zero["unit"])

    def test_unsafe_output_cannot_write_to_inputs(self):
        before = self.snapshot(self.lab)
        self.cli("export", "--output", str(self.lab / "new-output"), expected=1)
        self.assertEqual(before, self.snapshot(self.lab))
        self.assertFalse((self.lab / "new-output").exists())

    def test_invalid_json_and_nonfinite_numbers_are_rejected(self):
        for text, code in (
            ('{broken', "invalid_json"),
            ('{"value": NaN}', "nonfinite_number"),
            ('{"value": Infinity}', "nonfinite_number"),
            ('{"value": 1e999}', "nonfinite_number"),
        ):
            with self.subTest(text=text):
                (self.lab / self.metric).write_text(text)
                self.cli("export", expected=1)
                self.assertIn(code, {issue["code"] for issue in self.audit()["issues"]})
                self.assertFalse((self.stage / "data").exists())

    def test_conflicting_seed_is_reported(self):
        path = self.lab / self.metadata
        content = json.loads(path.read_text())
        content["config"]["experiment"]["seed"] = 123
        self.write(path, content)
        self.cli("validate", expected=1)
        self.assertIn("inconsistent_seed", {issue["code"] for issue in self.audit()["issues"]})

    def test_duplicate_id_and_broken_links_are_reported(self):
        second = {**self.event, "experimentIds": ["exp-not-present"], "sources": ["missing-source.json"]}
        self.write(self.root / "timeline.json", [second, self.event])
        self.cli("validate", expected=1)
        self.assertTrue({"duplicate_id", "broken_experiment_link", "broken_timeline_source"} <=
                        {issue["code"] for issue in self.audit()["issues"]})

    def test_approved_png_is_copied_and_revoked_png_removed(self):
        relative = f"results/plots/mlp/{self.name}/metric_test/approved.png"
        raw = png()
        path = self.lab / relative
        path.parent.mkdir(parents=True)
        path.write_bytes(raw)
        labels = {"pt": "Campo de velocidade", "en": "Velocity field"}
        approval = {
            "id": "approved", "phase": "phase-one", "source": relative, "approved": True,
            "sha256": hashlib.sha256(raw).hexdigest(), "experiment_id": self.identifier, "scope": "test",
            "unit": "m/s", "spatial_scale": {"axis_unit": "x/h", "h": 0.0127},
            "color_scale": {"mode": "common", "min": 0, "max": 3}, "alt": labels, "caption": labels,
        }
        self.config["figures"] = [approval, {"id": "unapproved", "source": relative}]
        self.cli("export")
        destination = self.stage / "figures/phase_01/approved.png"
        self.assertTrue(destination.is_file())
        self.assertNotIn(b"private", destination.read_bytes())
        self.assertEqual(1, len(list((self.stage / "figures").rglob("*.png"))))
        self.cli("export", "--public", expected=1)
        self.assertFalse(self.public.exists())
        self.config["public_approvals"] = {"experiments": [self.identifier]}
        self.cli("export", "--public")
        self.assertFalse((self.public / "figures").exists())
        self.config["public_approvals"]["figures"] = ["approved"]
        self.cli("export", "--public")
        self.assertTrue((self.public / "figures/phase_01/approved.png").exists())
        self.assertFalse((self.public / "reports").exists())
        self.config["public_approvals"] = {}
        self.cli("export", "--public")
        self.assertFalse((self.public / "figures/phase_01/approved.png").exists())
        self.assertEqual([], json.loads((self.public / "data/experiments.json").read_text()))
        self.config["figures"] = []
        self.cli("export")
        self.assertFalse(destination.exists())

    def test_invalid_figure_and_symlink_are_rejected(self):
        outside = self.root / "secret.png"
        outside.write_bytes(png())
        inside = self.lab / "results/plots/shortcut.png"
        inside.parent.mkdir(parents=True)
        inside.symlink_to(outside)
        self.config["figures"] = [{"id": "shortcut", "approved": True, "phase": "phase-one",
                                   "source": "results/plots/shortcut.png"}]
        self.cli("export", expected=1)
        self.assertIn("invalid_approved_figure", {issue["code"] for issue in self.audit()["issues"]})
        self.assertFalse((self.stage / "figures").exists())

    def test_public_approved_event_requires_visibility_and_strips_local_sources(self):
        self.config["public_approvals"] = {"experiments": [self.identifier], "timeline": ["evt-test"]}
        self.cli("export", "--public", expected=1)
        self.assertFalse(self.public.exists())
        self.event["visibility"] = "public"
        self.event["sources"] = ["https://github.com/team/research", "experiment_import.yaml"]
        # YAML source exists before the CLI opens it, yet is represented by an opaque reference.
        self.write(self.root / "timeline.json", [self.event])
        self.cli("export", "--public")
        record, = json.loads((self.public / "data/timeline.json").read_text())
        self.assertEqual(record["sources"], ["https://github.com/team/research"])
        self.assertEqual(record["sourceRefs"][0]["kind"], "timeline_evidence")
        self.assertNotIn("experiment_import.yaml", (self.public / "data/timeline.json").read_text())


class PrivacyTest(unittest.TestCase):
    def test_private_links_and_paths(self):
        for value in ("file:///tmp/metrics.json", "http://127.0.0.1/result", "https://user:secret@github.com/site",
                      "http://192.168.0.11/site", "http://dev.internal/site", "http://127.1/site"):
            with self.subTest(value=value):
                self.assertIsNone(public_url(value))
        self.assertEqual(public_url("https://github.com/team/site"), "https://github.com/team/site")
        with self.assertRaises(ValueError):
            check_public({"caption": "Generated from /srv/research/metrics.json"})
        with self.assertRaises(ValueError):
            check_public({"caption": "See http://127.0.0.1/results for details"})


class FeaturedTest(unittest.TestCase):
    def test_selects_only_requested_pairs_and_proves_the_complementary_test(self):
        group = {
            "id": "priority", "event": "evt-one", "priority": "P0",
            "comparisons": ["cmp-wanted"], "require_shared_test": ["exp-proof", "exp-mismatch"],
            "metrics": {"test": ["rmse_uv_corrected", "rmse_p_corrected"], "full_domain": ["divergence_corrected_rmse"]},
        }

        def experiment(identifier, fingerprint):
            return {"_metrics": [{
                "id": f"{identifier}:{name}", "name": name, "evaluationSet": scope, "pointCount": 4,
                "definition": name, "calculationMethod": "pointwise_field_error", "value": 0.5,
                "validityMask": {"evaluationFingerprint": fingerprint, "fingerprint": "all"},
            } for scope, names in group["metrics"].items() for name in names]}

        experiments = {identifier: experiment(identifier, "other" if identifier == "exp-mismatch" else "same")
                       for identifier in ("exp-a", "exp-b", "exp-proof", "exp-mismatch", "exp-unrelated")}
        pair = {"experimentIds": ["exp-a", "exp-b"], "conditions": [
            {"metricIds": ["exp-a:rmse_uv_corrected", "exp-b:rmse_uv_corrected"], "status": "compatible", "reasons": []},
            {"metricIds": ["exp-a:extra", "exp-b:extra"], "status": "blocked", "reasons": ["extra"]},
        ]}
        timeline = {"evt-one": {"experimentIds": list(experiments)}, "evt-unrelated": {}}
        audit = Audit()
        selected, comparisons, events = select_featured(
            {"groups": [group]}, experiments, {"cmp-wanted": pair, "cmp-other": {}}, timeline, audit,
        )
        filter_metrics(selected, experiments, comparisons)
        self.assertEqual(set(selected), {"exp-a", "exp-b", "exp-proof"})
        self.assertEqual(list(comparisons), ["cmp-wanted"])
        self.assertEqual(list(events), ["evt-one"])
        self.assertEqual(events["evt-one"]["verifiedTestMatches"], {"exp-proof": "exp-a"})
        self.assertEqual(len(experiments["exp-proof"]["_metrics"]), 2)
        self.assertEqual(pair["status"], "compatible")
        self.assertIn("featured_test_unverified", {issue["code"] for issue in audit.issues})

    def test_report_color_ranges_use_the_recorded_positive_log_floor(self):
        self.assertEqual(
            color_scales({"absolute_common": {"vmin": 0.001, "vmax": 4}, "error_common_abs_vmax": 5}),
            {"absolute_common": {"min": 0.001, "max": 4}, "error_common_abs_vmax": {"min": -5, "max": 5}},
        )


class ExportRecoveryTest(unittest.TestCase):
    def test_resume_after_a_partial_write(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "export"
            reports = Path(directory) / "reports"
            first = {"data/experiments.json": json_bytes([{"id": "one"}]), "data/metrics.json": json_bytes([])}
            second = {"data/experiments.json": json_bytes([{"id": "two"}]), "data/metrics.json": json_bytes([{}])}
            export(output, reports, first, {}, False)
            original = exporter._write

            def fail_on_metrics(path, content):
                if path.name == "metrics.json":
                    raise OSError("simulated failure")
                original(path, content)

            with patch.object(exporter, "_write", side_effect=fail_on_metrics):
                with self.assertRaises(OSError):
                    export(output, reports, second, {}, False)
            self.assertTrue((reports / "pending.json").exists())
            export(output, reports, second, {}, False)
            self.assertFalse((reports / "pending.json").exists())
            for name, content in second.items():
                self.assertEqual((output / name).read_bytes(), content)


if __name__ == "__main__":
    unittest.main()
