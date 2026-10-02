#!/usr/bin/env python3
"""Builds PROJECT_MAP.md: a short map of the whole app (every file, what it exports, who imports it, the database tables
and the server functions). Claude reads this first instead of opening dozens of files, which saves a lot of tokens.

Run from the Muna folder:   python3 tools/make_map.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
IMPORT = re.compile(r"""(?:import|export)\s[^;]*?from\s+['"](\.[^'"]+)['"]""", re.S)
EXPORT = re.compile(r"export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|type|let)\s+([A-Za-z0-9_]+)")
EXPORT_DEFAULT = re.compile(r"export\s+default\s+(?:async\s+)?(?:function|class)?\s*([A-Za-z0-9_]*)")


def resolve(base: Path, rel: str):
    p = (base.parent / rel).resolve()
    for cand in (p, p.with_suffix(".ts"), p.with_suffix(".tsx"), p / "index.ts", p / "index.tsx"):
        if cand.is_file():
            return cand.relative_to(ROOT).as_posix()
    return None


def first_comment(text: str) -> str:
    for line in text.splitlines()[:12]:
        line = line.strip()
        if line.startswith("//") and not line.startswith("///"):
            return line.lstrip("/ ").strip()[:140]
    return ""


files = sorted(p for p in SRC.rglob("*") if p.suffix in (".ts", ".tsx"))
imported_by = {}
rows = []
for f in files:
    text = f.read_text(encoding="utf-8")
    rel = f.relative_to(ROOT).as_posix()
    deps = sorted({r for m in IMPORT.findall(text) if (r := resolve(f, m))})
    for d in deps:
        imported_by.setdefault(d, set()).add(rel)
    exports = EXPORT.findall(text)
    if re.search(r"export\s+default", text) and not exports:
        exports = ["default " + (EXPORT_DEFAULT.search(text).group(1) or "")]
    rows.append((rel, len(text.splitlines()), exports, deps, first_comment(text)))

lines = ["# Muna project map", "", "Auto-made by `python3 tools/make_map.py`. Do not edit by hand. Read this before opening files.", ""]
lines += ["## Most connected files (change these carefully)", ""]
hubs = sorted(imported_by.items(), key=lambda kv: -len(kv[1]))[:8]
for path, users in hubs:
    lines.append(f"- `{path}`: used by {len(users)} files")
lines += ["", "## Source files (src/)", ""]
for rel, n, exports, deps, note in rows:
    ex = ", ".join(exports[:8]) + ("…" if len(exports) > 8 else "")
    lines.append(f"- `{rel}` ({n} lines){' - ' + note if note else ''}")
    if ex:
        lines.append(f"  - exports: {ex}")
    if deps:
        lines.append(f"  - imports: {', '.join(d.replace('src/', '') for d in deps)}")
    if rel in imported_by:
        lines.append(f"  - used by: {', '.join(sorted(u.replace('src/', '') for u in imported_by[rel]))}")

lines += ["", "## Database (supabase/migrations)", ""]
tables = {}
for m in sorted((ROOT / "supabase" / "migrations").glob("*.sql")):
    t = m.read_text(encoding="utf-8")
    for name in re.findall(r"create table (?:if not exists )?(?:public\.)?([a-z_]+)", t, re.I):
        tables.setdefault(name, m.name)
    for name, col in re.findall(r"alter table (?:public\.)?([a-z_]+) add column (?:if not exists )?([a-z_]+)", t, re.I):
        tables.setdefault(name, m.name)
for name, mig in tables.items():
    lines.append(f"- table `{name}` (first in {mig})")

lines += ["", "## Server functions (supabase/functions)", ""]
for d in sorted((ROOT / "supabase" / "functions").iterdir()):
    idx = d / "index.ts"
    if idx.is_file():
        t = idx.read_text(encoding="utf-8")
        tools = re.findall(r"name: '([a-z_]+)',\n\s+description", t)
        actions = sorted(set(re.findall(r"body\.action === '([a-z_]+)'", t)))
        lines.append(f"- `{d.name}` ({len(t.splitlines())} lines){' - actions: ' + ', '.join(actions) if actions else ''}{' - Muna tools: ' + ', '.join(tools) if tools else ''}")
lines.append("- `recurrence.ts` exists in THREE places (src/lib, google-calendar, muna-chat): keep the copies in sync.")

(ROOT / "PROJECT_MAP.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("PROJECT_MAP.md written:", len(lines), "lines")
