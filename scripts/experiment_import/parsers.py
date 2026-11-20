"""Input formats, source identities and offline reference checks."""
from dataclasses import dataclass, field
from hashlib import sha256
from ipaddress import ip_address
import json
from pathlib import Path, PurePosixPath
import re
from urllib.parse import parse_qsl, unquote, urlsplit


TOKEN = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9_.-]*\Z")
INTERNAL = re.compile(
    r"(?i)(?:\bfile:/*|/app/|/home/|/tmp/|/mnt/|/var/|/Users/|(?<![a-z])[a-z]:[\\/]|"
    r"\.\.[\\/]|lab_experimentos[\\/]|(?:results|logs|configs|data_processed)[\\/])"
)


def token(value):
    return value if isinstance(value, str) and TOKEN.fullmatch(value) else None


def digest(path):
    with path.open("rb") as file:
        return sha256_stream(file)


def sha256_stream(file):
    result = sha256()
    for block in iter(lambda: file.read(1024 * 1024), b""):
        result.update(block)
    return result.hexdigest()


def source(phase, path, root, kind):
    relative = path.relative_to(root).as_posix()
    key = sha256(f"{phase}/{relative}".encode()).hexdigest()[:24]
    return {"id": f"src-{key}", "kind": kind, "sha256": digest(path)}


@dataclass
class Audit:
    issues: list = field(default_factory=list)
    sources: dict = field(default_factory=dict)

    def add(self, level, code, subject, detail):
        self.issues.append(dict(level=level, code=code, subject=subject, detail=detail))

    def record(self, phase, path, root, kind):
        ref = source(phase, path, root, kind)
        self.sources[ref["id"]] = {**ref, "phase": phase, "file": path.name}
        return ref

    @property
    def has_errors(self):
        return any(item["level"] == "error" for item in self.issues)


def _unique_object(items):
    data = {}
    for key, value in items:
        if key in data:
            raise ValueError("duplicate_key")
        data[key] = value
    return data


def _nonfinite(_):
    raise ValueError("nonfinite")


def parse_json(text):
    from math import isfinite

    def finite_float(value):
        number = float(value)
        return number if isfinite(number) else _nonfinite(value)

    return json.loads(text, object_pairs_hook=_unique_object, parse_constant=_nonfinite, parse_float=finite_float)


def read_json(path, audit, subject):
    try:
        data = parse_json(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("not_an_object")
        return data
    except FileNotFoundError:
        audit.add("warning", "missing_file", subject, path.name)
    except (OSError, UnicodeError, ValueError) as error:
        code = "nonfinite_number" if str(error) == "nonfinite" else "invalid_json"
        audit.add("error", code, subject, path.name)
    return None


def relative_path(value):
    if not isinstance(value, str) or "\\" in value:
        raise ValueError("expected a relative POSIX path")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or not path.parts or ":" in value:
        raise ValueError("expected a relative POSIX path")
    return path


def resolve_input(root, value, container=False):
    if container and isinstance(value, str) and value.startswith("/app/"):
        value = value.removeprefix("/app/")
    relative = relative_path(value)
    path = root.joinpath(*relative.parts).resolve()
    if not path.is_relative_to(root):
        raise ValueError("source escapes its repository")
    return path


def public_url(value):
    if not isinstance(value, str) or re.search(r"\s|[\\\x00-\x1f]", value):
        return None
    decoded = unquote(unquote(value))
    if re.search(r"(?i)/+(?:home|users|mnt|tmp|app|lab_experimentos)/|[\\\x00-\x1f]", decoded):
        return None
    try:
        url = urlsplit(value)
        host = (url.hostname or "").rstrip(".").lower()
        _ = url.port
        if url.scheme not in {"https", "http"} or url.username is not None or url.password is not None:
            return None
        credentials = {"access_token", "token", "key", "api_key", "signature", "sig", "password"}
        if any(key.lower() in credentials or key.lower().startswith("x-amz-") for key, _ in parse_qsl(url.query)):
            return None
        try:
            return value if ip_address(host).is_global else None
        except ValueError:
            if "." in host and not host.endswith((".local", ".internal", ".localhost", ".test", ".example", ".invalid")):
                if re.fullmatch(r"[a-z0-9-]+(?:\.[a-z0-9-]+)+", host) and re.search(r"[a-z]", host.rsplit(".", 1)[-1]):
                    return value
    except ValueError:
        return None
    return None


def editorial_text(value):
    """Remove local references from the Markdown-derived staging copy."""
    if not isinstance(value, str):
        return None
    return re.sub(
        r"(?i)`?[\w./-]*(?:lab_experimentos/|results/|logs/|configs/|data_processed/|"
        r"/app/|/home/|/tmp/|/mnt/|/var/|/Users/|file:/|\.\./)[^\s`,;]*`?",
        "[referência local]", value
    )
