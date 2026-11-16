"""Extract the full-resolution USGS THEMIS COG cells for Jezero.

Run: python prepare_jezero_thermal.py path/to/mc13_syrtis_major_nir.stac.json [--output DIR]
Requires NumPy and Pillow. Reads only a TIFF header and the intersecting tiles.
"""

import argparse
from hashlib import sha256
import io
import json
import math
from pathlib import Path
import platform
import re
import struct
from urllib.request import Request, urlopen
import zlib

import numpy as np
import PIL
from PIL import Image, features


PRODUCT = 'mc13_syrtis_major_nir'
ITEM_URL = f'https://stac.astrogeology.usgs.gov/api/collections/mo_themis_controlled_mosaics/items/{PRODUCT}'
DOCUMENTATION_URL = 'https://stac.astrogeology.usgs.gov/docs/data/mars/themis_controlled_mosaics/'
GEOMETRY_VERSION = 'jezero-geometry-proposal-20261115-1'
GEOMETRY_CONFIRMATION = 'https://github.com/OriolPalacios/memorias-deadhack/pull/10#issuecomment-6902087995'
FRAME = '+proj=eqc +lat_ts=18.45 +lat_0=18.45 +lon_0=77.4 +R=3396190 +x_0=0 +y_0=0 +units=m +type=crs'
EXTENT = [-150, -50, 250, 350]
WIDTH = HEIGHT = 4
RADIUS = 3396190
ORIGIN_LON = 77.4
ORIGIN_LAT = 18.45


def verify(condition, message):
    if not condition:
        raise ValueError(message)


def tiff_tile_via_libtiff(compressed, width, height):
    # Reframe the unmodified payload as a one-tile TIFF for an independent decoder.
    tags = {256: width, 257: height, 258: 8, 259: 8, 262: 1, 277: 1, 284: 1, 317: 2,
            322: width, 323: height, 324: 8 + 2 + 12 * 13 + 4, 325: len(compressed), 339: 1}
    directory = bytearray(struct.pack('<H', len(tags)))
    for tag, value in tags.items():
        field_type = 4 if tag in (324, 325) else 3
        directory.extend(struct.pack('<HHII', tag, field_type, 1, value))
    directory.extend(struct.pack('<I', 0))
    with Image.open(io.BytesIO(b'II*\x00\x08\x00\x00\x00' + directory + compressed)) as image:
        verify(image.mode == 'L' and image.size == (width, height), 'Unexpected libtiff tile layout')
        return np.array(image)


class RangeReader:
    def __init__(self, url):
        self.url = url
        self.ranges = []
        self.signature = None

    def read(self, start, count, purpose):
        stop = start + count - 1
        headers = {'Range': f'bytes={start}-{stop}', 'Accept-Encoding': 'identity'}
        if self.signature:
            headers['If-Match'] = self.signature['etag']
        with urlopen(Request(self.url, headers=headers), timeout=45) as response:
            content_range = response.headers.get('Content-Range', '')
            match = re.fullmatch(rf'bytes {start}-{stop}/(\d+)', content_range)
            verify(response.status == 206 and match, f'Unexpected HTTP response for {purpose}: {response.status} {content_range}')
            verify(response.headers.get('Content-Encoding', 'identity') == 'identity', 'Unexpected HTTP encoding')
            current = {'byteLength': int(match[1]), 'etag': response.headers['ETag'], 'lastModified': response.headers['Last-Modified']}
            verify(current['etag'] and (not self.signature or current == self.signature), 'COG revision changed while reading')
            self.signature = current
            date = response.headers['Date']
            verify(date, 'Missing HTTP Date')
            blob = response.read(count + 1)
        verify(len(blob) == count, f'Incomplete HTTP range for {purpose}')
        self.ranges.append({'purpose': purpose, 'start': start, 'stopInclusive': stop, 'byteLength': count,
                            'sha256': sha256(blob).hexdigest(), 'httpDate': date})
        return blob


