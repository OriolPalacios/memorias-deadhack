import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  createInitialMissionState,
  missionShellReducer,
} from '../src/app/missionState.ts';
import {
  buildTerrainMeshData,
  ContractValidationError,
  decodeAndValidateDemBinaries,
  drapePolylineOnTerrain,
  mapScenarioToMissionBaseline,
  parseAndValidateScenarioManifest,
  parseAndValidateTerrainManifest,
  resolvePackageAssetUrl,
  sampleTerrainAtXz,
  sampleThermalPixelAtXz,
  sanitizeExternalHttpUrl,
  validateScenarioOnTerrain,
  validateThermalDecodedPixels,
  verifyBinaryIntegrity,
} from '../src/data/jezeroContracts.ts';
import type { DecisionOptionId } from '../src/domain/autonomy.ts';
import {
  createInitialSimulatedMissionState,
  transitionSimulatedMission,
} from '../src/domain/missionEngine.ts';
import {
  buildRouteProjection,
  type MissionBaselineConstants,
  type RouteId,
} from '../src/domain/scenario.ts';

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Minimal spec-compliant PNG RGBA8 decoder for Vitest Node tests.
 */
function decodePngRgba(bytes: Uint8Array): {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
} {
  const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i += 1) {
    if (bytes[i] !== PNG_SIG[i]) {
      throw new Error('Invalid PNG signature');
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Uint8Array[] = [];

  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const type = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!,
    );
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === 'IHDR') {
      width = view.getUint32(dataStart, false);
      height = view.getUint32(dataStart + 4, false);
      bitDepth = bytes[dataStart + 8]!;
      colorType = bytes[dataStart + 9]!;
    } else if (type === 'IDAT') {
      idatChunks.push(bytes.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(`Expected 8-bit RGBA PNG, got depth=${bitDepth} colorType=${colorType}`);
  }

  const totalIdat = idatChunks.reduce((acc, c) => acc + c.length, 0);
  const compressed = new Uint8Array(totalIdat);
  let pos = 0;
  for (const chunk of idatChunks) {
    compressed.set(chunk, pos);
    pos += chunk.length;
  }

  const raw = new Uint8Array(inflateSync(compressed));
  const bpp = 4;
  const stride = width * bpp;
  const rgba = new Uint8ClampedArray(width * height * bpp);

  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)]!;
    const srcStart = row * (stride + 1) + 1;
    const dstStart = row * stride;

    for (let x = 0; x < stride; x += 1) {
      const val = raw[srcStart + x]!;
      const a = x >= bpp ? rgba[dstStart + x - bpp]! : 0;
      const b = row > 0 ? rgba[dstStart - stride + x]! : 0;
      const c = row > 0 && x >= bpp ? rgba[dstStart - stride + x - bpp]! : 0;
      let recon = val;
      if (filter === 1) recon = (val + a) & 0xff;
      else if (filter === 2) recon = (val + b) & 0xff;
      else if (filter === 3) recon = (val + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) recon = (val + paethPredictor(a, b, c)) & 0xff;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      rgba[dstStart + x] = recon;
    }
  }

  return { width, height, rgba };
}

function runSimulatedMissionFlow(
  routeId: RouteId,
  branch: DecisionOptionId,
  baseline: MissionBaselineConstants,
): number {
  let state = createInitialSimulatedMissionState(routeId, baseline);
  state = transitionSimulatedMission(state, { type: 'start_mission' }, baseline);
  state = transitionSimulatedMission(state, { type: 'complete_outbound' }, baseline);
  state = transitionSimulatedMission(state, { type: 'complete_observation' }, baseline);
  state = transitionSimulatedMission(state, { type: 'choose_branch', branch }, baseline);
  if (branch === 'extra') {
    state = transitionSimulatedMission(state, { type: 'complete_extra_stop' }, baseline);
  }
  state = transitionSimulatedMission(state, { type: 'complete_return' }, baseline);
  return state.remainingMin;
}

