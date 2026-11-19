"""Curate only explicit, content-addressed PNG approvals."""
import math
import struct
import zlib

from .parsers import digest, resolve_input, token

COMPARISON_SCALES = {
    "divergence_mlp_vs_pinn_absolute_common_scale.png": "absolute_common",
    "divergence_mlp_vs_pinn_signed_common_scale.png": "signed_common",
    "divergence_error_mlp_vs_pinn_common_scale.png": "error_common_abs_vmax",
}


def png_without_metadata(data):
    signature = b"\x89PNG\r\n\x1a\n"
    if not data.startswith(signature):
        raise ValueError("invalid PNG signature")
    offset = len(signature)
    output = bytearray(signature)
    seen = set()
    while offset + 12 <= len(data):
        length, kind = struct.unpack_from(">I4s", data, offset)
        end = offset + length + 12
        body = data[offset + 8:end - 4]
        if end > len(data) or zlib.crc32(kind + body) != struct.unpack_from(">I", data, end - 4)[0]:
            raise ValueError("invalid PNG chunk")
        if not seen and kind != b"IHDR":
            raise ValueError("missing PNG header")
        if kind == b"IHDR" and (kind in seen or length != 13 or not all(struct.unpack_from(">II", body))):
            raise ValueError("invalid PNG dimensions")
        if kind in {b"IHDR", b"PLTE", b"IDAT", b"IEND", b"tRNS", b"gAMA", b"cHRM", b"sRGB", b"pHYs", b"sBIT"}:
            output.extend(data[offset:end])
        elif not kind[0] & 32:
            raise ValueError("unsupported critical PNG chunk")
        seen.add(kind)
        if kind == b"IEND":
            if length != 0 or end != len(data) or b"IDAT" not in seen:
                raise ValueError("invalid PNG ending")
            return bytes(output)
        offset = end
    raise ValueError("incomplete PNG")


def curate(config, experiments, comparisons, public, audit):
    outputs = {}
    seen = set()
    approved = set(config.get("public_approvals", {}).get("figures", []))
    for entry in config.get("figures", []):
        identifier = token(entry.get("id")) if isinstance(entry, dict) else None
        if not identifier or identifier in seen:
            audit.add("error", "invalid_or_duplicate_figure", "figures", "figure IDs must be unique")
            continue
        seen.add(identifier)
        if entry.get("review_note"):
            try:
                phase = entry["phase"]
                root = config["repositories"][phase]["root"]
                candidate = resolve_input(root, entry["source"])
                if not candidate.is_file() or candidate.suffix != ".png" or digest(candidate) != entry["sha256"]:
                    audit.add("warning", "changed_figure_candidate", identifier, "candidate file missing or changed")
                else:
                    audit.record(phase, candidate, root, "pending_figure_candidate")
            except (ValueError, KeyError, OSError, TypeError):
                audit.add("warning", "invalid_figure_candidate", identifier, "candidate source could not be verified")
        if entry.get("approved") is not True or (public and identifier not in approved):
            if public and identifier in approved:
                audit.add("error", "unapproved_figure", identifier, "figure has no recorded curation approval")
            continue
        try:
            attach_figure(entry, identifier, config, experiments, comparisons, public, audit, outputs)
        except (OSError, ValueError, TypeError, KeyError):
            audit.add("error", "invalid_approved_figure", identifier, "missing or invalid file, approval, scope, scale or metadata")
    for missing in sorted(approved - seen) if public else []:
        audit.add("error", "unknown_figure_approval", missing, "figure ID was not configured")
    return outputs


