"""Policy checks for IDs, output locations and publishable payloads."""
from pathlib import Path
import re
from urllib.parse import unquote

from .parsers import INTERNAL, public_url

HUB = Path(__file__).resolve().parents[2]


def overlaps(a, b):
    return a.is_relative_to(b) or b.is_relative_to(a)


def validate_paths(output, public_output, staging_area, roots, public):
    if any(overlaps(output, root) for root in roots):
        raise ValueError("output overlaps a scientific repository")
    if output in {HUB, Path.cwd().resolve(), Path(output.anchor)}:
        raise ValueError("choose a dedicated output directory")
    if not public and any(overlaps(output, path) for path in (public_output, HUB / "public")):
        raise ValueError("staging output overlaps a public directory")
    if not public and output.is_relative_to(HUB) and not output.is_relative_to(staging_area):
        raise ValueError("staging inside the Hub must stay under .experiment-import")
    if public and output.is_relative_to(HUB) and not output.is_relative_to(HUB / "public"):
        raise ValueError("public output inside the Hub must stay under public/")
    if output.is_relative_to(HUB / ".git"):
        raise ValueError("output overlaps Git metadata")


def index_by_id(records, audit, section):
    result = {}
    for record in records:
        identifier = record["id"]
        if identifier in result:
            audit.add("error", "duplicate_id", identifier, section)
        else:
            result[identifier] = record
    return result


def check_public(value):
    if isinstance(value, dict):
        for item in value.values():
            check_public(item)
    elif isinstance(value, list):
        for item in value:
            check_public(item)
    elif isinstance(value, str):
        if value.startswith(("https://", "http://")):
            if not public_url(value):
                raise ValueError("invalid public URL")
        else:
            urls = re.compile(r"https?://[^\s`<>\"')]+")

            def remove_url(match):
                if not public_url(match[0].rstrip(".,;")):
                    raise ValueError("invalid embedded public URL")
                return ""

            decoded = unquote(unquote(urls.sub(remove_url, value)))
            if (INTERNAL.search(decoded) or re.search(r"(?:^|[\s`(=\"'])[/\\][\w.~-]+[/\\]", decoded)
                    or decoded.startswith(("/", "\\"))):
                raise ValueError("internal path in public payload")