function buildSyntheticFixtureManifest() {
  return {
    contract: 'terrain/v1',
    id: 'jezero-fixture',
    scenarioAsset: 'scenario.json',
    frame: {
      id: 'mars-eqc-jezero-fixture',
      projection: '+proj=eqc +lat_ts=18.45 +lat_0=18.45 +lon_0=77.4 +R=3396190 +units=m +no_defs',
      latitudeType: 'planetocentric',
      longitudeDomain: '0_to_360_east',
      sceneOriginProjectedM: [100, 230],
      verticalDatum: 'Mars MOLA-adjusted areoid (fixture)',
      heightOriginM: 1.25,
      verticalExaggeration: 1,
    },
    grid: {
      width: 3,
      height: 2,
      extentM: [100, 30, 400, 230],
    },
    heightAsset: {
      path: 'height.f32',
      format: 'float32-le',
      byteLength: 24,
      sha256: 'b993a9be8021489b36cdfa7bebac0424443f12f5bbc21754119bb3fc6d7c525a',
    },
    heightMaskAsset: {
      path: 'height-mask.u8',
      format: 'uint8',
      byteLength: 6,
      sha256: 'd029ad93978df7e6ee64f4f3b5e5be70df48ce3cbee6d56fd5651ff4bcfa7323',
    },
    heightSourceId: 'hirise-dtm-fixture',
    elevationLegend: {
      unit: 'm',
      minM: -3.5,
      maxM: 4.5,
    },
    coverage: {
      validSamples: 5,
      totalSamples: 6,
    },
    textureAsset: null,
    thermal: {
      sourceId: 'themis-night-ir-fixture',
      asset: {
        path: 'thermal.png',
        format: 'png-rgba8',
        byteLength: 82,
        sha256: '4201ed7993b04da57786e3452dc82688043362b250a90bf490e2bf294f4c315c',
      },
      grid: {
        width: 2,
        height: 2,
        extentM: [100, 30, 400, 230],
      },
      nativeResolutionMpp: 100,
      legend: {
        label: 'Señal IR nocturna relativa (DN)',
        scale: 'relative_ir_dn',
        lowDN: 0,
        highDN: 255,
      },
      acquisition: {
        kind: 'mosaic',
        illumination: 'night',
        startUtc: null,
        endUtc: null,
        missingReason: 'fixture_incomplete',
      },
      coverage: {
        validSamples: 3,
        totalSamples: 4,
      },
    },
    sources: [
      {
        id: 'hirise-dtm-fixture',
        kind: 'dem',
        productId: 'DTEEC_FIXTURE',
        credit: 'NASA/JPL/UArizona',
        url: 'https://www.uahirise.org/dtm/',
      },
      {
        id: 'themis-night-ir-fixture',
        kind: 'thermal',
        productId: 'THEMIS_FIXTURE',
        credit: 'NASA/JPL-Caltech/ASU',
        url: 'https://astrogeology.usgs.gov/',
      },
    ],
  };
}

const FIXTURE_HEIGHT_B64 = 'AABgwAAAoD8AAAAAAADAvwAAkEAAAAAA';
const FIXTURE_MASK_B64 = 'AQEBAQEA';
const FIXTURE_THERMAL_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGUlEQVR4nGNgYGD439TU9J/h0qVL/4EcBgBAdwb6C3w4nAAAAABJRU5ErkJggg==';

