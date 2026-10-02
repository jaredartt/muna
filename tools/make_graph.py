#!/usr/bin/env python3
"""Builds PROJECT_GRAPH.html: an interactive picture of the whole app (files, who imports whom, the database tables and the
server functions). One self-contained file: just open it in a browser.

Run from the Muna folder:   python3 tools/make_graph.py
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMPORT = re.compile(r"""(?:import|export)\s[^;]*?from\s+['"](\.[^'"]+)['"]""", re.S)
EXPORT = re.compile(r"export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|type|let)\s+([A-Za-z0-9_]+)")
TABLE = re.compile(r"\.from\('([a-z_]+)'\)")
RPC = re.compile(r"\.rpc\('([a-z_]+)'")
INVOKE = re.compile(r"functions\.invoke\('([a-z\-]+)'")


def resolve(base: Path, rel: str):
    p = (base.parent / rel).resolve()
    for cand in (p, p.with_suffix(".ts"), p.with_suffix(".tsx"), p / "index.ts", p / "index.tsx"):
        if cand.is_file():
            return cand.relative_to(ROOT).as_posix()
    return None


nodes, links = {}, []


def add_node(id_, label, group, **kw):
    nodes.setdefault(id_, {"id": id_, "label": label, "group": group, **kw})


files = sorted(p for p in (ROOT / "src").rglob("*") if p.suffix in (".ts", ".tsx"))
for f in files:
    rel = f.relative_to(ROOT).as_posix()
    parts = rel.split("/")
    group = parts[1] if len(parts) > 2 else "app"
    text = f.read_text(encoding="utf-8")
    add_node(rel, f.stem, group, path=rel, lines=len(text.splitlines()), exports=EXPORT.findall(text)[:12])

for f in files:
    rel = f.relative_to(ROOT).as_posix()
    text = f.read_text(encoding="utf-8")
    for m in set(IMPORT.findall(text)):
        r = resolve(f, m)
        if r and r in nodes:
            links.append({"s": rel, "t": r, "kind": "imports"})
    for t in set(TABLE.findall(text)):
        links.append({"s": rel, "t": "table:" + t, "kind": "reads"})
    for r in set(RPC.findall(text)):
        links.append({"s": rel, "t": "rpc:" + r, "kind": "calls"})
    for fn in set(INVOKE.findall(text)):
        links.append({"s": rel, "t": "fn:" + fn, "kind": "calls"})

for m in sorted((ROOT / "supabase" / "migrations").glob("*.sql")):
    t = m.read_text(encoding="utf-8")
    for name in re.findall(r"create table (?:if not exists )?(?:public\.)?([a-z_]+)", t, re.I):
        add_node("table:" + name, name, "database", path=m.name, lines=0, exports=[])
    for name in re.findall(r"create (?:or replace )?function (?:public\.)?([a-z_]+)", t, re.I):
        add_node("rpc:" + name, name + "()", "rpc", path=m.name, lines=0, exports=[])

for d in sorted((ROOT / "supabase" / "functions").iterdir()):
    idx = d / "index.ts"
    if not idx.is_file():
        continue
    text = idx.read_text(encoding="utf-8")
    fid = "fn:" + d.name
    add_node(fid, d.name, "server", path=idx.relative_to(ROOT).as_posix(), lines=len(text.splitlines()), exports=[])
    for t in set(TABLE.findall(text)):
        links.append({"s": fid, "t": "table:" + t, "kind": "reads"})
    for r in set(RPC.findall(text)):
        links.append({"s": fid, "t": "rpc:" + r, "kind": "calls"})

# keep only links whose both ends exist (e.g. a table used by the app but created by hand)
ids = set(nodes)
for l in links:
    for end in ("s", "t"):
        if l[end] not in ids:
            k, _, name = l[end].partition(":")
            if k in ("table", "rpc"):
                add_node(l[end], name + ("()" if k == "rpc" else ""), "database" if k == "table" else "rpc", path="", lines=0, exports=[])
            ids = set(nodes)
links = [l for l in links if l["s"] in ids and l["t"] in ids]
seen, uniq = set(), []
for l in links:
    k = (l["s"], l["t"])
    if k not in seen:
        seen.add(k)
        uniq.append(l)

data = {"nodes": list(nodes.values()), "links": uniq}
html = (Path(__file__).parent / "graph_template.html").read_text(encoding="utf-8").replace("/*DATA*/null", json.dumps(data, ensure_ascii=False))
(ROOT / "PROJECT_GRAPH.html").write_text(html, encoding="utf-8")
print("PROJECT_GRAPH.html written:", len(data["nodes"]), "nodes,", len(data["links"]), "links")
