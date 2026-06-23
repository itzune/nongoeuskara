#!/usr/bin/env python3
"""
Build a simplified, merged GeoJSON for the D3-based v2 map.

Produces v2/public/euskal-herria.json — one FeatureCollection where every
municipality feature carries:
  - name:      Basque display name
  - label:     azpieuskalki model label (or null)
  - province:  province code
  - euskalki:  parent tier-2 dialect (or null)

Run from the v2/build directory:
  python3 build_geojson.py
"""

import json
import math
import re
import unicodedata
from pathlib import Path

import shapely
from shapely.geometry import shape
from shapely.ops import unary_union

HERE = Path(__file__).parent
BUILD_DIR = Path("/home/xezpeleta/Dev/itzune/nongoeuskara/nongoeuskara/build")
OUT_FILE = HERE.parent / "public" / "euskal-herria.json"
AHOTSAK_JSON = Path("/home/xezpeleta/Dev/itzune/zeineuski/data/reference/ahotsak_azpieuskalki_towns.json")

SIMPLIFY_TOLERANCE_DEG = 0.003  # ~1 px at 1000px width

AHOTSAK_TO_MODEL = {
    "sartaldekoa-m": "mendebal-sartaldea",
    "sortaldekoa-m": "mendebal-sortaldea",
    "tartekoa-m": "mendebal-sortaldea",
    "erdigunekoa-g": "erdialde-sartaldea",
    "sartaldekoa-g": "erdialde-sartaldea",
    "sortaldekoa-g": "erdialde-sortaldea",
    "baztangoa": "nafar-sortaldea",
    "erdigunekoa-n": "nafar-erdigunea",
    "hegoaldeko-nafarra": "nafar-erdigunea",
    "hego-sartaldekoa": "nafar-hego-sartaldea",
    "ipar-sartaldekoa": "nafar-ipar-sartaldea",
    "sortaldekoa-n": "nafar-sortaldea",
    "erdigunekoa-nl": "naflap-sartaldea",
    "sartaldekoa-nl": "naflap-sartaldea",
    "sortaldekoa-nl": "naflap-sortaldea",
    "basaburua": "zuberera",
    "pettarrakoa": "zuberera",
    "zaraitzukoa": "ekialde-nafarra",
    "erronkarikoa": "ekialde-nafarra",
}

MANUAL_ALIASES = {
    "villabona amasa": "amasa villabona",
    "esparza de salazar": "espartza zaraitzu",
    "espartza": "espartza zaraitzu",
    "montori": "montori berorize",
    "oiz": "oitz",
    "isturits": "izturitze",
}

CODE_OVERRIDES = {
    "64249": "getaria (l)",
    "64283": "jatsu garazi",
    "64327": "lekunberri (nb)",
    "01028": None,
    "31083": None,
}

# Tier-2 euskalki for each tier-3 label
EUSKALKI_OF = {
    "mendebal-sartaldea": "bizkaiera",
    "mendebal-sortaldea": "bizkaiera",
    "erdialde-sartaldea": "gipuzkera",
    "erdialde-sortaldea": "gipuzkera",
    "nafar-ipar-sartaldea": "nafarrera",
    "nafar-erdigunea": "nafarrera",
    "nafar-hego-sartaldea": "nafarrera",
    "nafar-sortaldea": "nafarrera",
    "naflap-sartaldea": "nafar-lapurtera",
    "naflap-sortaldea": "nafar-lapurtera",
    "zuberera": "zuberera",
    "ekialde-nafarra": "ekialde-nafarra",
}


def normalize(name: str) -> str:
    name = name.replace("\\u002D", "-").replace("-", " ")
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = name.lower().strip()
    name = re.sub(r"\s+", " ", name)
    return name


def name_variants(raw: str):
    n = normalize(raw)
    yield n
    for sep in ("/", "<>"):
        if sep in n:
            for part in n.split(sep):
                part = part.strip()
                if part:
                    yield part
    cleaned = re.sub(r"\([^)]*\)", "", n)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if cleaned and cleaned != n:
        yield cleaned
        if "/" in cleaned:
            for part in cleaned.split("/"):
                part = part.strip()
                if part:
                    yield part


