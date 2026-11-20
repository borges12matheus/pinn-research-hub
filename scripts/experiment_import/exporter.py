"""Write deterministic artifacts, keeping ownership and audit data outside public/."""
from contextlib import contextmanager
import fcntl
from hashlib import sha256
import json
import os
from pathlib import Path
import tempfile

from .parsers import digest, parse_json, relative_path

DATA_FILES = {f"data/{name}.json" for name in ("experiments", "metrics", "comparisons", "timeline", "evaluations", "training")}


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, indent=2) + "\n").encode()


def report_files(audit, counts, public):
    issues = sorted(audit.issues, key=lambda i: (i["level"], i["code"], i["subject"], i["detail"]))
    sources = [source for _, source in sorted(audit.sources.items())]
    report = {"target": "public" if public else "staging", "counts": counts,
              "issues": issues, "sources": sources, "valid": not audit.has_errors}
    body = ["# Auditoria da importação experimental", "", f"Destino previsto **{report['target']}**.", "", "## Contagens", ""]
    body.extend(f"- `{key}` — {value}" for key, value in counts.items())
    body.extend(["", "## Ocorrências", ""])
    body.extend(f"- **{issue['level']}** `{issue['code']}` · `{issue['subject']}` · {issue['detail']}"
                for issue in issues)
    if not issues:
        body.append("Nenhuma ocorrência.")
    body.extend(["", "## Proveniência", "", "O JSON lista identificadores, nomes de arquivo e SHA-256 das fontes.", ""])
    return {"import_report.json": json_bytes(report), "import_report.md": "\n".join(body).encode()}


def _safe_child(root, name):
    relative = relative_path(name)
    path = root.joinpath(*relative.parts)
    if path.resolve() != path:
        raise ValueError("output contains a symbolic link")
    return path


def _write(path, content):
    if path.is_file() and path.read_bytes() == content:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as file:
        temporary = Path(file.name)
        try:
            file.write(content)
            file.flush()
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)


@contextmanager
def _lock(reports):
    reports.mkdir(parents=True, exist_ok=True)
    marker = _safe_child(reports, ".export.lock")
    with marker.open("a+b") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError("another export is in progress") from None
        yield


def _managed_name(name):
    path = relative_path(name)
    return name in DATA_FILES or (len(path.parts) == 3 and path.parts[0] == "figures" and path.suffix == ".png")


def plan(output, reports, files):
    state_path = _safe_child(reports, "managed.json")
    pending_path = _safe_child(reports, "pending.json")
    known = parse_json(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
    if not isinstance(known, dict) or not all(_managed_name(name) and isinstance(value, str)
                                             for name, value in known.items()):
        raise ValueError("invalid managed output index")
    allowed = {name: {checksum} for name, checksum in known.items()}
    if pending_path.exists():
        pending = parse_json(pending_path.read_text(encoding="utf-8"))
        if not isinstance(pending, dict) or not all(
            _managed_name(name) and isinstance(values, list) and all(isinstance(value, str) for value in values)
            for name, values in pending.items()
        ):
            raise ValueError("invalid interrupted export index")
        for name, values in pending.items():
            allowed.setdefault(name, set()).update(values)
    for name in sorted(allowed.keys() | files.keys()):
        if not _managed_name(name):
            raise ValueError("invalid managed output path")
        path = _safe_child(output, name)
        if path.exists() and (not path.is_file() or digest(path) not in allowed.get(name, set())):
            raise ValueError(f"unmanaged or edited output: {name}")
    expected = {name: sha256(content).hexdigest() for name, content in files.items()}
    stale = sorted(allowed.keys() - expected.keys())
    for name, checksum in expected.items():
        allowed.setdefault(name, set()).add(checksum)
    return state_path, pending_path, expected, stale, allowed, known != expected


def export(output, reports, files, report, dry_run):
    if dry_run:
        _, _, _, stale, _, _ = plan(output, reports, files)
        return stale
    for name in report:
        _safe_child(reports, name)
    with _lock(reports):
        state_path, pending_path, expected, stale, allowed, changed = plan(output, reports, files)
        if changed or pending_path.exists():
            _write(pending_path, json_bytes({name: sorted(values) for name, values in allowed.items()}))
        for name, content in sorted(files.items()):
            _write(_safe_child(output, name), content)
        for name in stale:
            _safe_child(output, name).unlink(missing_ok=True)
        _write(state_path, json_bytes(expected))
        pending_path.unlink(missing_ok=True)
        for name, content in report.items():
            _write(_safe_child(reports, name), content)
    return stale


def write_reports(reports, contents):
    with _lock(reports):
        for name, content in contents.items():
            _write(_safe_child(reports, name), content)