def attach_figure(entry, identifier, config, experiments, comparisons, public, audit, outputs):
    phase = entry["phase"]
    repo = config["repositories"][phase]
    path = resolve_input(repo["root"], entry["source"])
    relative = path.relative_to(repo["root"])
    if relative.parts[:2] not in (("results", "plots"), ("results", "comparisons")) or path.suffix != ".png":
        raise ValueError("invalid figure source")
    experiment = experiments.get(entry.get("experiment_id"))
    comparison = comparisons.get(entry.get("comparison_id"))
    if (experiment is None) == (comparison is None):
        raise ValueError("expected one selected owner")
    owner = experiment if experiment is not None else comparison
    if owner["phaseId"] != phase or (public and owner["visibility"] != "public"):
        raise ValueError("invalid owner")
    scope = entry["scope"]
    spatial = entry["spatial_scale"]
    colors = entry["color_scale"]
    if scope not in {"test", "full_domain"} or not all(isinstance(v, str) and v.strip() for v in (
        entry["unit"], spatial["axis_unit"], colors["mode"],
    )):
        raise ValueError("invalid scope or scale")
    if type(spatial["h"]) not in (int, float) or not math.isfinite(spatial["h"]) or spatial["h"] <= 0:
        raise ValueError("invalid spatial scale")
    if not all(type(colors[key]) in (int, float) and math.isfinite(colors[key]) for key in ("min", "max")):
        raise ValueError("invalid color limits")
    if colors["min"] >= colors["max"]:
        raise ValueError("invalid color limits")
    if comparison:
        expected = comparison["protocol"]
        if expected["physicsScope"] != scope or expected["plotHeight"] != spatial["h"]:
            raise ValueError("figure disagrees with comparison report")
        # The compound series must identify the exact plot attached to the pair.
        if relative.parent.parent.name != expected["pairFolder"]:
            raise ValueError("figure belongs to another comparison")
        if colors["mode"] != COMPARISON_SCALES.get(path.name) or colors["mode"] not in expected["colorScales"]:
            raise ValueError("unrecognized scale for comparison")
        limits = expected["colorScales"][colors["mode"]]
        if not math.isclose(colors["max"], limits["max"]):
            raise ValueError("color limit differs from comparison report")
        if not math.isclose(colors["min"], limits["min"]):
            raise ValueError("invalid lower bound for comparison")
        if not any(check["measurementCompatible"] and check["unit"] == entry["unit"]
                   and entry.get("operator", check["operator"]) == check["operator"]
                   for check in comparison["conditions"]
                   if check["scope"] == scope and check["metric"].startswith("divergence_")):
            raise ValueError("comparison unit is unverified")
    else:
        expected_suffix = f"_{scope}"
        run = entry["experiment_id"].removeprefix(f"exp-{repo['id_prefix']}-")
        if run not in {part.replace("_", "-") for part in relative.parts}:
            raise ValueError("figure belongs to another execution")
        known_stems = {detail["stem"] for detail in experiment["_predictionScopes"].values() if detail["scope"] == scope}
        if not any(part.endswith(expected_suffix) or part in known_stems for part in relative.parts[:-1]):
            raise ValueError("figure scope is unverified")
        if not any(metric["evaluationSet"] == scope and metric["unit"] == entry["unit"]
                   for metric in experiment["_metrics"]):
            raise ValueError("figure unit is unverified")
    labels = {}
    for key in ("caption", "alt"):
        labels[key] = {language: entry[key][language] for language in ("pt", "en")}
        if not all(isinstance(value, str) and value.strip() for value in labels[key].values()):
            raise ValueError("figure needs PT/EN caption and alt text")
    ref = audit.record(phase, path, repo["root"], "figure")
    if entry["sha256"] != ref["sha256"]:
        raise ValueError("approval hash does not match")
    destination = f"figures/{repo['figure_directory']}/{identifier}.png"
    outputs[destination] = png_without_metadata(path.read_bytes())
    owner["figures"].append({
        "id": identifier, "path": destination, **labels, "source": ref,
        "experimentId": entry.get("experiment_id"), "comparisonId": entry.get("comparison_id"),
        "evaluationSet": scope, "unit": entry["unit"],
        "field": entry.get("field"),
        "referenceType": entry.get("reference_type"),
        "operator": entry.get("operator"),
        "spatialScale": {"axis_unit": spatial["axis_unit"], "h": spatial["h"]},
        "colorScale": {key: colors[key] for key in ("mode", "min", "max")},
        "published": public,
    })
