"""Load the explicit input, curation and publication policy."""
from pathlib import Path
import yaml

from .featured import validate_groups
from .parsers import token


class ConfigLoader(yaml.SafeLoader):
    def construct_mapping(self, node, deep=False):
        self.flatten_mapping(node)
        result = {}
        for key_node, value_node in node.value:
            key = self.construct_object(key_node, deep=deep)
            if key in result:
                raise ValueError("duplicate YAML key")
            result[key] = self.construct_object(value_node, deep=deep)
        return result


def read_config(path, seen):
    if path in seen:
        raise ValueError("cyclic import configuration")
    config = yaml.load(path.read_text(encoding="utf-8"), Loader=ConfigLoader)
    if isinstance(config, dict) and "extends" in config:
        base_name = config.pop("extends")
        if not token(base_name) or Path(base_name).suffix not in {".yaml", ".yml"}:
            raise ValueError("extends must name a sibling YAML file")
        base = read_config(path.with_name(base_name), {*seen, path})
        if not isinstance(base, dict):
            raise ValueError("invalid base configuration")
        return {**base, **config}
    return config


def load_config(path):
    config = read_config(path, set())
    if not isinstance(config, dict) or not isinstance(config.get("repositories"), dict) or not config["repositories"]:
        raise ValueError("repositories must be a nonempty mapping")

    for phase, repo in config["repositories"].items():
        if not token(phase) or not isinstance(repo, dict) or not token(repo.get("id_prefix")):
            raise ValueError("invalid phase or run ID prefix")
        repo["root"] = (path.parent / repo["root"]).resolve()
        if repo.get("execution_timezone") not in (None, "UTC"):
            raise ValueError("execution_timezone must be UTC when configured")
        if not token(repo.get("figure_directory")):
            raise ValueError("invalid figure directory")
    prefixes = [repo["id_prefix"] for repo in config["repositories"].values()]
    roots = [repo["root"] for repo in config["repositories"].values()]
    if len(prefixes) != len(set(prefixes)) or len(roots) != len(set(roots)):
        raise ValueError("repository roots and ID prefixes must be unique")
    for key in ("staging_output", "public_output", "public_reports", "timeline"):
        config[key] = (path.parent / config[key]).resolve()
    if config.get("selection", "timeline") not in {"timeline", "all", "featured"}:
        raise ValueError("selection must be timeline, all or featured")
    if type(config.get("verify_predictions", True)) is not bool:
        raise ValueError("verify_predictions must be a boolean")
    if not isinstance(config.get("cases", {}), dict) or not isinstance(config.get("figures", []), list):
        raise ValueError("invalid cases or figures configuration")
    for case in config.get("cases", {}).values():
        if not all(token(case.get(key)) for key in ("id", "turbulence")):
            raise ValueError("invalid case identity")
        if not all(type(x) is int and x > 0 for x in case.get("reynolds", [])):
            raise ValueError("invalid Reynolds numbers")
    approvals = config.get("public_approvals", {})
    if not isinstance(approvals, dict):
        raise ValueError("invalid publication policy")
    for key in ("experiments", "comparisons", "timeline", "figures", "training"):
        ids = approvals.get(key, [])
        if not isinstance(ids, list) or not all(token(value) for value in ids) or len(ids) != len(set(ids)):
            raise ValueError(f"invalid public approvals for {key}")
    if type(config.get("show_all_featured_metrics", False)) is not bool:
        raise ValueError("show_all_featured_metrics must be a boolean")
    if config.get("selection") == "featured":
        validate_groups(config)
    return config
