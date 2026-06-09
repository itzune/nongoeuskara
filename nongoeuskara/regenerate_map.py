#!/usr/bin/env python3
"""
Generate a remapped map.svg where <g> layers match our 12 tier-3 model labels.

Strategy:
1. Known 1:1 mappings: Zuberoa→zuberera, Lapurdi→naflap-sartaldea, 
   Naf.Beherea→naflap-sortaldea, Burunda→nafar-hego-sartaldea,
   Zaraitzu+Erronkari→ekialde-nafarra, Baztan→nafar-sortaldea
2. Split layers (Mendebalde, Erdialde, Nafarroa Garaia):
   Use Ahotsak town assignments to label individual polygons where town
   names match, keeping unnamed polygons under the parent zone.
"""

import xml.etree.ElementTree as ET
import json
import re
import shutil

SRC = "map_original.svg"
DST = "map.svg"
AHOTSAK_JSON = "/home/xezpeleta/Dev/itzune/zeineuski/data/reference/ahotsak_azpieuskalki_towns.json"

NS_INKSCAPE = "http://www.inkscape.org/namespaces/inkscape"

# Ahotsak → model label mapping
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

# SVG layer → model label (direct mapping for unambiguous layers)
LAYER_TO_MODEL = {
    "Zuberoa":                 "zuberera",
    "Mendebalde":              "mendebal-sartaldea",  # will be refined per-town
    "Erdialde":                "erdialde-sartaldea",   # will be refined per-town
    "Lapurdi":                 "naflap-sartaldea",
    "Nafarroa Beherea":        "naflap-sortaldea",
    "Baztan":                  "nafar-sortaldea",
    "Iparraldeko Nafarroa Garaia": "nafar-ipar-sartaldea",  # will be refined per-town
    "Burunda":                 "nafar-hego-sartaldea",
    "Hegoaldeko Nafarroa Garaia": "nafar-erdigunea",  # will be refined per-town
    "Zaraitzu":                "ekialde-nafarra",
    "Erronkari":               "ekialde-nafarra",
    "Aezkoa":                  "nafar-sortaldea",
}

# Legend colors for each model label
MODEL_COLORS = {
    "mendebal-sartaldea":   "#8b5cf6",
    "mendebal-sortaldea":   "#7c3aed",
    "erdialde-sartaldea":   "#06b6d4",
    "erdialde-sortaldea":   "#0ea5e9",
    "nafar-ipar-sartaldea": "#f59e0b",
    "nafar-erdigunea":      "#10b981",
    "nafar-hego-sartaldea": "#84cc16",
    "nafar-sortaldea":      "#f97316",
    "naflap-sartaldea":     "#ec4899",
    "naflap-sortaldea":     "#d946ef",
    "zuberera":             "#14b8a6",
    "ekialde-nafarra":      "#ef4444",
}

# Display names
MODEL_NAMES = {
    "mendebal-sartaldea":   "Mendebal-sartaldea",
    "mendebal-sortaldea":   "Mendebal-sortaldea",
    "erdialde-sartaldea":   "Erdialde-sartaldea",
    "erdialde-sortaldea":   "Erdialde-sortaldea",
    "nafar-ipar-sartaldea": "Nafar ipar-sartaldea",
    "nafar-erdigunea":      "Nafar erdigunea",
    "nafar-hego-sartaldea": "Nafar hego-sartaldea",
    "nafar-sortaldea":      "Nafar sortaldea",
    "naflap-sartaldea":     "Nafar-lapur sartaldea",
    "naflap-sortaldea":     "Nafar-lapur sortaldea",
    "zuberera":             "Zuberera",
    "ekialde-nafarra":      "Ekialdeko nafarra",
}

def normalize(name):
    """Normalize town name for matching."""
    name = name.lower().strip()
    name = name.replace('á','a').replace('é','e').replace('í','i').replace('ó','o')
    name = name.replace('ú','u').replace('ü','u').replace('ñ','n').replace('â','a')
    return name

def build_town_lookup():
    """Build: normalized town name → model label."""
    with open(AHOTSAK_JSON) as f:
        data = json.load(f)
    lookup = {}
    for ahotsak_label, towns in data.items():
        model_label = AHOTSAK_TO_MODEL[ahotsak_label]
        for town in towns:
            town = town.replace('\\u002D', '-')
            lookup[normalize(town)] = model_label
    return lookup

def match_town_to_model(svg_name, town_lookup):
    """Match SVG town name to model label. Handles bilingual names like 'Auritz/Burguete'."""
    if not svg_name:
        return None

    # Try full name
    n = normalize(svg_name)
    if n in town_lookup:
        return town_lookup[n]

    # Handle bilingual names: "Aoiz/Agoitz", "Auritz/Burguete"
    if '/' in n:
        for part in n.split('/'):
            part = part.strip()
            if part in town_lookup:
                return town_lookup[part]

    # Handle parenthetical: "Noáin (Valle de Elorz)/Noain (Elortzibar)"
    cleaned = re.sub(r'\([^)]*\)', '', n).strip()
    cleaned = re.sub(r'\s+', ' ', cleaned)
    if '/' in cleaned:
        for part in cleaned.split('/'):
            part = part.strip()
            if part in town_lookup:
                return town_lookup[part]
    elif cleaned in town_lookup:
        return town_lookup[cleaned]

    return None