class Cog:
    def __init__(self, reader):
        self.reader = reader
        self.header = reader.read(0, 2042, 'Classic TIFF header, GeoTIFF tags and image directory chain')
        verify(self.header[:4] == b'II*\x00', 'Expected a little-endian classic TIFF')
        offset, = struct.unpack_from('<I', self.header, 4)
        flags = []
        while offset:
            verify(offset not in flags, 'Cycle in TIFF image directories')
            flags.append(offset)
            entries, = struct.unpack_from('<H', self.header, offset)
            tags = {}
            for index in range(entries):
                entry = offset + 2 + 12 * index
                tag, kind, count, position = struct.unpack_from('<HHII', self.header, entry)
                tags[tag] = (kind, count, position, entry + 8)
            if len(flags) == 1:
                self.tags = tags
                verify(254 not in tags or self.value(254) == 0, 'First TIFF directory is not a full-resolution image')
            else:
                kind, count, value, _ = tags[254]
                verify((kind, count, value) == (4, 1, 1), 'Unexpected mask or auxiliary image directory')
            offset, = struct.unpack_from('<I', self.header, offset + 2 + 12 * entries)
        verify(330 not in self.tags and 338 not in self.tags, 'Unexpected sub-IFD or alpha band')
        self.overviews = len(flags) - 1
        verify([self.value(t) for t in [258, 259, 262, 277, 284, 317, 339]] == [8, 8, 1, 1, 1, 2, 1],
               'Expected unsigned 8-bit grayscale, DEFLATE and horizontal differencing')
        self.width, self.height = self.value(256), self.value(257)
        self.tile_width, self.tile_height = self.value(322), self.value(323)
        self.nodata = int(self.value(42113))
        self.tiles_across = math.ceil(self.width / self.tile_width)
        tile_count = self.tiles_across * math.ceil(self.height / self.tile_height)
        verify(self.tags[324][:2] == self.tags[325][:2] == (4, tile_count), 'Invalid tile index')

    def value(self, tag):
        kind, count, position, inline = self.tags[tag]
        token = {2: 's', 3: 'H', 4: 'I', 12: 'd'}[kind]
        layout = f'<{count}{token}'
        values = struct.unpack_from(layout, self.header, inline if struct.calcsize(layout) <= 4 else position)
        return values[0].decode('ascii').rstrip('\x00') if kind == 2 else values[0] if count == 1 else values

    def georeference(self):
        sx, sy, sz = self.value(33550)
        raster_x, raster_y, raster_z, west, north, tie_z = self.value(33922)
        verify((raster_x, raster_y, raster_z, sz, tie_z) == (0, 0, 0, 0, 0), 'Unexpected tie point')
        directory = self.value(34735)
        verify(len(directory) == 4 + 4 * directory[3], 'Invalid GeoKey directory')
        geokeys = {}
        for offset in range(4, len(directory), 4):
            key, tag, count, index = directory[offset:offset + 4]
            if tag == 0:
                verify(count == 1, 'Invalid inline GeoKey')
                geokeys[key] = index
            else:
                values = self.value(tag)[index:index + count]
                geokeys[key] = values if tag == 34737 or count != 1 else values[0]
        return [west, sx, 0, north, 0, -sy], geokeys

    def tile(self, row, col):
        index = row * self.tiles_across + col
        offsets, lengths = self.tags[324][2], self.tags[325][2]
        start, = struct.unpack('<I', self.reader.read(offsets + 4 * index, 4, f'Tile {index} offset'))
        count, = struct.unpack('<I', self.reader.read(lengths + 4 * index, 4, f'Tile {index} compressed size'))
        verify(start > 4 and 0 < count < 1_000_000, f'Unexpected tile {index} byte range')
        chunk = self.reader.read(start - 4, count + 8, f'Tile {index} compressed data, COG leader and trailer')
        verify(struct.unpack_from('<I', chunk)[0] == count and chunk[-8:-4] == chunk[-4:], 'COG block framing mismatch')
        compressed = chunk[4:-4]
        raw = zlib.decompress(compressed)
        verify(len(raw) == self.tile_width * self.tile_height, 'Unexpected decoded tile size')
        delta = np.frombuffer(raw, dtype=np.uint8).reshape(self.tile_height, self.tile_width)
        decoded = np.cumsum(delta, axis=1, dtype=np.uint8)
        verify(np.array_equal(decoded, tiff_tile_via_libtiff(compressed, self.tile_width, self.tile_height)),
               'LibTIFF disagrees with the raw DEFLATE and horizontal predictor decode')
        return decoded


