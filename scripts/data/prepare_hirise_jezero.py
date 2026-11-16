"""Prepare and check the HiRISE grid for DeadHack's agreed Jezero scenario."""
import argparse
from hashlib import sha256
import json
import math
from pathlib import Path
import re
from urllib.request import Request, urlopen

import numpy as np


PRODUCT = "DTEEC_002387_1985_003798_1985_A01"
SOURCE = (
    "https://www.uahirise.org/PDS/DTM/PSP/ORB_002300_002399/"
    "PSP_002387_1985_PSP_003798_1985/" + PRODUCT + ".IMG"
)
GEOMETRY_VERSION = "jezero-geometry-proposal-20261115-1"
SOURCE_DATUM = "Mars areoid adjusted to MOLA, preserved from the HiRISE DTM"


def range_bytes(cache, first, last):
    dest = cache / f"{PRODUCT}.{first}-{last}.bin"
    size = last - first + 1
    if dest.is_file() and dest.stat().st_size == size:
        return dest.read_bytes()
    headers = {"Range": f"bytes={first}-{last}", "Accept-Encoding": "identity"}
    for attempt in range(3):
        try:
            with urlopen(Request(SOURCE, headers=headers), timeout=35) as response:
                expected = f"bytes {first}-{last}/"
                if response.status != 206 or not response.headers.get("Content-Range", "").startswith(expected):
                    raise ValueError(f"Unexpected range response for {first}-{last}")
                data = response.read(size + 1)
            if len(data) != size:
                raise ValueError(f"Expected {size} bytes for {first}-{last}, got {len(data)}")
            cache.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            return data
        except OSError:
            if attempt == 2:
                raise


def load_label(cache):
    path = cache / f"{PRODUCT}.lbl"
    if path.is_file():
        label = path.read_bytes()
    else:
        header = range_bytes(cache, 0, 65535)
        end = re.search(rb"^END[ \t]*\r?\n", header, re.M)
        if not end:
            raise ValueError("PDS3 label END was absent from the header")
        label = header[:end.end()]
        path.write_bytes(label)
    if not all(s in label for s in (PRODUCT.encode(), b"PC_REAL", b"EQUIRECTANGULAR", b"PLANETOCENTRIC")):
        raise ValueError("Unexpected HiRISE label")
    return label


def numeric_label(label, key):
    text = label.decode("ascii")
    match = re.search(r"^\s*" + re.escape(key) + r"\s*=\s*([-0-9.]+)", text, re.M)
    if not match:
        raise ValueError(f"PDS label lacks {key}")
    return float(match.group(1))


def geometry_parameters(geometry):
    if geometry["geometryVersion"] != GEOMETRY_VERSION:
        raise ValueError("Geometry version must be reviewed before preparing another scenario")
    frame = geometry["frame"]
    if frame["sceneOriginProjectedM"] != [0, 0]:
        raise ValueError("This geometry expects the agreed scene origin")
    tokens = dict(re.findall(r"\+(\w+)=([^\s]+)", frame["projection"]))
    if tokens["proj"] != "eqc" or float(tokens["x_0"]) != 0 or float(tokens["y_0"]) != 0:
        raise ValueError("Expected zero-offset spherical EQC")
    target = {key: float(tokens[key]) for key in ("R", "lat_ts", "lat_0", "lon_0")}
    return target


