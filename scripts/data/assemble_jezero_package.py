"""Assemble a local DeadHack demo package from the checked Jezero crops."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import shutil
from urllib.request import urlopen

from PIL import Image


PHOTO_URL = "https://d2pn8kiwq2w21t.cloudfront.net/original_images/jpegPIA25325.jpg"
PHOTO_PAGE = "https://www.jpl.nasa.gov/images/pia25325-enchanted-view-of-jezero-rocks/"
PHOTO_HASH = "27a7426240262f22ad029fa4127e0d26bafe35ca92eb44aa7261c181b4003ba1"
MEDA_REPORT = "https://www.jpl.nasa.gov/news/nasas-first-weather-report-from-jezero-crater-on-mars/"
GEOMETRY_COMMENT = "https://github.com/OriolPalacios/memorias-deadhack/pull/10#issuecomment-6901693527"
FORMAT_COMMENT = "https://github.com/OriolPalacios/memorias-deadhack/pull/10#issuecomment-6902087995"


def read_json(path):
    return json.loads(path.read_bytes())


def write_json(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def asset(path, fmt):
    data = path.read_bytes()
    return {"path": path.name, "format": fmt, "byteLength": len(data), "sha256": sha256(data).hexdigest()}


def photo(args):
    original = args.cache / "PIA25325.jpg"
    if not original.is_file():
        with urlopen(PHOTO_URL, timeout=25) as response:
            data = response.read(3_000_001)
        if sha256(data).hexdigest() != PHOTO_HASH:
            raise ValueError("JPL photograph differs from the recorded original")
        args.cache.mkdir(parents=True, exist_ok=True)
        original.write_bytes(data)
    if sha256(original.read_bytes()).hexdigest() != PHOTO_HASH:
        raise ValueError("Cached JPL photograph differs from the recorded original")
    output = args.out / "pia25325.jpg"
    with Image.open(original) as img:
        if img.format != "JPEG" or img.size != (5120, 2880):
            raise ValueError("Unexpected source photograph")
        scaled = img.convert("RGB")
        scaled.thumbnail((1600, 900), Image.Resampling.LANCZOS)
        scaled.save(output, format="JPEG", quality=85, optimize=True)
    return asset(output, "jpeg")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--geometry", required=True, type=Path)
    parser.add_argument("--cache", required=True, type=Path)
    parser.add_argument("--thermal", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--evidence-out", required=True, type=Path)
    args = parser.parse_args()
    geo = read_json(args.geometry)
    ground = read_json(args.out / "ground-validation.json")
    ir = read_json(args.thermal / "thermal-evidence.json")
    version = geo["geometryVersion"]
    if (
        ground["geometryVersion"] != version
        or ir["geometryVersion"] != version
        or ground["geometryInputSha256"] != sha256(args.geometry.read_bytes()).hexdigest()
        or ir["targetCrs"] != geo["frame"]["projection"]
        or len(ground["movements"]) != 5
        or not all(x["coverageVerified"] for x in ground["movements"])
    ):
        raise ValueError("Ground and thermal provenance must match the confirmed geometry")

    height = asset(args.out / "height.f32", "float32-le")
    mask = asset(args.out / "height-mask.u8", "uint8")
    if height["byteLength"] != 4 * ground["derivedTotal"] or mask["byteLength"] != ground["derivedTotal"]:
        raise ValueError("Ground files do not match the confirmed grid")
    thermal_png = args.thermal / "thermal.png"
    thermal = ir["thermal"]
    if asset(thermal_png, "png-rgba8") != thermal["asset"] or thermal["grid"]["extentM"] != ground["extentM"]:
        raise ValueError("Thermal file/extent does not match its evidence")
    with Image.open(thermal_png) as img:
        if img.mode != "RGBA" or img.size != (thermal["grid"]["width"], thermal["grid"]["height"]):
            raise ValueError("Unexpected thermal RGBA dimensions")
        observed_alpha = list(img.getchannel("A").tobytes())
        expected_alpha = [alpha for row in ir["alphaNorthToSouth"] for alpha in row]
        if observed_alpha != expected_alpha:
            raise ValueError("Thermal alpha differs from signed row order in evidence")
    shutil.copyfile(thermal_png, args.out / "thermal.png")

    frame = {**geo["frame"], "verticalDatum": ground["source"]["verticalDatum"]}
    terrain_id = "jezero-dem-20261115-v1"
    terrain = {
        "contract": "terrain/v1", "id": terrain_id, "scenarioAsset": "scenario.json",
        "frame": frame, "grid": {**geo["gridProposal"]["terrain"], "extentM": ground["extentM"]},
        "heightAsset": height, "heightMaskAsset": mask, "heightSourceId": "hirise-jezero",
        "elevationLegend": {"unit": "m", "minM": ground["heightRangeM"][0], "maxM": ground["heightRangeM"][1]},
        "coverage": {"validSamples": ground["derivedValid"], "totalSamples": ground["derivedTotal"]},
        "textureAsset": None, "thermal": thermal,
        "sources": [
            {
                "id": "hirise-jezero", "kind": "hirise-dtm", **ground["source"],
                "mission": "Mars Reconnaissance Orbiter", "instrument": "HiRISE",
                "credit": "NASA / JPL-Caltech / University of Arizona",
                "referenceUrl": "https://hirise.lpl.arizona.edu/dtm/PSP_002387_1985",
            },
            ir["source"],
        ],
    }
    stops = []
    for stop in geo["stops"]:
        science = stop["id"] == "science"
        stops.append({**stop, "evidenceId": "science-photo" if science else None, "contextIds": ["meda-pressure"] if science else []})
    scenario = {
        "contract": "scenario/v1", "id": "una-parada-mas-jezero-v1", "terrainId": terrain_id,
        "frameId": frame["id"], "geometryVersion": version,
        "budgetMin": geo["budgetMin"], "reserveMin": geo["reserveMin"],
        "base": geo["base"], "stops": stops, "routes": geo["routes"], "shared": geo["shared"],
        "evidence": [{
            "id": "science-photo", "kind": "rover-image", "productId": "PIA25325",
            "asset": photo(args), "credit": "NASA/JPL-Caltech",
            "captureDate": "2022-04-30", "captureSol": 424, "captureLocation": None,
            "sourceUrl": PHOTO_PAGE, "missingReason": "exact_capture_location_unverified",
            "note": "Mageik sitúa la parada simulada. La ubicación exacta de la Hazcam sigue pendiente de verificar.",
        }],
        "contextCards": [{
            "id": "meda-pressure", "kind": "historical-observation", "site": "Cráter Jezero, Marte",
            "dateUtc": None, "dateLabel": "19 de febrero de 2021 según JPL", "sol": None,
            "credit": "NASA/JPL-Caltech · Perseverance MEDA", "sourceUrl": MEDA_REPORT,
            "variables": [{"name": "presión atmosférica", "value": 718, "unit": "Pa"}],
        }],
    }
    write_json(args.out / "terrain.json", terrain)
    write_json(args.out / "scenario.json", scenario)
    args.evidence_out.mkdir(parents=True, exist_ok=True)
    write_json(args.evidence_out / "jezero-v1-ground-validation.json", {
        **ground, "geometryIssueComment": GEOMETRY_COMMENT, "formatIssueComment": FORMAT_COMMENT,
        "thermalSummary": {key: ir[key] for key in (
            "sourcePixelWindow", "sourceRanges", "dnNorthToSouth", "alphaNorthToSouth", "maxSourceCenterDistanceM"
        )}, "semantics": "Coverage of simulated geometry on source elevations and derived mesh. No EVA safety conclusion.",
    })
    (args.out / "ground-validation.json").unlink()
    expected_files = ["terrain.json", "scenario.json", "height.f32", "height-mask.u8", "thermal.png", "pia25325.jpg"]
    total = sum((args.out / filename).stat().st_size for filename in expected_files)
    print(f"Package ready: {len(expected_files)} runtime files, {total} bytes")


if __name__ == "__main__":
    main()