def derive(stac_path, output):
    stac_bytes = stac_path.read_bytes()
    stac = json.loads(stac_bytes)
    verify(stac['id'] == PRODUCT, 'Wrong STAC Item for Jezero')
    properties = stac['properties']
    url = stac['assets']['image']['href']
    reader = RangeReader(url)
    cog = Cog(reader)
    affine, geokeys = cog.georeference()
    verify([cog.height, cog.width] == properties['proj:shape'], 'TIFF/STAC shape mismatch')
    verify(np.allclose(affine, properties['proj:transform'], rtol=0, atol=1e-8), 'TIFF/STAC geotransform mismatch')
    verify(geokeys[1024] == 1 and geokeys[1025] == 1 and geokeys[3075] == 17 and geokeys[3076] == 9001,
           'Expected north-up equirectangular metres with PixelIsArea registration')
    verify(geokeys[2057] == geokeys[2058] == RADIUS, 'Unexpected source sphere')
    verify(all(geokeys[key] == 0 for key in [2061, 3078, 3082, 3083, 3088, 3089]), 'Unexpected source projection parameters')
    verify(cog.nodata == 0, 'Unexpected GDAL_NODATA value')
    verify(features.check('libtiff'), 'Pillow with LibTIFF support is needed for the independent tile decode')

    west, south, east, north = EXTENT
    dx, dy = (east - west) / WIDTH, (north - south) / HEIGHT
    lon_cos = math.cos(math.radians(ORIGIN_LAT))
    source_origin_e = RADIUS * math.radians(ORIGIN_LON)
    source_origin_n = RADIUS * math.radians(ORIGIN_LAT)
    source_west, source_dx, _, source_north, _, source_dy = affine
    corners = []
    for target_e, target_n in [(west, north), (east, north), (west, south), (east, south)]:
        source_e = source_origin_e + target_e / lon_cos
        source_n = source_origin_n + target_n
        verify(source_west <= source_e < source_west + cog.width * source_dx and
               source_north + cog.height * source_dy < source_n <= source_north, 'Target grid edge lies outside COG')
        corners.append({'targetENm': [target_e, target_n], 'sourceENm': [source_e, source_n],
                        'lonLatDeg': [math.degrees(source_e / RADIUS), math.degrees(source_n / RADIUS)]})
    d, alpha = np.zeros((HEIGHT, WIDTH), dtype=np.uint8), np.zeros((HEIGHT, WIDTH), dtype=np.uint8)
    tiles = {}
    cells = []
    for row in range(HEIGHT):
        for col in range(WIDTH):
            target_e, target_n = west + (col + .5) * dx, north - (row + .5) * dy
            source_e = source_origin_e + target_e / lon_cos
            source_n = source_origin_n + target_n
            source_col = math.floor((source_e - source_west) / source_dx)
            source_row = math.floor((source_n - source_north) / source_dy)
            block_row, local_row = divmod(source_row, cog.tile_height)
            block_col, local_col = divmod(source_col, cog.tile_width)
            tile_key = (block_row, block_col)
            if tile_key not in tiles:
                tiles[tile_key] = cog.tile(*tile_key)
            dn = int(tiles[tile_key][local_row, local_col])
            valid = dn != cog.nodata
            d[row, col], alpha[row, col] = (dn, 255) if valid else (0, 0)
            distance = math.hypot(source_e - (source_west + (source_col + .5) * source_dx),
                                  source_n - (source_north + (source_row + .5) * source_dy))
            verify(distance <= math.hypot(source_dx, source_dy) / 2 + 1e-8, 'Nearest-neighbour distance exceeds half-diagonal')
            cells.append({'rowColumn': [row, col], 'targetENm': [target_e, target_n], 'sourceENm': [source_e, source_n],
                          'sourceRowColumn': [source_row, source_col], 'dn': dn, 'valid': valid,
                          'sourceCenterDistanceM': distance})
    valid_dn = d[alpha == 255]
    rgba = np.stack([d, d, d, alpha], axis=-1)
    png = io.BytesIO()
    Image.fromarray(rgba).save(png, format='PNG')
    blob = png.getvalue()
    with Image.open(io.BytesIO(blob)) as image:
        verify(image.mode == 'RGBA' and np.array_equal(np.asarray(image), rgba), 'PNG did not round-trip RGBA samples')
    verify(blob[24:26] == b'\x08\x06', 'PNG IHDR must be RGBA8')

    valid_count = int(valid_dn.size)
    asset = {'path': 'thermal.png', 'format': 'png-rgba8', 'byteLength': len(blob), 'sha256': sha256(blob).hexdigest()}
    manifest = {
        'sourceId': PRODUCT,
        'asset': asset,
        'grid': {'width': WIDTH, 'height': HEIGHT, 'extentM': EXTENT},
        'nativeResolutionMpp': source_dx,
        'legend': {'label': 'IR nocturno — intensidad relativa', 'scale': 'relative_ir_dn', 'lowDN': 0, 'highDN': 255},
        'acquisition': {'kind': 'mosaic', 'illumination': 'night', 'startUtc': None, 'endUtc': None,
                        'missingReason': 'stac_interval_inverted_and_provenance_has_no_observation_dates'},
        'coverage': {'validSamples': valid_count, 'totalSamples': WIDTH * HEIGHT},
    }
    evidence = {
        'geometryVersion': GEOMETRY_VERSION,
        'geometryConfirmationUrl': GEOMETRY_CONFIRMATION,
        'targetCrs': FRAME,
        'targetSpacingM': [dx, dy],
        'rowOrder': 'north_to_south',
        'columnOrder': 'west_to_east',
        'method': 'pixel-center inverse spherical equirectangular, nearest native pixel, no overviews or DN scaling',
        'verification': 'LibTIFF and the DEFLATE/Predictor=2 decode agreed byte-for-byte on every tile. The RGBA8 PNG round-tripped.',
        'targetOuterCorners': corners,
        'maxSourceCenterDistanceM': max(c['sourceCenterDistanceM'] for c in cells),
        'source': {
            'id': PRODUCT, 'kind': 'themis-controlled-nighttime-infrared-mosaic', 'productId': PRODUCT,
            'revision': reader.signature['etag'].strip('"'), 'url': url,
            'stacItemUrl': ITEM_URL, 'stacSha256': sha256(stac_bytes).hexdigest(), 'documentationUrl': DOCUMENTATION_URL,
            'accessedHttpDate': reader.ranges[0]['httpDate'],
            'credit': 'NASA Mars Odyssey / USGS Astrogeology Science Center', 'license': properties['license'],
            'mission': 'Mars Odyssey', 'instrument': 'Thermal Emission Imaging System (THEMIS)',
            'nativeResolutionMpp': source_dx, 'crs': properties['proj:wkt2'], 'verticalDatum': None,
            'scale': 1, 'offset': 0, 'noData': cog.nodata,
            'coverage': {'sourceShapeRowColumn': [cog.height, cog.width], 'targetWindowValidSamples': valid_count,
                         'targetWindowTotalSamples': WIDTH * HEIGHT},
        },
        'sourceGeoreference': {'affineGdalOrder': affine, 'geoKeys': geokeys, 'rasterType': 'PixelIsArea',
                               'overviewsIgnored': cog.overviews, 'tileShapeRowColumn': [cog.tile_height, cog.tile_width],
                               'sampleMask': 'Band 1 GDAL_NODATA; TIFF contains no internal mask IFD and has one sample per pixel'},
        'sourcePixelWindow': {'firstRow': min(c['sourceRowColumn'][0] for c in cells),
                              'lastRow': max(c['sourceRowColumn'][0] for c in cells),
                              'firstColumn': min(c['sourceRowColumn'][1] for c in cells),
                              'lastColumn': max(c['sourceRowColumn'][1] for c in cells)},
        'sourceCog': reader.signature,
        'sourceRanges': reader.ranges,
        'sourceRangeBytesTotal': sum(r['byteLength'] for r in reader.ranges),
        'sourceStacDates': {name: properties[name] for name in ['start_datetime', 'end_datetime', 'datetime', 'created', 'updated']},
        'sourceAuxiliaryMetadata': {name: stac['assets'][name]['href'] for name in ['provenance', 'isis_label']},
        'dnRangeValid': [int(valid_dn.min()), int(valid_dn.max())] if valid_count else None,
        'dnNorthToSouth': d.tolist(), 'alphaNorthToSouth': alpha.tolist(), 'samples': cells,
        'software': {'python': platform.python_version(), 'numpy': np.__version__, 'pillow': PIL.__version__,
                     'libtiff': features.version('libtiff'), 'zlib': zlib.ZLIB_RUNTIME_VERSION},
        'thermal': manifest,
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / asset['path']).write_bytes(blob)
    (output / 'thermal-evidence.json').write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{valid_count}/{WIDTH * HEIGHT} valid cells, DN {evidence["dnRangeValid"]}, {len(tiles)} COG tiles, '
          f'{evidence["sourceRangeBytesTotal"]} HTTP payload bytes, PNG {len(blob)} bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stac_item', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    derive(args.stac_item, args.output)
