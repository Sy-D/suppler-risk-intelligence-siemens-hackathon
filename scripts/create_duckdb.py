#!/usr/bin/env python3
"""Load tabular files from the data folder into a DuckDB database.

CSV, TSV, Parquet, JSON, and JSONL files are each loaded as their own table.
The supplier-risk extract (a hash-named CSV with a supplierID column) is
stored as the `suppliers` table. Other files use a sanitized version of the
filename.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import duckdb

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = PROJECT_ROOT / "data"
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "suppliers.duckdb"

READERS = {
    ".csv": "read_csv_auto({path}, header = true, sample_size = -1)",
    ".tsv": "read_csv_auto({path}, header = true, delim = '\\t', sample_size = -1)",
    ".parquet": "read_parquet({path})",
    ".json": "read_json_auto({path})",
    ".jsonl": "read_ndjson_auto({path})",
}


def sql_string(path: Path) -> str:
    escaped = str(path).replace("'", "''")
    return f"'{escaped}'"


def sanitize_identifier(name: str) -> str:
    cleaned = re.sub(r"[^0-9a-zA-Z_]+", "_", name).strip("_").lower()
    if not cleaned or cleaned[0].isdigit():
        cleaned = f"t_{cleaned}" if cleaned else "table"
    return cleaned


def table_name_for(path: Path, used: set[str]) -> str:
    header = ""
    if path.suffix.lower() in {".csv", ".tsv"}:
        header = path.read_text(encoding="utf-8", errors="replace").splitlines()[0]

    if re.search(r"(^|,)supplierID(,|$)", header):
        base = "suppliers"
    else:
        base = sanitize_identifier(path.stem)

    name = base
    suffix = 2
    while name in used:
        name = f"{base}_{suffix}"
        suffix += 1
    used.add(name)
    return name


def source_files(data_dir: Path, db_path: Path) -> list[Path]:
    return sorted(
        path
        for path in data_dir.iterdir()
        if path.is_file()
        and path.suffix.lower() in READERS
        and path.resolve() != db_path
    )


def load(data_dir: Path, db_path: Path) -> None:
    if not data_dir.is_dir():
        raise SystemExit(f"Data directory not found: {data_dir}")

    files = source_files(data_dir, db_path)
    if not files:
        raise SystemExit(f"No tabular files found in {data_dir}")

    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(db_path))
    used: set[str] = set()
    try:
        for path in files:
            name = table_name_for(path, used)
            reader = READERS[path.suffix.lower()].format(path=sql_string(path))
            con.execute(f"CREATE OR REPLACE TABLE {name} AS SELECT * FROM {reader}")
            row_count = con.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
            columns = con.execute(f"SELECT COUNT(*) FROM (DESCRIBE {name})").fetchone()[0]
            print(f"{name}: {row_count} rows, {columns} columns ({path.name})")
    finally:
        con.close()

    print(f"Wrote {db_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help=f"Folder of source files (default: {DEFAULT_DATA_DIR})",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB_PATH,
        help=f"Output DuckDB file (default: {DEFAULT_DB_PATH})",
    )
    args = parser.parse_args()
    load(args.data_dir.resolve(), args.db.resolve())


if __name__ == "__main__":
    main()
