"""Execution times from dated training evidence, independent of import dates."""
from datetime import datetime
import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


ISO_TIME = re.compile(r"\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:[.,]\d{1,6})?(?:Z|[+-]\d\d:\d\d)?\Z")
RUN_NAME_TIME = re.compile(r"_(\d{8}_\d{6})$")
LOG_START = re.compile(r"^(\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:[.,]\d{1,6})?(?:Z|[+-]\d\d:\d\d)?)\b.*(?:in[ií]cio do treinamento|iniciando experimento|training started|starting training)\b", re.I)


def iso_time(value):
    if not isinstance(value, str) or not ISO_TIME.fullmatch(value):
        return None
    try:
        stamp = datetime.fromisoformat(value.replace(",", "."))
        return stamp.isoformat()
    except ValueError:
        return None


def normalize_utc(value):
    if value is None:
        return None
    stamp = datetime.fromisoformat(value)
    utc = ZoneInfo("UTC")
    stamp = stamp.replace(tzinfo=utc) if stamp.tzinfo is None else stamp.astimezone(utc)
    return stamp.isoformat().removesuffix("+00:00") + "Z"


def execution_time(name, metadata, log_stamp=None, source_ref=None, log_ref=None, execution_timezone=None):
    start, finish = (iso_time(metadata.get(field)) for field in ("start_time", "end_time"))
    match = RUN_NAME_TIME.search(name)
    inferred = None
    if match:
        try:
            inferred = datetime.strptime(match[1], "%Y%m%d_%H%M%S").isoformat()
        except ValueError:
            pass
    chosen = start or log_stamp or inferred
    source = "run_metadata" if start else "log" if log_stamp else "run_name" if inferred else "unknown"
    timezone = None
    if source == "run_metadata" and isinstance(metadata.get("timezone"), str):
        try:
            timezone = ZoneInfo(metadata["timezone"]).key
        except (ValueError, ZoneInfoNotFoundError):
            pass
    started = start or log_stamp
    if execution_timezone == "UTC":
        chosen, started, finish = map(normalize_utc, (chosen, started, finish))
        timezone = "UTC" if chosen else None
    return {
        "executedAt": chosen, "startedAt": started, "finishedAt": finish,
        "executedAtSource": source,
        "executedAtConfidence": "confirmed" if start or log_stamp else "inferred" if inferred else "unknown",
        "timezone": timezone, "importedAt": None, "publishedAt": None,
        "sourceRef": source_ref if start else log_ref if log_stamp else None,
    }


def log_start(path):
    with path.open(encoding="utf-8", errors="replace") as source:
        for line in source:
            match = LOG_START.match(line)
            if match:
                return iso_time(match[1])
    return None