describe('jezeroContracts synthetic asymmetric fixture (jezero-v1)', () => {
  it('decodes LE floats, preserves valid 0 m height vs mask=0 hole, and rejects corrupt byte/hash/mask/NaN', async () => {
    const manifest = parseAndValidateTerrainManifest(buildSyntheticFixtureManifest());
    const heightBytes = decodeBase64(FIXTURE_HEIGHT_B64);
    const maskBytes = decodeBase64(FIXTURE_MASK_B64);

    await expect(
      verifyBinaryIntegrity(heightBytes, manifest.heightAsset, 'height.f32'),
    ).resolves.toBeUndefined();
    await expect(
      verifyBinaryIntegrity(maskBytes, manifest.heightMaskAsset, 'height-mask.u8'),
    ).resolves.toBeUndefined();

    // Byte length mismatch must reject
    await expect(
      verifyBinaryIntegrity(heightBytes.subarray(0, 20), manifest.heightAsset, 'height.f32'),
    ).rejects.toThrow(ContractValidationError);

    // SHA-256 mismatch must reject
    const tamperedHeight = new Uint8Array(heightBytes);
    tamperedHeight[0] = (tamperedHeight[0] ?? 0) ^ 0xff;
    await expect(
      verifyBinaryIntegrity(tamperedHeight, manifest.heightAsset, 'height.f32'),
    ).rejects.toThrow(ContractValidationError);

    const grid = decodeAndValidateDemBinaries(manifest, heightBytes, maskBytes);
    expect(grid.validSamples).toBe(5);
    expect(grid.totalSamples).toBe(6);
    expect(grid.dx).toBe(100);
    expect(grid.dy).toBe(100);
    // Explicit LE float check: [-3.5, 1.25, 0, -1.5, 4.5, 0]
    expect(Array.from(grid.heights)).toEqual([-3.5, 1.25, 0, -1.5, 4.5, 0]);
    expect(grid.minElevationM).toBe(-3.5);
    expect(grid.maxElevationM).toBe(4.5);

    // Confirm reversed-endianness bytes get rejected instead of silently misinterpreting heights
    const bigEndian = new Uint8Array(heightBytes.length);
    for (let i = 0; i < heightBytes.length; i += 4) {
      bigEndian[i] = heightBytes[i + 3]!;
      bigEndian[i + 1] = heightBytes[i + 2]!;
      bigEndian[i + 2] = heightBytes[i + 1]!;
      bigEndian[i + 3] = heightBytes[i]!;
    }
    expect(() => decodeAndValidateDemBinaries(manifest, bigEndian, maskBytes)).toThrow(
      ContractValidationError,
    );

    // Invalid mask value (2) must be rejected
    const badMask = new Uint8Array(maskBytes);
    badMask[1] = 2;
    expect(() => decodeAndValidateDemBinaries(manifest, heightBytes, badMask)).toThrow(
      ContractValidationError,
    );

    // Non-finite valid height where mask=1 must be rejected
    const nanHeightBytes = new Uint8Array(heightBytes);
    new DataView(nanHeightBytes.buffer).setFloat32(0, Number.NaN, true);
    expect(() => decodeAndValidateDemBinaries(manifest, nanHeightBytes, maskBytes)).toThrow(
      ContractValidationError,
    );

    // Non-finite height at NoData (mask=0) index 5 is ignored cleanly
    const nanNoDataBytes = new Uint8Array(heightBytes);
    new DataView(nanNoDataBytes.buffer).setFloat32(5 * 4, Number.NaN, true);
    expect(() => decodeAndValidateDemBinaries(manifest, nanNoDataBytes, maskBytes)).not.toThrow();
  });

  it('produces exact cell-centre coordinates, masked triangles, barycentric samples, and non-bridging draped runs', () => {
    const manifest = parseAndValidateTerrainManifest(buildSyntheticFixtureManifest());
    const grid = decodeAndValidateDemBinaries(
      manifest,
      decodeBase64(FIXTURE_HEIGHT_B64),
      decodeBase64(FIXTURE_MASK_B64),
    );
    const mesh = buildTerrainMeshData(grid);

    // NW cell (row=0, col=0): E=150, N=180, h=-3.5 -> x=50, y=-4.75, z=50
    expect([mesh.positions[0], mesh.positions[1], mesh.positions[2]]).toEqual([50, -4.75, 50]);
    // NE cell (row=0, col=2): E=350, N=180, valid 0m -> x=250, y=-1.25, z=50
    expect([mesh.positions[6], mesh.positions[7], mesh.positions[8]]).toEqual([250, -1.25, 50]);

    // Masked triangles only (NW, SW, NE) and (NE, SW, SE); SE=cell 5 is missing
    expect(Array.from(mesh.indices)).toEqual([0, 3, 1, 1, 3, 4, 1, 4, 2]);
    expect(mesh.triangleCount).toBe(3);

    // [230, 120] falls in missing SE triangle -> null
    expect(sampleTerrainAtXz(grid, 230, 120)).toBeNull();

    // [180, 115] falls inside valid (1, 4, 2) triangle -> finite sample matching plane y
    const validSample = sampleTerrainAtXz(grid, 180, 115);
    expect(validSample).not.toBeNull();
    expect(validSample!.triangle).toEqual([1, 4, 2]);
    expect(Number.isFinite(validSample!.y)).toBe(true);

    // Non-bridging polyline [[70, 70], [230, 120], [170, 70]] splits across hole
    const draped = drapePolylineOnTerrain(
      grid,
      [
        [70, 70],
        [230, 120],
        [170, 70],
      ],
      25,
      0.35,
    );
    expect(draped.hasCoverageGap).toBe(true);
    expect(draped.runs.length).toBe(2);
    expect(draped.runs[0]!.length).toBeGreaterThanOrEqual(1);
    expect(draped.runs[1]!.length).toBeGreaterThanOrEqual(1);
  });

  it('validates north-up thermal UV, preserves DN=0 when alpha=255, and keeps thermal alpha independent of DEM', async () => {
    const manifest = parseAndValidateTerrainManifest(buildSyntheticFixtureManifest());
    const pngBytes = decodeBase64(FIXTURE_THERMAL_PNG_B64);
    await expect(
      verifyBinaryIntegrity(pngBytes, manifest.thermal.asset, 'thermal.png'),
    ).resolves.toBeUndefined();

    const { width, height, rgba } = decodePngRgba(pngBytes);
    const decoded = validateThermalDecodedPixels(manifest, width, height, rgba);
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(decoded.validSamples).toBe(3);
    expect(decoded.totalSamples).toBe(4);
    expect(decoded.minValidDn).toBe(0);
    expect(decoded.maxValidDn).toBe(210);

    // NW pixel (row=0, col=0): DN=0, alpha=255
    const nw = sampleThermalPixelAtXz(manifest.thermal.grid, rgba, manifest.frame, 75, 50);
    expect(nw?.col).toBe(0);
    expect(nw?.row).toBe(0);
    expect(nw?.dn).toBe(0);
    expect(nw?.alpha).toBe(255);

    // NE pixel (row=0, col=1): DN=130, alpha=255
    const ne = sampleThermalPixelAtXz(manifest.thermal.grid, rgba, manifest.frame, 225, 50);
    expect(ne?.col).toBe(1);
    expect(ne?.row).toBe(0);
    expect(ne?.dn).toBe(130);
    expect(ne?.alpha).toBe(255);

    // SW pixel (row=1, col=0): DN=210, alpha=255
    const sw = sampleThermalPixelAtXz(manifest.thermal.grid, rgba, manifest.frame, 75, 150);
    expect(sw?.col).toBe(0);
    expect(sw?.row).toBe(1);
    expect(sw?.dn).toBe(210);
    expect(sw?.alpha).toBe(255);

    // [180, 115] is valid DEM triangle yet falls inside SE thermal pixel with alpha=0
    const se = sampleThermalPixelAtXz(manifest.thermal.grid, rgba, manifest.frame, 180, 115);
    expect(se?.col).toBe(1);
    expect(se?.row).toBe(1);
    expect(se?.alpha).toBe(0);

    // Outside [0, 1) thermal extent -> null (terrain only)
    expect(sampleThermalPixelAtXz(manifest.thermal.grid, rgba, manifest.frame, -1, 50)).toBeNull();
    expect(sampleThermalPixelAtXz(manifest.thermal.grid, rgba, manifest.frame, 300, 50)).toBeNull();
    expect(sampleThermalPixelAtXz(manifest.thermal.grid, rgba, manifest.frame, 50, -1)).toBeNull();
    expect(sampleThermalPixelAtXz(manifest.thermal.grid, rgba, manifest.frame, 50, 200)).toBeNull();
  });

  it('rejects Earth/WGS84 frame projections and unsafe package URLs', () => {
    const raw = buildSyntheticFixtureManifest();
    expect(() =>
      parseAndValidateTerrainManifest({
        ...raw,
        frame: {
          ...raw.frame,
          projection: 'EPSG:4326 WGS84',
        },
      }),
    ).toThrow(ContractValidationError);

    const rootUrl = 'https://localhost:4180/demo/jezero/';
    const terrainUrl = 'https://localhost:4180/demo/jezero/terrain.json';
    expect(resolvePackageAssetUrl(terrainUrl, 'height.f32', rootUrl)).toBe(
      'https://localhost:4180/demo/jezero/height.f32',
    );
    expect(() => resolvePackageAssetUrl(terrainUrl, '../secret.txt', rootUrl)).toThrow(
      ContractValidationError,
    );
    expect(() => resolvePackageAssetUrl(terrainUrl, 'https://evil.example/a.bin', rootUrl)).toThrow(
      ContractValidationError,
    );
    expect(sanitizeExternalHttpUrl('https://mars.nasa.gov/msl/')).toBe('https://mars.nasa.gov/msl/');
    expect(sanitizeExternalHttpUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('Real public/demo/jezero package integration & scenario budget authority', () => {
  const JEZERO_DIR = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'public',
    'demo',
    'jezero',
  );

  function loadRealPackage() {
    const terrainRaw = JSON.parse(readFileSync(join(JEZERO_DIR, 'terrain.json'), 'utf-8')) as Record<
      string,
      unknown
    >;
    const scenarioRaw = JSON.parse(
      readFileSync(join(JEZERO_DIR, 'scenario.json'), 'utf-8'),
    ) as {
      budgetMin: number;
      reserveMin: number;
      routes: Array<{
        id: string;
        outbound: { minutes: number };
      }>;
    };
    const heightBytes = new Uint8Array(readFileSync(join(JEZERO_DIR, 'height.f32')));
    const maskBytes = new Uint8Array(readFileSync(join(JEZERO_DIR, 'height-mask.u8')));
    const thermalBytes = new Uint8Array(readFileSync(join(JEZERO_DIR, 'thermal.png')));
    const photoBytes = new Uint8Array(readFileSync(join(JEZERO_DIR, 'pia25325.jpg')));
    return {
      terrainRaw,
      scenarioRaw,
      heightBytes,
      maskBytes,
      thermalBytes,
      photoBytes,
    };
  }

  it('verifies all real package binaries, DEM bounds, 5 simulated routes, and thermal DN cross-checks', async () => {
    const pkg = loadRealPackage();
    const terrain = parseAndValidateTerrainManifest(pkg.terrainRaw);
    const scenario = parseAndValidateScenarioManifest(pkg.scenarioRaw, terrain);

    expect(terrain.id).toBe('jezero-dem-20261115-v1');
    expect(terrain.textureAsset).toBeNull();
    expect(scenario.id).toBe('una-parada-mas-jezero-v1');
    expect(scenario.geometryVersion).toBe('jezero-geometry-proposal-20261115-1');

    await verifyBinaryIntegrity(pkg.heightBytes, terrain.heightAsset, 'height.f32');
    await verifyBinaryIntegrity(pkg.maskBytes, terrain.heightMaskAsset, 'height-mask.u8');
    await verifyBinaryIntegrity(pkg.thermalBytes, terrain.thermal.asset, 'thermal.png');
    await verifyBinaryIntegrity(pkg.photoBytes, scenario.evidence[0]!.asset, 'pia25325.jpg');

    const grid = decodeAndValidateDemBinaries(terrain, pkg.heightBytes, pkg.maskBytes);
    expect(grid.validSamples).toBe(65536);
    expect(grid.totalSamples).toBe(65536);
    expect(grid.minElevationM).toBeCloseTo(-2536.40673828125, 4);
    expect(grid.maxElevationM).toBeCloseTo(-2457.3974609375, 4);

    const mesh = buildTerrainMeshData(grid);
    expect(mesh.triangleCount).toBe(255 * 255 * 2);
    expect(mesh.boundsMin[0]).toBeCloseTo(-149.21875, 5);
    expect(mesh.boundsMax[0]).toBeCloseTo(249.21875, 5);
    expect(mesh.boundsMin[2]).toBeCloseTo(-349.21875, 5);
    expect(mesh.boundsMax[2]).toBeCloseTo(49.21875, 5);

    // Every POI and all 5 movement paths fit valid terrain triangles with zero holes
    const draped = validateScenarioOnTerrain(scenario, grid, 0.35);
    expect(draped.base.id).toBe('base');
    expect(draped.science.id).toBe('science');
    expect(draped.extraStop.id).toBe('extra-stop');

    const allMovements = [
      draped.movements.routeA,
      draped.movements.routeB,
      draped.movements.extra,
      draped.movements.returnAfterExtra,
      draped.movements.direct,
    ];
    for (const mov of allMovements) {
      expect(mov.hasCoverageGap).toBe(false);
      expect(mov.validSamples).toBe(mov.totalSamples);
      expect(mov.runs.length).toBe(1);
    }

    // Verify POIs match exact barycentric surface and route points include documented visual lift (0.35 m)
    const scienceSample = sampleTerrainAtXz(
      grid,
      draped.science.x,
      draped.science.z,
    );
    expect(scienceSample).not.toBeNull();
    expect(draped.science.elevationM).toBeCloseTo(scienceSample!.elevationM, 5);
    expect(draped.science.y).toBeCloseTo(scienceSample!.y, 5);
    const routeARun = draped.movements.routeA.runs[0]!;
    const routeAEnd = routeARun[routeARun.length - 1]!;
    expect(routeAEnd.y).toBeCloseTo(scienceSample!.y + 0.35, 5);

    // Thermal 4x4 RGBA8 PNG row-by-row matrix + POI cross-check
    const { width, height, rgba } = decodePngRgba(pkg.thermalBytes);
    const decodedThermal = validateThermalDecodedPixels(terrain, width, height, rgba);
    expect(decodedThermal.validSamples).toBe(16);

    const expectedMatrix = [
      [102, 87, 85, 86],
      [112, 101, 105, 98],
      [112, 115, 113, 99],
      [124, 119, 110, 92],
    ];
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        const idx = (r * 4 + c) * 4;
        expect(rgba[idx]).toBe(expectedMatrix[r]![c]);
        expect(rgba[idx + 3]).toBe(255);
      }
    }

    const baseThermal = sampleThermalPixelAtXz(
      terrain.thermal.grid,
      rgba,
      terrain.frame,
      draped.base.x,
      draped.base.z,
    );
    const scienceThermal = sampleThermalPixelAtXz(
      terrain.thermal.grid,
      rgba,
      terrain.frame,
      draped.science.x,
      draped.science.z,
    );
    const extraThermal = sampleThermalPixelAtXz(
      terrain.thermal.grid,
      rgba,
      terrain.frame,
      draped.extraStop.x,
      draped.extraStop.z,
    );
    expect(baseThermal?.dn).toBe(112);
    expect(scienceThermal?.dn).toBe(110);
    expect(extraThermal?.dn).toBe(101);
  });

  it('rejects mismatched terrainId/frameId or invalid costs, and propagates modified scenario budget cleanly into engine/reducer', () => {
    const { terrainRaw, scenarioRaw } = loadRealPackage();
    const terrain = parseAndValidateTerrainManifest(terrainRaw);
    const realScenario = parseAndValidateScenarioManifest(scenarioRaw, terrain);

    expect(() =>
      parseAndValidateScenarioManifest({ ...scenarioRaw, terrainId: 'other-terrain' }, terrain),
    ).toThrow(ContractValidationError);
    expect(() =>
      parseAndValidateScenarioManifest({ ...scenarioRaw, frameId: 'other-frame' }, terrain),
    ).toThrow(ContractValidationError);
    expect(() =>
      parseAndValidateScenarioManifest({ ...scenarioRaw, budgetMin: -10 }, terrain),
    ).toThrow(ContractValidationError);

    // Default baseline matches all 4 routes exactly: 35, 15, 25, 5 and reserve 20
    const defaultBaseline = mapScenarioToMissionBaseline(realScenario, undefined, true);
    expect(runSimulatedMissionFlow('A', 'direct', defaultBaseline)).toBe(35);
    expect(runSimulatedMissionFlow('A', 'extra', defaultBaseline)).toBe(15);
    expect(runSimulatedMissionFlow('B', 'direct', defaultBaseline)).toBe(25);
    expect(runSimulatedMissionFlow('B', 'extra', defaultBaseline)).toBe(5);
    expect(defaultBaseline.reserveMin).toBe(20);

    // Modified scenario budget/reserve/cost must flow into projection & reducer without silent hardcoding
    const modifiedScenarioRaw = {
      ...scenarioRaw,
      budgetMin: 140,
      reserveMin: 25,
      routes: scenarioRaw.routes.map((r) =>
        r.id === 'A'
          ? { ...r, outbound: { ...r.outbound, minutes: 40 } }
          : r,
      ),
    };
    const modifiedScenario = parseAndValidateScenarioManifest(modifiedScenarioRaw, terrain);
    const modifiedBaseline = mapScenarioToMissionBaseline(modifiedScenario, undefined, true);
    const projA = buildRouteProjection('A', modifiedBaseline);

    // Budget 140 - outbound 40 - observe 20 = 80 available at checkpoint; direct 30 -> 50 final
    expect(projA.availableAtCheckpointMin).toBe(80);
    expect(projA.evaluation.options.direct.projectedAtBaseMin).toBe(50);

    // Reducer sync_baseline updates initial planning budget but leaves active runs untouched
    const initialShell = createInitialMissionState('ready');
    const syncedShell = missionShellReducer(initialShell, {
      type: 'sync_baseline',
      baseline: modifiedBaseline,
    });
    expect(syncedShell.mission.remainingMin).toBe(140);

    const runningShell = missionShellReducer(syncedShell, {
      type: 'mission_event',
      event: { type: 'start_mission' },
      baseline: modifiedBaseline,
    });
    const outboundDoneShell = missionShellReducer(runningShell, {
      type: 'mission_event',
      event: { type: 'complete_outbound' },
      baseline: modifiedBaseline,
    });
    expect(outboundDoneShell.mission.remainingMin).toBe(100); // 140 - 40

    const ignoredResync = missionShellReducer(outboundDoneShell, {
      type: 'sync_baseline',
      baseline: defaultBaseline,
    });
    expect(ignoredResync.mission.remainingMin).toBe(100);

    const obsDone = transitionSimulatedMission(
      outboundDoneShell.mission,
      { type: 'complete_observation' },
      modifiedBaseline,
    );
    const choosing = transitionSimulatedMission(
      obsDone,
      { type: 'choose_branch', branch: 'direct' },
      modifiedBaseline,
    );
    const completed = transitionSimulatedMission(
      choosing,
      { type: 'complete_return' },
      modifiedBaseline,
    );
    expect(completed.remainingMin).toBe(50);
  });
});