def get_town_name(path, all_groups):
    """Extract town name from a path or its parent <g>."""
    pid = path.attrib.get('id', '')
    if pid and not pid.startswith('path') and pid != 'false':
        return pid
    # Check parent <g> id
    parent = None
    for g in all_groups:
        for child in g:
            if child is path or child == path:
                parent = g
                break
        if parent:
            break
    if parent is not None:
        gid = parent.attrib.get('id', '')
        if gid and not gid.startswith('g') and not gid.startswith('layer'):
            return gid
    return None

def main():
    # Load Ahotsak town→model mapping
    town_lookup = build_town_lookup()
    print(f"Loaded {len(town_lookup)} towns → model label mapping")

    # Copy original first time
    if SRC not in ("map_original.svg",):
        if not ET.parse(SRC):  # test parse
            print(f"Keep existing {SRC}")
        # Ensure we have a copy of original
        import os
        if not os.path.exists("map_original.svg"):
            shutil.copy(DST, "map_original.svg")
            print("Saved map_original.svg")

    # Parse SVG with namespace support
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    ET.register_namespace("inkscape", NS_INKSCAPE)
    ET.register_namespace("sodipodi", "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd")
    ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")

    tree = ET.parse(SRC)
    root = tree.getroot()

    # Ensure viewBox
    if not root.attrib.get("viewBox"):
        min_x, min_y, max_x, max_y = float("inf"), float("inf"), -float("inf"), -float("inf")
        for path in root.iter():
            if not path.tag.endswith("path"):
                continue
            d = path.attrib.get("d", "")
            coords = [float(n) for n in re.findall(r"[-]?\d+\.?\d*", d)]
            for i in range(0, len(coords) - 1, 2):
                x, y = coords[i], coords[i + 1]
                min_x, min_y = min(min_x, x), min(min_y, y)
                max_x, max_y = max(max_x, x), max(max_y, y)
        padding = 20
        root.attrib["viewBox"] = f"{min_x - padding} {min_y - padding} {max_x - min_x + 2*padding} {max_y - min_y + 2*padding}"

    root.attrib["width"] = "100%"
    root.attrib["height"] = "100%"
    root.attrib["preserveAspectRatio"] = "xMidYMid meet"

    # Collect all <g> elements for parent lookup
    all_groups = list(root.iter())
    all_groups = [g for g in all_groups if g.tag.endswith('g')]

    # Stats
    total_matched = 0
    total_unmatched = 0
    per_layer = {}

    # Process each layer
    for layer_group in root.iter():
        layer_label = layer_group.attrib.get(f"{{{NS_INKSCAPE}}}label", "")
        if layer_label not in LAYER_TO_MODEL:
            continue

        default_model_label = LAYER_TO_MODEL[layer_label]
        seen_labels = set()
        matched_in_layer = 0
        unmatched_in_layer = 0

        # Process all paths in this layer
        for path in layer_group.iter():
            if not path.tag.endswith('path'):
                continue

            town_name = get_town_name(path, all_groups)
            if town_name:
                model_label = match_town_to_model(town_name, town_lookup)
                if model_label:
                    path.attrib["data-model-label"] = model_label
                    seen_labels.add(model_label)
                    matched_in_layer += 1
                else:
                    unmatched_in_layer += 1
            else:
                unmatched_in_layer += 1

        total_matched += matched_in_layer
        total_unmatched += unmatched_in_layer
        
        # Set layer-level default model label
        layer_group.attrib["data-model-label"] = default_model_label
        per_layer[layer_label] = {
            "default": default_model_label,
            "matched": matched_in_layer,
            "unmatched": unmatched_in_layer,
            "labels_found": seen_labels,
        }

    # Print stats
    print(f"\nMatched paths: {total_matched}")
    print(f"Unmatched paths: {total_unmatched}")
    print(f"\nPer-layer breakdown:")
    for layer_label in sorted(per_layer.keys()):
        info = per_layer[layer_label]
        extra = f" (found: {', '.join(sorted(info['labels_found']))})" if info['labels_found'] else ""
        print(f"  {layer_label}: default={info['default']}, matched={info['matched']} paths{extra}")

    # Write
    tree.write(DST, encoding="utf-8", xml_declaration=True)
    import os
    size_kb = os.path.getsize(DST) / 1024
    print(f"\nWrote {DST} ({size_kb:.0f} KB)")

if __name__ == "__main__":
    main()