def load_wikidata_labels(path: Path, code_key: str) -> dict:
    data = json.loads(path.read_text())
    out = {}
    for b in data["results"]["bindings"]:
        code = b[code_key]["value"]
        label = b["eulabel"]["value"]
        out.setdefault(code, []).append(label)
    return out


def build_town_lookup() -> dict:
    data = json.loads(AHOTSAK_JSON.read_text())
    lookup = {}
    for ahotsak_label, towns in data.items():
        model = AHOTSAK_TO_MODEL[ahotsak_label]
        for town in towns:
            lookup[normalize(town)] = model
    return lookup


def load_municipalities():
    ine_labels = load_wikidata_labels(BUILD_DIR / "wikidata-ine-eu.json", "ine")
    insee_labels = load_wikidata_labels(BUILD_DIR / "wikidata-insee-eu.json", "insee")

    muns = []

    for fname, src in [
        ("municipios-eae.geojson", "ine"),
        ("municipios-nafarroa.geojson", "ine"),
        ("municipios-trebinu.geojson", "ine"),
    ]:
        data = json.loads((BUILD_DIR / fname).read_text())
        for feat in data["features"]:
            props = feat["properties"]
            if props.get("mun_type") != "municipality":
                continue
            names = [props["mun_name"]]
            if props.get("mun_name_local"):
                names.append(props["mun_name_local"])
            province = "01" if props["prov_code"] == "09" else props["prov_code"]
            muns.append({
                "code": props["mun_code"],
                "official_name": props["mun_name"],
                "names": names,
                "province": province,
                "geometry": feat["geometry"],
                "source": src,
            })

    data = json.loads((BUILD_DIR / "communes-64.geojson").read_text())
    for feat in data["features"]:
        props = feat["properties"]
        muns.append({
            "code": props["code"],
            "official_name": props["nom"],
            "names": [props["nom"]],
            "province": "64",
            "geometry": feat["geometry"],
            "source": "insee",
        })

    return muns, ine_labels, insee_labels


def main():
    town_lookup = build_town_lookup()

    muns, ine_labels, insee_labels = load_municipalities()
    print(f"Loaded {len(muns)} municipalities")

    # Match to model labels and display names
    features = []
    for m in muns:
        code_labels = (ine_labels if m["source"] == "ine" else insee_labels).get(m["code"], [])
        candidates = code_labels + m["names"]

        label = None
        if m["code"] in CODE_OVERRIDES:
            override = CODE_OVERRIDES[m["code"]]
            if override:
                label = town_lookup.get(override)
        else:
            for raw in candidates:
                for variant in name_variants(raw):
                    variant = MANUAL_ALIASES.get(variant, variant)
                    if variant in town_lookup:
                        label = town_lookup[variant]
                        break
                if label:
                    break

        # Iparralde: keep only matched communes
        if m["province"] == "64" and not label:
            continue

        # Display name: prefer Wikidata eu label
        display = code_labels[0] if code_labels else m["official_name"]
        display = re.sub(r"\s*\([^)]*\)\s*$", "", display).strip()

        features.append({
            "type": "Feature",
            "geometry": m["geometry"],
            "properties": {
                "name": display,
                "label": label,
                "province": m["province"],
                "euskalki": EUSKALKI_OF.get(label) if label else None,
            },
        })

    labelled = sum(1 for f in features if f["properties"]["label"])
    print(f"Features: {len(features)} total, {labelled} labelled")

    # Topology-preserving simplification
    geoms = [shape(f["geometry"]) for f in features]
    simplified = list(shapely.coverage_simplify(geoms, SIMPLIFY_TOLERANCE_DEG))

    # Replace geometries with simplified ones
    for f, g in zip(features, simplified):
        f["geometry"] = shapely.geometry.mapping(g)

    # Write output
    fc = {"type": "FeatureCollection", "features": features}
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(fc, ensure_ascii=False))
    size_kb = OUT_FILE.stat().st_size / 1024
    print(f"Wrote {OUT_FILE} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
