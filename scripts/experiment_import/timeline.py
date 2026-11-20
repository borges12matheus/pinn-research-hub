"""Read the documented timeline contract without treating local links as public."""
from datetime import date
import re

from .parsers import editorial_text, parse_json, public_url, token
from .validation import index_by_id

CATEGORIES = {"methodology", "experiment", "validation", "publication", "decision"}
STATUSES = {"verified", "preliminary", "planned", "unknown"}
DETAILS = ("hypothesis", "observation", "conclusion", "nextStep")


def read_timeline(config, audit):
    path = config["timeline"]
    if not path.is_file():
        audit.add("warning", "missing_timeline", "timeline", path.name)
        return {}
    try:
        text = path.read_text(encoding="utf-8")
        if path.suffix == ".md":
            (text,) = re.findall(r"^```json\s*\n(.*?)^```\s*$", text, flags=re.M | re.S)
        raw = parse_json(text)
        if not isinstance(raw, list):
            raise ValueError("expected an array")
    except (OSError, UnicodeError, ValueError) as error:
        code = "nonfinite_number" if str(error) == "nonfinite" else "invalid_timeline"
        audit.add("error", code, "timeline", path.name)
        return {}

    records = []
    for entry in raw:
        try:
            records.append(normalize_event(entry, config, audit))
        except (TypeError, KeyError, ValueError):
            audit.add("error", "invalid_event", "timeline", "invalid event fields")
    return index_by_id(records, audit, "timeline")


def normalize_event(entry, config, audit):
    identifier = token(entry["id"])
    if not identifier or entry["category"] not in CATEGORIES or entry["evidenceStatus"] not in STATUSES:
        raise ValueError("invalid event identity")
    if entry["visibility"] not in {"private", "public"}:
        raise ValueError("invalid visibility")
    raw_sources = entry["sources"]
    if not isinstance(raw_sources, list):
        raise ValueError("invalid sources")
    valid_links = []
    source_refs = []
    base = config["timeline"].parent
    roots = {"timeline": base, **{key: repo["root"] for key, repo in config["repositories"].items()}}
    for value in raw_sources:
        if public_url(value):
            valid_links.append(value)
        elif isinstance(value, str) and not value.startswith(("/", "\\")) and ":" not in value:
            path = (base / value).resolve()
            match = next(((phase, root) for phase, root in roots.items() if path.is_relative_to(root)), None)
            if match and path.is_file() and path.suffix in {".json", ".md", ".py", ".yaml", ".yml"}:
                source_refs.append(audit.record(match[0], path, match[1], "timeline_evidence"))
            else:
                audit.add("error", "broken_timeline_source", identifier, "unresolved or disallowed local source")
        else:
            audit.add("error", "invalid_timeline_link", identifier, "unsafe offline source reference")

    out = {key: entry.get(key) for key in ("id", "date", "category", "evidenceStatus", "visibility", "updatedAt")}
    for key in ("date", "updatedAt"):
        if out[key] is not None:
            if not isinstance(out[key], str) or date.fromisoformat(out[key]).isoformat() != out[key]:
                raise ValueError("invalid ISO date")
    for key in ("title", "summary"):
        values = entry[key]
        if not isinstance(values, dict) or not isinstance(values.get("pt"), str) or not values["pt"].strip():
            raise ValueError("Portuguese text is required")
        out[key] = {locale: editorial_text(values.get(locale)) for locale in ("pt", "en")}
    for key in ("period", *DETAILS):
        out[key] = editorial_text(entry.get(key))
    if out["date"] is None and not out["period"]:
        raise ValueError("undated events need a period")
    for key in ("experimentIds", "decisionIds", "hypothesisIds"):
        values = entry.get(key, [])
        if not isinstance(values, list) or not all(token(value) for value in values) or len(values) != len(set(values)):
            raise ValueError("invalid event links")
        out[key] = values
    descriptions = entry.get("metricFamilies", [])
    if not isinstance(descriptions, list) or not all(isinstance(value, str) for value in descriptions):
        raise ValueError("invalid metric descriptions")
    if entry.get("phaseId") is not None and not token(entry["phaseId"]):
        raise ValueError("invalid phase")
    out.update(sources=valid_links, sourceRefs=source_refs, phaseId=entry.get("phaseId"),
               metricFamilies=[editorial_text(value) for value in descriptions])
    return out
