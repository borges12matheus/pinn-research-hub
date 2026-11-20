"""Optional verification of exported Parquet references and numerical masks."""
from hashlib import sha256
import math

try:
    import pyarrow as pa
    import pyarrow.compute as pc
    import pyarrow.parquet as pq
except ImportError:
    pa = pc = pq = None

REFERENCE = ("x", "y", "Ux", "Uy", "p", "dUx", "dUy", "dp")
PHYSICAL = ("div_u", "div_u_f", "div_delta_pred", "div_corrected", "div_error_vs_fine")


def _fingerprint(table, names):
    table = table.select(names)
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)
    return sha256(sink.getvalue()).hexdigest()


def _finite(array):
    return pc.fill_null(pc.is_finite(array), False)


def inspect_predictions(path, physical, operator, audit, subject):
    if not path.is_file():
        audit.add("warning", "missing_predictions", subject, path.name)
        return None
    if pq is None:
        return None
    try:
        file = pq.ParquetFile(path)
        identity = list(REFERENCE)
        if physical:
            identity.extend(("div_u", "div_u_f"))
        if "Re" in file.schema.names:
            identity.append("Re")
        required = set(identity) | (set(PHYSICAL) if physical else {"dUx_pred", "dUy_pred", "dp_pred"})
        if not required.issubset(file.schema.names):
            raise ValueError("missing reference or prediction columns")
        data = file.read(columns=sorted(required))
        floats = {name: pc.cast(data[name].combine_chunks(), pa.float64()) for name in sorted(required)}
        reference = pa.table({name: floats[name] for name in identity})
        cohort = reference.sort_by([(key, "ascending") for key in identity])
        masks = {}
        if physical:
            if operator == "local_least_squares_kdtree":
                valid = _finite(floats[PHYSICAL[0]])
                for field in PHYSICAL[1:4]:
                    valid = pc.and_(valid, _finite(floats[field]))
                masks = {name: valid for name in PHYSICAL}
            else:
                masks = {name: _finite(floats[name]) for name in PHYSICAL}
        else:
            if not all(pc.all(_finite(array)).as_py() for array in floats.values()):
                raise ValueError("nonfinite accuracy inputs or predictions")
            masks = {"accuracy": pa.array([True] * len(data), type=pa.bool_())}

        result = {}
        for name, mask in masks.items():
            count = pc.sum(pc.cast(mask, pa.int64())).as_py()
            # A full mask is uniquely determined by the cohort and avoids repeated serialization.
            if count == len(data):
                mask_hash = "all"
            else:
                with_mask = reference.append_column("valid", mask)
                ranked = with_mask.sort_by([(key, "ascending") for key in [*identity, "valid"]])
                mask_hash = _fingerprint(ranked, [*identity, "valid"])
            result[name] = (mask_hash, count)
        return {"count": len(data), "cohort": _fingerprint(cohort, identity), "masks": result}
    except (OSError, ValueError, pa.ArrowException) as error:
        audit.add("warning", "unverified_predictions", subject, f"{path.name} ({type(error).__name__})")
        return None
