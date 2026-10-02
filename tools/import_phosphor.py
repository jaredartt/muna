#!/usr/bin/env python3
"""Turns the Phosphor "fill" icons into src/data/phosphor-fill.json (the app loads that file when it needs them).

Usage (from the Muna folder):
    python3 tools/import_phosphor.py core-main.zip          # the ZIP from github.com/phosphor-icons/core (Code > Download ZIP)
    python3 tools/import_phosphor.py path/to/assets/fill    # or a folder that holds the *-fill.svg files

Phosphor is MIT licensed (https://github.com/phosphor-icons/core). Output shape:
    {"viewBox": "0 0 256 256", "icons": {"pizza": ["food dining ...", [["path", {"d": "..."}]]]}}
"""
import json, re, sys, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

TAGS = {"path", "circle", "rect", "line", "polyline", "polygon", "ellipse"}
GEOM = ["d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "width", "height", "points"]
SAFE = re.compile(r"^[A-Za-z0-9\s.,+\-()#%]*$")
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "phosphor-fill.json"


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def nodes_of(svg_text: str):
    root = ET.fromstring(svg_text)
    if local(root.tag) != "svg":
        raise ValueError("not an svg")
    vb = root.get("viewBox", "0 0 256 256")
    out = []

    def walk(el):
        for ch in el:
            t = local(ch.tag)
            if t in ("g", "svg"):
                walk(ch)
                continue
            if t not in TAGS:
                continue
            a = {}
            for k in GEOM:
                v = ch.get(k)
                if v is None:
                    continue
                v = v.strip()
                if not SAFE.match(v):
                    raise ValueError("unexpected characters in " + k)
                a[k] = v
            if t == "path" and "d" not in a:
                continue
            if ch.get("fill") == "none":  # invisible helper square
                continue
            for k in ("fill-rule", "clip-rule", "opacity", "transform"):
                v = ch.get(k)
                if v and SAFE.match(v):
                    a[k] = v.strip()
            out.append([t, a])

    walk(root)
    return vb, out


def read_tags(text: str):
    """Words for searching, from Phosphor's src/icons.ts (name, tags, categories)."""
    tags = {}
    for chunk in re.split(r'(?<![A-Za-z_])name:\s*"', text)[1:]:
        name = chunk.split('"', 1)[0]
        words = []
        m = re.search(r"tags:\s*\[(.*?)\]", chunk, re.S)
        if m:
            words += [w for w in re.findall(r'"([^"]+)"', m.group(1)) if not w.startswith("*")]
        c = re.search(r"categories:\s*\[(.*?)\]", chunk, re.S)
        if c:
            words += [w.lower().replace("_", " ") for w in re.findall(r"IconCategory\.([A-Z_]+)", c.group(1))]
        tags[name] = " ".join(dict.fromkeys(w.lower() for w in words))
    return tags


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1]).expanduser()
    svgs, tag_text = {}, ""
    if src.is_file() and src.suffix.lower() == ".zip":
        with zipfile.ZipFile(src) as z:
            for n in z.namelist():
                m = re.search(r"assets/fill/([^/]+)-fill\.svg$", n)
                if m:
                    svgs[m.group(1)] = z.read(n).decode("utf-8")
                elif re.search(r"(^|/)src/icons\.ts$", n):
                    tag_text = z.read(n).decode("utf-8")
    elif src.is_dir():
        for f in sorted(src.rglob("*.svg")):
            name = re.sub(r"-fill$", "", f.stem)
            svgs[name] = f.read_text(encoding="utf-8")
        ts = next(src.rglob("icons.ts"), None)
        if ts:
            tag_text = ts.read_text(encoding="utf-8")
    else:
        sys.exit("Could not find " + str(src))
    if not svgs:
        sys.exit("No *-fill.svg files found in " + str(src))

    tags = read_tags(tag_text) if tag_text else {}
    icons, vb, bad = {}, "0 0 256 256", []
    for name, text in sorted(svgs.items()):
        try:
            vb, nodes = nodes_of(text)
        except Exception as e:  # skip anything odd instead of breaking the build
            bad.append(f"{name}: {e}")
            continue
        if nodes:
            icons[name] = [tags.get(name) or name.replace("-", " "), nodes]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"viewBox": vb, "icons": icons}, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(icons)} icons to {OUT} ({OUT.stat().st_size // 1024} KB). Skipped {len(bad)}.")
    for b in bad[:10]:
        print("  skipped", b)
    print("With tags:", sum(1 for n in icons if n in tags), "of", len(icons))


main()