def check_movements(geometry, bounds, native_full, derived_full):
    objects = {p["id"]: p["xzM"] for p in [geometry["base"], *geometry["stops"]]}
    moves = [r["outbound"] for r in geometry["routes"]]
    moves += [geometry["shared"][name] for name in ("extra", "returnAfterExtra", "direct")]
    limit = geometry["coverageProposal"]
    radius = limit["bufferRadiusM"]
    x0, z0, x1, z1 = bounds
    checked = []
    for move in moves:
        route = move["pathXzM"]
        if len(route) < 2 or not all(math.isfinite(axis) for point in route for axis in point):
            raise ValueError(f'Invalid polyline {move["eventId"]}')
        endpoint = max(math.dist(route[0], objects[move["fromId"]]), math.dist(route[-1], objects[move["toId"]]))
        minimum = min(min(x - x0, x1 - x, z - z0, z1 - z) for x, z in route) - radius
        report = {
            "eventId": move["eventId"],
            "lengthM": round(sum(math.dist(a, b) for a, b in zip(route, route[1:])), 6),
            "maxEndpointErrorM": endpoint,
            "corridorMarginToMeshM": round(minimum, 6),
        }
        report["coverageVerified"] = bool(
            native_full and derived_full and minimum >= 0 and endpoint <= limit["endpointToleranceM"]
        )
        if not report["coverageVerified"]:
            report["status"] = "Coverage needs an intersection check or a geometry correction"
        checked.append(report)
    return checked


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--geometry", required=True, type=Path)
    parser.add_argument("--cache", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    geometry_bytes = args.geometry.read_bytes()
    g = json.loads(geometry_bytes)
    target = geometry_parameters(g)
    label = load_label(args.cache)
    field = lambda key: numeric_label(label, key)
    w, south, east, north = g["gridProposal"]["extentM"]
    width, height = (g["gridProposal"]["terrain"][key] for key in ("width", "height"))
    dx, dy = (east - w) / width, (north - south) / height
    radius = field("A_AXIS_RADIUS") * 1000
    if len({field(f"{axis}_AXIS_RADIUS") for axis in "ABC"}) != 1:
        raise ValueError("HiRISE label is not spherical")
    scale = field("MAP_SCALE")
    source_cos = math.cos(math.radians(field("CENTER_LATITUDE")))
    target_cos = math.cos(math.radians(target["lat_ts"]))
    source_lon0 = field("CENTER_LONGITUDE")
    source_col_offset, source_row_offset = field("SAMPLE_PROJECTION_OFFSET"), field("LINE_PROJECTION_OFFSET")
    source_width, source_height = int(field("LINE_SAMPLES")), int(field("LINES"))
    bytes_per_row = int(field("RECORD_BYTES"))
    if field("SAMPLE_BITS") != 32 or bytes_per_row != 4 * source_width or field("MAP_PROJECTION_ROTATION") != 0:
        raise ValueError("Unexpected HiRISE sample layout")
    # Compare all four label bounds before using this product's offset convention.
    expected_w = source_lon0 - math.degrees(source_col_offset * scale / (radius * source_cos))
    expected_e = source_lon0 + math.degrees((source_width - source_col_offset) * scale / (radius * source_cos))
    expected_n = math.degrees(source_row_offset * scale / radius)
    expected_s = math.degrees((source_row_offset - source_height) * scale / radius)
    bounds = {"WESTERNMOST_LONGITUDE": expected_w, "EASTERNMOST_LONGITUDE": expected_e,
              "MAXIMUM_LATITUDE": expected_n, "MINIMUM_LATITUDE": expected_s}
    if any(abs(field(k) - v) > math.degrees(2 * scale / radius) for k, v in bounds.items()):
        raise ValueError("Calculated HiRISE edges disagree with the PDS label")

    def col(lon):
        return radius * source_cos * np.deg2rad(lon - source_lon0) / scale + source_col_offset

    def row(lat):
        return source_row_offset - radius * np.deg2rad(lat) / scale

    def lon_at(easting):
        return target["lon_0"] + np.rad2deg(easting / (target["R"] * target_cos))

    def lat_at(northing):
        return target["lat_0"] + np.rad2deg(northing / target["R"])

    left, right = map(math.floor, col(lon_at(np.array([w, east]))))
    top, bottom = map(math.floor, row(lat_at(np.array([north, south]))))
    if not (0 <= left <= right < source_width and 0 <= top <= bottom < source_height):
        raise ValueError("The agreed extent is partly outside the native raster")
    first = (int(field("^IMAGE")) - 1 + top) * bytes_per_row
    last = first + (bottom - top + 1) * bytes_per_row - 1
    raw = range_bytes(args.cache, first, last)
    bits = np.frombuffer(raw, dtype="<u4").reshape(bottom - top + 1, source_width)[:, left:right + 1]
    values = bits.view("<f4")
    nodata_hex = re.search(rb"^ *MISSING_CONSTANT\s*=\s*16#([0-9A-F]+)#", label, re.M).group(1)
    scale_factor, offset = field("SCALING_FACTOR"), field("OFFSET")
    native_mask = (bits != int(nodata_hex, 16)) & np.isfinite(values)
    src_cols = np.floor(col(lon_at(w + (np.arange(width) + .5) * dx))).astype(int) - left
    src_rows = np.floor(row(lat_at(north - (np.arange(height) + .5) * dy))).astype(int) - top
    derived_mask = native_mask[np.ix_(src_rows, src_cols)]
    derived = np.zeros(derived_mask.shape, dtype="<f4")
    sample_values = values[np.ix_(src_rows, src_cols)]
    derived[derived_mask] = sample_values[derived_mask] * scale_factor + offset
    if not np.isfinite(derived[derived_mask]).all():
        raise ValueError("Export contains non-finite valid heights")

    controls = []
    for p in g["stops"]:
        longitude, latitude = p["anchorLonLat"]
        x = math.radians(longitude - target["lon_0"]) * target["R"] * target_cos
        z = -math.radians(latitude - target["lat_0"]) * target["R"]
        error = math.dist((x, z), p["xzM"])
        if error > g["coverageProposal"]["horizontalControlToleranceM"]:
            raise ValueError(f'Scene anchor mismatch: {p["id"]}')
        c, r = math.floor(col(longitude)), math.floor(row(latitude))
        dc, dr = math.floor((x - w) / dx), math.floor((north + z) / dy)
        valid = bool(native_mask[r - top, c - left] and derived_mask[dr, dc])
        if not valid:
            raise ValueError(f'Missing native/derived elevation at {p["id"]}')
        controls.append({
            "id": p["anchorControl"], "lonLat": p["anchorLonLat"], "xzM": p["xzM"],
            "horizontalErrorM": round(error, 6), "nativeColRow": [c, r],
            "nativeHeightM": float(values[r-top, c-left] * scale_factor + offset),
            "derivedColRow": [dc, dr], "derivedHeightM": float(derived[dr, dc]),
        })

    mesh_bounds = [w + dx / 2, -north + dy / 2, east - dx / 2, -south - dy / 2]
    moves = check_movements(g, mesh_bounds, native_mask.all(), derived_mask.all())
    report = {
        "geometryVersion": g["geometryVersion"],
        "geometryInputSha256": sha256(geometry_bytes).hexdigest(),
        "source": {
            "productId": PRODUCT, "url": SOURCE, "format": "PDS3 PC_REAL Float32 little-endian",
            "nativeResolutionMpp": scale, "nativeShape": [source_height, source_width],
            "labelSha256": sha256(label).hexdigest(), "rangedBytes": [first, last],
            "rangeSha256": sha256(raw).hexdigest(), "nativePixelWindow": [left, top, right, bottom],
            "nativeValid": int(native_mask.sum()), "nativeTotal": int(native_mask.size),
            "projection": {"type": "spherical eqc", "radiusM": radius, "lon0": source_lon0, "latTs": field("CENTER_LATITUDE"),
                           "latitudeType": "planetocentric", "longitudeDomain": "0_to_360_east"},
            "verticalDatum": SOURCE_DATUM, "unit": "m", "valueScale": scale_factor, "valueOffset": offset,
            "missingBits": "0x" + nodata_hex.decode("ascii"),
        },
        "extentM": [w, south, east, north], "grid": [width, height], "derivedSpacingM": [dx, dy],
        "derivedValid": int(derived_mask.sum()), "derivedTotal": int(derived_mask.size),
        "heightRangeM": [float(x) for x in (derived[derived_mask].min(), derived[derived_mask].max())],
        "meshBoundsXzM": mesh_bounds, "corridorRadiusM": g["coverageProposal"]["bufferRadiusM"],
        "coverageMethod": "Verified coverage requires valid native cells across the rectangle and finite valid vertices after nearest-neighbour cell-centre reprojection. The agreed-radius corridor must stay inside the convex hull of the mesh cell centres.",
        "controls": controls, "movements": moves,
    }
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "ground-validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if not all(m["coverageVerified"] for m in moves):
        raise ValueError("Full corridor coverage not established. See ground-validation.json")
    (args.out / "height.f32").write_bytes(derived.tobytes(order="C"))
    (args.out / "height-mask.u8").write_bytes(derived_mask.astype("u1").tobytes(order="C"))
    print(f'{report["derivedValid"]}/{report["derivedTotal"]} derived vertices, {report["source"]["nativeValid"]}/{report["source"]["nativeTotal"]} native cells. Five buffered movements covered.')


if __name__ == "__main__":
    main()
