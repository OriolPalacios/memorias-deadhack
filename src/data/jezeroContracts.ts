/**
 * Typed consumer/validator for terrain/v1 and scenario/v1 packages (Jezero).
 * Pure TypeScript (no React, Three.js, or DOM dependencies) so all data math,
 * LE decoding, SHA-256 checks, hole-preserving triangulation, barycentric draping,
 * and thermal UV registration are unit-testable in Node and reusable in browser.
 */

import {
  DEFAULT_ROUTE_ID,
  SIMULATED_MISSION_BASELINE,
  type MissionBaselineConstants,
  type RouteId,
} from '../domain/scenario.ts';

export interface BinaryAssetDescriptor {
  readonly path: string;
  readonly format: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface TerrainFrameSpec {
  readonly id: string;
  readonly projection: string;
  readonly latitudeType: 'planetocentric';
  readonly longitudeDomain: '0_to_360_east';
  readonly sceneOriginProjectedM: readonly [number, number];
  readonly verticalDatum: string;
  readonly heightOriginM: number;
  readonly verticalExaggeration: number;
}

export interface GridSpec {
  readonly width: number;
  readonly height: number;
  readonly extentM: readonly [number, number, number, number]; // [W, S, Emax, Nmax]
}

export interface TerrainSourceSpec {
  readonly id: string;
  readonly kind: string;
  readonly productId: string;
  readonly credit: string;
  readonly mission?: string;
  readonly instrument?: string;
  readonly revision?: string;
  readonly license?: string;
  readonly nativeResolutionMpp?: number;
  readonly url?: string;
  readonly referenceUrl?: string;
  readonly stacItemUrl?: string;
  readonly documentationUrl?: string;
  readonly verticalDatum?: string | null;
}

export interface ThermalLayerSpec {
  readonly sourceId: string;
  readonly asset: BinaryAssetDescriptor;
  readonly grid: GridSpec;
  readonly nativeResolutionMpp: number;
  readonly legend: {
    readonly label: string;
    readonly scale: string;
    readonly lowDN: number;
    readonly highDN: number;
  };
  readonly acquisition: {
    readonly kind: string;
    readonly illumination: string;
    readonly startUtc: string | null;
    readonly endUtc: string | null;
    readonly missingReason: string | null;
  };
  readonly coverage: {
    readonly validSamples: number;
    readonly totalSamples: number;
  };
}

export interface TerrainManifestV1 {
  readonly contract: 'terrain/v1';
  readonly id: string;
  readonly scenarioAsset: string;
  readonly frame: TerrainFrameSpec;
  readonly grid: GridSpec;
  readonly heightAsset: BinaryAssetDescriptor;
  readonly heightMaskAsset: BinaryAssetDescriptor;
  readonly heightSourceId: string;
  readonly elevationLegend: {
    readonly unit: string;
    readonly minM: number;
    readonly maxM: number;
  };
  readonly coverage: {
    readonly validSamples: number;
    readonly totalSamples: number;
  };
  readonly textureAsset: BinaryAssetDescriptor | null;
  readonly thermal: ThermalLayerSpec;
  readonly sources: readonly TerrainSourceSpec[];
}

export interface ScenarioPoiBase {
  readonly id: string;
  readonly xzM: readonly [number, number];
  readonly simulated: true;
}

export interface ScenarioStop extends ScenarioPoiBase {
  readonly anchorControl?: string | null;
  readonly anchorLonLat?: readonly [number, number] | null;
  readonly evidenceId: string | null;
  readonly contextIds: readonly string[];
}

export interface ScenarioMovement {
  readonly eventId: string;
  readonly minutes: number;
  readonly fromId: string;
  readonly toId: string;
  readonly pathXzM: readonly (readonly [number, number])[];
}

export interface ScenarioRouteEntry {
  readonly id: RouteId;
  readonly simulated: true;
  readonly outbound: ScenarioMovement;
}

export interface ScenarioEvidenceItem {
  readonly id: string;
  readonly kind: string;
  readonly productId: string;
  readonly asset: BinaryAssetDescriptor;
  readonly credit: string;
  readonly captureDate: string | null;
  readonly captureSol: number | null;
  readonly captureLocation: readonly [number, number] | null;
  readonly sourceUrl: string | null;
  readonly missingReason: string | null;
  readonly note: string | null;
}

export interface ScenarioContextVariable {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
}

export interface ScenarioContextCard {
  readonly id: string;
  readonly kind: string;
  readonly site: string;
  readonly dateUtc: string | null;
  readonly dateLabel: string | null;
  readonly sol: number | null;
  readonly credit: string;
  readonly sourceUrl: string | null;
  readonly variables: readonly ScenarioContextVariable[];
}

export interface ScenarioManifestV1 {
  readonly contract: 'scenario/v1';
  readonly id: string;
  readonly terrainId: string;
  readonly frameId: string;
  readonly geometryVersion: string;
  readonly budgetMin: number;
  readonly reserveMin: number;
  readonly base: ScenarioPoiBase;
  readonly stops: readonly ScenarioStop[];
  readonly routes: readonly ScenarioRouteEntry[];
  readonly shared: {
    readonly observe: {
      readonly eventId: string;
      readonly minutes: number;
      readonly stopId: string;
    };
    readonly extra: ScenarioMovement;
    readonly returnAfterExtra: ScenarioMovement;
    readonly direct: ScenarioMovement;
  };
  readonly evidence: readonly ScenarioEvidenceItem[];
  readonly contextCards: readonly ScenarioContextCard[];
}

export interface TerrainGridData {
  readonly manifest: TerrainManifestV1;
  readonly width: number;
  readonly height: number;
  readonly dx: number;
  readonly dy: number;
  readonly heights: Float32Array;
  readonly mask: Uint8Array;
  readonly validSamples: number;
  readonly totalSamples: number;
  readonly minElevationM: number;
  readonly maxElevationM: number;
  readonly minY: number;
  readonly maxY: number;
  readonly boundsXzM: readonly [number, number, number, number]; // [xMin, zMin, xMax, zMax]
}

export interface TerrainMeshBuffers {
  readonly positions: Float32Array;
  readonly colorsLinear: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
  readonly triangleCount: number;
  readonly validVertexCount: number;
  readonly boundsMin: readonly [number, number, number];
  readonly boundsMax: readonly [number, number, number];
}

export interface TerrainSample {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly elevationM: number;
  readonly triangle: readonly [number, number, number];
}

export interface DrapedPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly elevationM: number;
}

export interface DrapedPose extends DrapedPoint {
  readonly yawRad: number;
}

export interface DrapedPolylineResult {
  readonly runs: readonly (readonly DrapedPoint[])[];
  readonly hasCoverageGap: boolean;
  readonly totalSamples: number;
  readonly validSamples: number;
  readonly lengthM: number;
}

export interface ThermalSampleResult {
  readonly col: number;
  readonly row: number;
  readonly dn: number;
  readonly alpha: number;
  readonly uv: readonly [number, number];
  readonly vNorth: number;
}

export interface DecodedThermalData {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8ClampedArray;
  readonly validSamples: number;
  readonly totalSamples: number;
  readonly minValidDn: number | null;
  readonly maxValidDn: number | null;
}

export interface DrapedScenarioGeometry {
  readonly base: DrapedPoint & { readonly id: string; readonly simulated: true };
  readonly science: DrapedPoint & {
    readonly id: string;
    readonly simulated: true;
    readonly anchorControl?: string | null;
    readonly anchorLonLat?: readonly [number, number] | null;
  };
  readonly extraStop: DrapedPoint & {
    readonly id: string;
    readonly simulated: true;
    readonly anchorControl?: string | null;
    readonly anchorLonLat?: readonly [number, number] | null;
  };
  readonly movements: Readonly<{
    routeA: DrapedPolylineResult;
    routeB: DrapedPolylineResult;
    extra: DrapedPolylineResult;
    returnAfterExtra: DrapedPolylineResult;
    direct: DrapedPolylineResult;
  }>;
}

export class ContractValidationError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = 'ContractValidationError';
    this.code = code;
  }
}

const SHA256_HEX_RE = /^[0-9a-f]{64}$/i;
const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ContractValidationError(
      'invalid_string',
      `El campo "${field}" debe ser una cadena no vacía.`,
    );
  }
  return value.trim();
}

function assertOptionalStringOrNull(value: unknown, field: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new ContractValidationError(
      'invalid_optional_string',
      `El campo "${field}" debe ser texto o null.`,
    );
  }
  return value;
}

function assertFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ContractValidationError(
      'invalid_number',
      `El campo "${field}" debe ser un número finito.`,
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

function assertPositiveFinite(value: unknown, field: string): number {
  const n = assertFiniteNumber(value, field);
  if (n <= 0) {
    throw new ContractValidationError(
      'invalid_positive_number',
      `El campo "${field}" debe ser estrictamente positivo.`,
    );
  }
  return n;
}

function assertNonNegativeFinite(value: unknown, field: string): number {
  const n = assertFiniteNumber(value, field);
  if (n < 0) {
    throw new ContractValidationError(
      'invalid_non_negative_number',
      `El campo "${field}" no puede ser negativo.`,
    );
  }
  return n;
}

function assertIntAtLeast(value: unknown, min: number, field: string): number {
  const n = assertFiniteNumber(value, field);
  if (!Number.isInteger(n) || n < min) {
    throw new ContractValidationError(
      'invalid_integer',
      `El campo "${field}" debe ser un entero >= ${min}.`,
    );
  }
  return n;
}

function assertTuple2(value: unknown, field: string): readonly [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new ContractValidationError(
      'invalid_tuple2',
      `El campo "${field}" debe ser un par numérico [a, b].`,
    );
  }
  return [
    assertFiniteNumber(value[0], `${field}[0]`),
    assertFiniteNumber(value[1], `${field}[1]`),
  ];
}

function assertExtent4(
  value: unknown,
  field: string,
): readonly [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new ContractValidationError(
      'invalid_extent',
      `El campo "${field}" debe ser una extensión [W, S, E, N].`,
    );
  }
  const w = assertFiniteNumber(value[0], `${field}[0]`);
  const s = assertFiniteNumber(value[1], `${field}[1]`);
  const e = assertFiniteNumber(value[2], `${field}[2]`);
  const n = assertFiniteNumber(value[3], `${field}[3]`);
  if (e <= w || n <= s) {
    throw new ContractValidationError(
      'invalid_extent_order',
      `La extensión "${field}" requiere este > oeste y norte > sur.`,
    );
  }
  return [w, s, e, n];
}

export function sanitizeSafeRelativeAssetPath(value: unknown, field: string): string {
  const raw = assertNonEmptyString(value, field);
  if (
    raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.includes('\\') ||
    raw.includes('?') ||
    raw.includes('#') ||
    URL_SCHEME_RE.test(raw)
  ) {
    throw new ContractValidationError(
      'unsafe_asset_path',
      `La ruta local "${field}" no es una ruta relativa válida dentro del paquete.`,
    );
  }
  const segments = raw.split('/');
  if (segments.some((seg) => seg.length === 0 || seg === '.' || seg === '..')) {
    throw new ContractValidationError(
      'unsafe_asset_path',
      `La ruta local "${field}" contiene segmentos no permitidos.`,
    );
  }
  return raw;
}

export function sanitizeExternalHttpUrl(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function resolveTerrainEntryUrl(baseUrl: string, originHref: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const baseRoot = new URL(normalizedBase, originHref);
  return new URL('demo/jezero/terrain.json', baseRoot).toString();
}

export function resolvePackageAssetUrl(
  declaringJsonUrl: string,
  relativePath: string,
  packageRootUrl: string,
): string {
  const safeRelative = sanitizeSafeRelativeAssetPath(relativePath, 'path');
  const resolved = new URL(safeRelative, declaringJsonUrl);
  const root = new URL(packageRootUrl);
  const rootDir = root.pathname.endsWith('/')
    ? root.pathname
    : root.pathname.slice(0, root.pathname.lastIndexOf('/') + 1);
  if (resolved.origin !== root.origin || !resolved.pathname.startsWith(rootDir)) {
    throw new ContractValidationError(
      'asset_escapes_package',
      `El recurso "${relativePath}" sale del directorio del paquete local.`,
    );
  }
  return resolved.toString();
}

function parseBinaryAssetDescriptor(
  value: unknown,
  field: string,
  expectedFormat?: string,
): BinaryAssetDescriptor {
  if (!isRecord(value)) {
    throw new ContractValidationError(
      'invalid_asset_descriptor',
      `El descriptor "${field}" debe ser un objeto.`,
    );
  }
  const path = sanitizeSafeRelativeAssetPath(value.path, `${field}.path`);
  const format = assertNonEmptyString(value.format, `${field}.format`);
  if (expectedFormat && format !== expectedFormat) {
    throw new ContractValidationError(
      'invalid_asset_format',
      `El formato de "${field}" debe ser "${expectedFormat}".`,
    );
  }
  const byteLength = assertIntAtLeast(value.byteLength, 1, `${field}.byteLength`);
  const sha256 = assertNonEmptyString(value.sha256, `${field}.sha256`).toLowerCase();
  if (!SHA256_HEX_RE.test(sha256)) {
    throw new ContractValidationError(
      'invalid_sha256',
      `El SHA-256 de "${field}" no tiene 64 dígitos hexadecimales.`,
    );
  }
  return { path, format, byteLength, sha256 };
}

function parseGridSpec(value: unknown, field: string, minSize: number): GridSpec {
  if (!isRecord(value)) {
    throw new ContractValidationError(
      'invalid_grid',
      `La rejilla "${field}" debe ser un objeto.`,
    );
  }
  const width = assertIntAtLeast(value.width, minSize, `${field}.width`);
  const height = assertIntAtLeast(value.height, minSize, `${field}.height`);
  const extentM = assertExtent4(value.extentM, `${field}.extentM`);
  return { width, height, extentM };
}

export function parseAndValidateTerrainManifest(raw: unknown): TerrainManifestV1 {
  if (!isRecord(raw)) {
    throw new ContractValidationError(
      'invalid_terrain_manifest',
      'El manifiesto de terreno debe ser un objeto JSON.',
    );
  }
  if (raw.contract !== 'terrain/v1') {
    throw new ContractValidationError(
      'unsupported_terrain_contract',
      `Versión de contrato de terreno incompatible: ${String(raw.contract)}.`,
    );
  }

  const id = assertNonEmptyString(raw.id, 'id');
  const scenarioAsset = sanitizeSafeRelativeAssetPath(raw.scenarioAsset, 'scenarioAsset');

  if (!isRecord(raw.frame)) {
    throw new ContractValidationError('invalid_frame', 'Falta el bloque "frame" en el terreno.');
  }
  const latitudeType = raw.frame.latitudeType;
  const longitudeDomain = raw.frame.longitudeDomain;
  if (latitudeType !== 'planetocentric' || longitudeDomain !== '0_to_360_east') {
    throw new ContractValidationError(
      'unsupported_crs_convention',
      'El marco debe declarar latitud planetocéntrica y longitud este [0,360).',
    );
  }
  const projection = assertNonEmptyString(raw.frame.projection, 'frame.projection');
  if (/wgs84|epsg:4326|6378137/i.test(projection)) {
    throw new ContractValidationError(
      'unsupported_earth_projection',
      'No se admite una proyección terrestre/WGS84 sin transformación planetaria fundamentada.',
    );
  }
  if (!/\+proj=eqc\b/.test(projection) || !/\+R=3396190\b/.test(projection)) {
    throw new ContractValidationError(
      'unsupported_mars_projection',
      'El marco debe usar proyección equirectangular de Marte (+proj=eqc +R=3396190).',
    );
  }
  const frame: TerrainFrameSpec = {
    id: assertNonEmptyString(raw.frame.id, 'frame.id'),
    projection,
    latitudeType,
    longitudeDomain,
    sceneOriginProjectedM: assertTuple2(
      raw.frame.sceneOriginProjectedM,
      'frame.sceneOriginProjectedM',
    ),
    verticalDatum: assertNonEmptyString(raw.frame.verticalDatum, 'frame.verticalDatum'),
    heightOriginM: assertFiniteNumber(raw.frame.heightOriginM, 'frame.heightOriginM'),
    verticalExaggeration: assertPositiveFinite(
      raw.frame.verticalExaggeration,
      'frame.verticalExaggeration',
    ),
  };

  const grid = parseGridSpec(raw.grid, 'grid', 2);
  const totalGridCells = grid.width * grid.height;

  const heightAsset = parseBinaryAssetDescriptor(raw.heightAsset, 'heightAsset', 'float32-le');
  if (heightAsset.byteLength !== totalGridCells * 4) {
    throw new ContractValidationError(
      'height_byte_length_mismatch',
      `El tamaño declarado de alturas (${heightAsset.byteLength} B) no coincide con ${totalGridCells * 4} B.`,
    );
  }

  const heightMaskAsset = parseBinaryAssetDescriptor(
    raw.heightMaskAsset,
    'heightMaskAsset',
    'uint8',
  );
  if (heightMaskAsset.byteLength !== totalGridCells) {
    throw new ContractValidationError(
      'mask_byte_length_mismatch',
      `El tamaño declarado de máscara (${heightMaskAsset.byteLength} B) no coincide con ${totalGridCells} B.`,
    );
  }

  if (!Array.isArray(raw.sources) || raw.sources.length === 0) {
    throw new ContractValidationError('missing_sources', 'El terreno debe declarar sus fuentes.');
  }
  const sourceIds = new Set<string>();
  const sources: TerrainSourceSpec[] = raw.sources.map((entry, idx) => {
    if (!isRecord(entry)) {
      throw new ContractValidationError('invalid_source', `Fuente #${idx} inválida.`);
    }
    const sourceId = assertNonEmptyString(entry.id, `sources[${idx}].id`);
    if (sourceIds.has(sourceId)) {
      throw new ContractValidationError(
        'duplicate_source_id',
        `ID de fuente duplicado: "${sourceId}".`,
      );
    }
    sourceIds.add(sourceId);
    return {
      id: sourceId,
      kind: assertNonEmptyString(entry.kind, `sources[${idx}].kind`),
      productId: assertNonEmptyString(entry.productId, `sources[${idx}].productId`),
      credit: assertNonEmptyString(entry.credit, `sources[${idx}].credit`),
      mission: typeof entry.mission === 'string' ? entry.mission : undefined,
      instrument: typeof entry.instrument === 'string' ? entry.instrument : undefined,
      revision: typeof entry.revision === 'string' ? entry.revision : undefined,
      license: typeof entry.license === 'string' ? entry.license : undefined,
      nativeResolutionMpp:
        typeof entry.nativeResolutionMpp === 'number' &&
        Number.isFinite(entry.nativeResolutionMpp)
          ? entry.nativeResolutionMpp
          : undefined,
      url: sanitizeExternalHttpUrl(entry.url) ?? undefined,
      referenceUrl: sanitizeExternalHttpUrl(entry.referenceUrl) ?? undefined,
      stacItemUrl: sanitizeExternalHttpUrl(entry.stacItemUrl) ?? undefined,
      documentationUrl: sanitizeExternalHttpUrl(entry.documentationUrl) ?? undefined,
      verticalDatum:
        entry.verticalDatum === null
          ? null
          : typeof entry.verticalDatum === 'string'
            ? entry.verticalDatum
            : undefined,
    };
  });

  const heightSourceId = assertNonEmptyString(raw.heightSourceId, 'heightSourceId');
  if (!sourceIds.has(heightSourceId)) {
    throw new ContractValidationError(
      'unknown_height_source',
      `La fuente de elevación "${heightSourceId}" no existe en "sources".`,
    );
  }

  if (!isRecord(raw.elevationLegend)) {
    throw new ContractValidationError('missing_elevation_legend', 'Falta elevationLegend.');
  }
  const minM = assertFiniteNumber(raw.elevationLegend.minM, 'elevationLegend.minM');
  const maxM = assertFiniteNumber(raw.elevationLegend.maxM, 'elevationLegend.maxM');
  if (maxM < minM) {
    throw new ContractValidationError(
      'invalid_elevation_legend',
      'elevationLegend.maxM debe ser >= minM.',
    );
  }
  const elevationLegend = {
    unit: assertNonEmptyString(raw.elevationLegend.unit, 'elevationLegend.unit'),
    minM,
    maxM,
  };

  if (!isRecord(raw.coverage)) {
    throw new ContractValidationError('missing_coverage', 'Falta coverage en el terreno.');
  }
  const totalSamples = assertIntAtLeast(raw.coverage.totalSamples, 1, 'coverage.totalSamples');
  const validSamples = assertIntAtLeast(raw.coverage.validSamples, 0, 'coverage.validSamples');
  if (totalSamples !== totalGridCells || validSamples > totalSamples) {
    throw new ContractValidationError(
      'invalid_coverage_counts',
      'Los conteos de cobertura DEM no coinciden con la rejilla.',
    );
  }

  const textureAsset =
    raw.textureAsset === null || raw.textureAsset === undefined
      ? null
      : parseBinaryAssetDescriptor(raw.textureAsset, 'textureAsset');

  if (!isRecord(raw.thermal)) {
    throw new ContractValidationError('missing_thermal', 'Falta el bloque "thermal".');
  }
  const thermalSourceId = assertNonEmptyString(raw.thermal.sourceId, 'thermal.sourceId');
  if (!sourceIds.has(thermalSourceId)) {
    throw new ContractValidationError(
      'unknown_thermal_source',
      `La fuente térmica "${thermalSourceId}" no existe en "sources".`,
    );
  }
  const thermalAsset = parseBinaryAssetDescriptor(
    raw.thermal.asset,
    'thermal.asset',
    'png-rgba8',
  );
  const thermalGrid = parseGridSpec(raw.thermal.grid, 'thermal.grid', 1);
  const thermalNativeResolutionMpp = assertPositiveFinite(
    raw.thermal.nativeResolutionMpp,
    'thermal.nativeResolutionMpp',
  );
  if (!isRecord(raw.thermal.legend)) {
    throw new ContractValidationError('missing_thermal_legend', 'Falta thermal.legend.');
  }
  const lowDN = assertFiniteNumber(raw.thermal.legend.lowDN, 'thermal.legend.lowDN');
  const highDN = assertFiniteNumber(raw.thermal.legend.highDN, 'thermal.legend.highDN');
  if (highDN < lowDN) {
    throw new ContractValidationError(
      'invalid_thermal_legend',
      'thermal.legend.highDN debe ser >= lowDN.',
    );
  }
  if (!isRecord(raw.thermal.acquisition)) {
    throw new ContractValidationError('missing_thermal_acquisition', 'Falta thermal.acquisition.');
  }
  if (!isRecord(raw.thermal.coverage)) {
    throw new ContractValidationError('missing_thermal_coverage', 'Falta thermal.coverage.');
  }
  const thermalTotal = assertIntAtLeast(
    raw.thermal.coverage.totalSamples,
    1,
    'thermal.coverage.totalSamples',
  );
  const thermalValid = assertIntAtLeast(
    raw.thermal.coverage.validSamples,
    0,
    'thermal.coverage.validSamples',
  );
  if (
    thermalTotal !== thermalGrid.width * thermalGrid.height ||
    thermalValid > thermalTotal
  ) {
    throw new ContractValidationError(
      'invalid_thermal_coverage',
      'Los conteos de cobertura térmica no coinciden con thermal.grid.',
    );
  }

  return {
    contract: 'terrain/v1',
    id,
    scenarioAsset,
    frame,
    grid,
    heightAsset,
    heightMaskAsset,
    heightSourceId,
    elevationLegend,
    coverage: { validSamples, totalSamples },
    textureAsset,
    thermal: {
      sourceId: thermalSourceId,
      asset: thermalAsset,
      grid: thermalGrid,
      nativeResolutionMpp: thermalNativeResolutionMpp,
      legend: {
        label: assertNonEmptyString(raw.thermal.legend.label, 'thermal.legend.label'),
        scale: assertNonEmptyString(raw.thermal.legend.scale, 'thermal.legend.scale'),
        lowDN,
        highDN,
      },
      acquisition: {
        kind: assertNonEmptyString(raw.thermal.acquisition.kind, 'thermal.acquisition.kind'),
        illumination: assertNonEmptyString(
          raw.thermal.acquisition.illumination,
          'thermal.acquisition.illumination',
        ),
        startUtc: assertOptionalStringOrNull(
          raw.thermal.acquisition.startUtc,
          'thermal.acquisition.startUtc',
        ),
        endUtc: assertOptionalStringOrNull(
          raw.thermal.acquisition.endUtc,
          'thermal.acquisition.endUtc',
        ),
        missingReason: assertOptionalStringOrNull(
          raw.thermal.acquisition.missingReason,
          'thermal.acquisition.missingReason',
        ),
      },
      coverage: { validSamples: thermalValid, totalSamples: thermalTotal },
    },
    sources,
  };
}

// Pure-TS SHA-256 fallback used only if crypto.subtle is unavailable (e.g. non-localhost HTTP).
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256FallbackHex(data: Uint8Array): string {
  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  const bitLen = data.length * 8;
  const paddedLen = Math.ceil((data.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;
      const s0 = rotr(7, w15) ^ rotr(18, w15) ^ (w15 >>> 3);
      const s1 = rotr(17, w2) ^ rotr(19, w2) ^ (w2 >>> 10);
      w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + (SHA256_K[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((val) => val.toString(16).padStart(8, '0'))
    .join('');
}

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256FallbackHex(bytes);
}

export async function verifyBinaryIntegrity(
  bytes: Uint8Array,
  descriptor: BinaryAssetDescriptor,
  label: string,
): Promise<void> {
  if (bytes.byteLength !== descriptor.byteLength) {
    throw new ContractValidationError(
      'byte_length_mismatch',
      `El tamaño de ${label} (${bytes.byteLength} B) no coincide con el manifiesto (${descriptor.byteLength} B).`,
    );
  }
  const actualHash = await computeSha256Hex(bytes);
  if (actualHash !== descriptor.sha256.toLowerCase()) {
    throw new ContractValidationError(
      'sha256_mismatch',
      `La suma SHA-256 de ${label} no coincide con la declarada en el manifiesto.`,
    );
  }
}

export function decodeAndValidateDemBinaries(
  manifest: TerrainManifestV1,
  heightBytes: Uint8Array,
  maskBytes: Uint8Array,
): TerrainGridData {
  const { width, height, extentM } = manifest.grid;
  const totalSamples = width * height;

  if (heightBytes.byteLength !== totalSamples * 4) {
    throw new ContractValidationError(
      'height_buffer_length_mismatch',
      `El binario de alturas tiene ${heightBytes.byteLength} B; se esperaban ${totalSamples * 4} B.`,
    );
  }
  if (maskBytes.byteLength !== totalSamples) {
    throw new ContractValidationError(
      'mask_buffer_length_mismatch',
      `La máscara de alturas tiene ${maskBytes.byteLength} B; se esperaban ${totalSamples} B.`,
    );
  }

  const view = new DataView(
    heightBytes.buffer,
    heightBytes.byteOffset,
    heightBytes.byteLength,
  );
  const heights = new Float32Array(totalSamples);
  const mask = new Uint8Array(totalSamples);

  let validSamples = 0;
  let minElevationM = Number.POSITIVE_INFINITY;
  let maxElevationM = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < totalSamples; i += 1) {
    const m = maskBytes[i];
    if (m !== 0 && m !== 1) {
      throw new ContractValidationError(
        'invalid_mask_value',
        `Valor de máscara inválido (${String(m)}) en la celda ${i}; solo se admiten 0 o 1.`,
      );
    }
    mask[i] = m;

    const rawHeight = view.getFloat32(i * 4, true);
    const normalizedHeight = Object.is(rawHeight, -0) ? 0 : rawHeight;
    if (m === 1) {
      if (!Number.isFinite(normalizedHeight)) {
        throw new ContractValidationError(
          'non_finite_valid_height',
          `La celda válida ${i} contiene un valor de altura no finito.`,
        );
      }
      heights[i] = normalizedHeight;
      validSamples += 1;
      if (normalizedHeight < minElevationM) {
        minElevationM = normalizedHeight;
      }
      if (normalizedHeight > maxElevationM) {
        maxElevationM = normalizedHeight;
      }
    } else {
      heights[i] = 0;
    }
  }

  if (validSamples === 0) {
    throw new ContractValidationError(
      'empty_valid_dem',
      'El DEM no contiene ninguna muestra válida.',
    );
  }
  if (validSamples !== manifest.coverage.validSamples) {
    throw new ContractValidationError(
      'valid_sample_count_mismatch',
      `La máscara contiene ${validSamples} muestras válidas, distinto de las ${manifest.coverage.validSamples} declaradas.`,
    );
  }

  const legendMin = manifest.elevationLegend.minM;
  const legendMax = manifest.elevationLegend.maxM;
  if (
    Math.abs(minElevationM - legendMin) > 1e-3 ||
    Math.abs(maxElevationM - legendMax) > 1e-3
  ) {
    throw new ContractValidationError(
      'elevation_range_mismatch',
      `Los extremos reales [${minElevationM}, ${maxElevationM}] m no coinciden con la leyenda [${legendMin}, ${legendMax}] m.`,
    );
  }

  const [W, S, Emax, Nmax] = extentM;
  const dx = (Emax - W) / width;
  const dy = (Nmax - S) / height;
  const [E0, N0] = manifest.frame.sceneOriginProjectedM;
  const h0 = manifest.frame.heightOriginM;
  const exag = manifest.frame.verticalExaggeration;

  const xMin = W + 0.5 * dx - E0;
  const xMax = W + (width - 0.5) * dx - E0;
  const zMin = N0 - (Nmax - 0.5 * dy);
  const zMax = N0 - (Nmax - (height - 0.5) * dy);

  return {
    manifest,
    width,
    height,
    dx,
    dy,
    heights,
    mask,
    validSamples,
    totalSamples,
    minElevationM,
    maxElevationM,
    minY: (minElevationM - h0) * exag,
    maxY: (maxElevationM - h0) * exag,
    boundsXzM: [xMin, zMin, xMax, zMax],
  };
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

const ELEVATION_STOPS: readonly {
  readonly t: number;
  readonly rgb: readonly [number, number, number];
}[] = [
  { t: 0.0, rgb: [0x33 / 255, 0x2c / 255, 0x2d / 255] }, // Deep basalt shadow
  { t: 0.35, rgb: [0x61 / 255, 0x43 / 255, 0x35 / 255] }, // Iron oxide umber
  { t: 0.7, rgb: [0x9e / 255, 0x6f / 255, 0x4b / 255] }, // Ochre regolith
  { t: 1.0, rgb: [0xd4 / 255, 0xa3 / 255, 0x73 / 255] }, // Warm Jezero ridge sand
];

export function evaluateElevationRampLinear(tRaw: number): readonly [number, number, number] {
  const t = Math.max(0, Math.min(1, tRaw));
  for (let i = 0; i < ELEVATION_STOPS.length - 1; i += 1) {
    const a = ELEVATION_STOPS[i];
    const b = ELEVATION_STOPS[i + 1];
    if (a && b && t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1;
      const local = (t - a.t) / span;
      return [
        srgbToLinear(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * local),
        srgbToLinear(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * local),
        srgbToLinear(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * local),
      ];
    }
  }
  const last = ELEVATION_STOPS[ELEVATION_STOPS.length - 1]!;
  return [srgbToLinear(last.rgb[0]), srgbToLinear(last.rgb[1]), srgbToLinear(last.rgb[2])];
}

export function buildTerrainMeshData(grid: TerrainGridData): TerrainMeshBuffers {
  const { width, height, dx, dy, heights, mask, manifest } = grid;
  const [W, , , Nmax] = manifest.grid.extentM;
  const [E0, N0] = manifest.frame.sceneOriginProjectedM;
  const h0 = manifest.frame.heightOriginM;
  const exag = manifest.frame.verticalExaggeration;

  const [Wt, St, Emaxt, Nmaxt] = manifest.thermal.grid.extentM;
  const tSpanE = Emaxt - Wt;
  const tSpanN = Nmaxt - St;

  const totalVertices = width * height;
  const positions = new Float32Array(totalVertices * 3);
  const colorsLinear = new Float32Array(totalVertices * 3);
  const uvs = new Float32Array(totalVertices * 2);

  const elevMin = manifest.elevationLegend.minM;
  const elevSpan = manifest.elevationLegend.maxM - elevMin;
  const fallbackY = (grid.minElevationM - h0) * exag;

  let minBx = Number.POSITIVE_INFINITY;
  let minBy = Number.POSITIVE_INFINITY;
  let minBz = Number.POSITIVE_INFINITY;
  let maxBx = Number.NEGATIVE_INFINITY;
  let maxBy = Number.NEGATIVE_INFINITY;
  let maxBz = Number.NEGATIVE_INFINITY;

  for (let row = 0; row < height; row += 1) {
    const N = Nmax - (row + 0.5) * dy;
    const z = N0 - N;
    const vNorth = (Nmaxt - N) / tSpanN;
    const vFlipY = 1 - vNorth;

    for (let col = 0; col < width; col += 1) {
      const i = row * width + col;
      const E = W + (col + 0.5) * dx;
      const x = E - E0;
      const u = (E - Wt) / tSpanE;
      const isValid = mask[i] === 1;
      const h = heights[i] ?? 0;
      const y = isValid ? (h - h0) * exag : fallbackY;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      uvs[i * 2] = u;
      uvs[i * 2 + 1] = vFlipY;

      const tElev = isValid ? (elevSpan > 0 ? (h - elevMin) / elevSpan : 0.5) : 0;
      const [lr, lg, lb] = evaluateElevationRampLinear(tElev);
      colorsLinear[i * 3] = lr;
      colorsLinear[i * 3 + 1] = lg;
      colorsLinear[i * 3 + 2] = lb;

      if (isValid) {
        if (x < minBx) minBx = x;
        if (y < minBy) minBy = y;
        if (z < minBz) minBz = z;
        if (x > maxBx) maxBx = x;
        if (y > maxBy) maxBy = y;
        if (z > maxBz) maxBz = z;
      }
    }
  }

  const indexList: number[] = [];
  for (let row = 0; row < height - 1; row += 1) {
    for (let col = 0; col < width - 1; col += 1) {
      const nw = row * width + col;
      const ne = nw + 1;
      const sw = (row + 1) * width + col;
      const se = sw + 1;

      if (mask[nw] === 1 && mask[sw] === 1 && mask[ne] === 1) {
        indexList.push(nw, sw, ne);
      }
      if (mask[ne] === 1 && mask[sw] === 1 && mask[se] === 1) {
        indexList.push(ne, sw, se);
      }
    }
  }

  return {
    positions,
    colorsLinear,
    uvs,
    indices: new Uint32Array(indexList),
    triangleCount: indexList.length / 3,
    validVertexCount: grid.validSamples,
    boundsMin: [minBx, minBy, minBz],
    boundsMax: [maxBx, maxBy, maxBz],
  };
}

function interpolateTriangle(
  grid: TerrainGridData,
  i0: number,
  i1: number,
  i2: number,
  w0: number,
  w1: number,
  w2: number,
  x: number,
  z: number,
): TerrainSample | null {
  if (grid.mask[i0] !== 1 || grid.mask[i1] !== 1 || grid.mask[i2] !== 1) {
    return null;
  }
  const h0 = grid.heights[i0]!;
  const h1 = grid.heights[i1]!;
  const h2 = grid.heights[i2]!;
  const elevationM = w0 * h0 + w1 * h1 + w2 * h2;
  const { heightOriginM, verticalExaggeration } = grid.manifest.frame;
  const y = (elevationM - heightOriginM) * verticalExaggeration;
  return {
    x,
    y,
    z,
    elevationM,
    triangle: [i0, i1, i2],
  };
}

function sampleQuadAt(
  grid: TerrainGridData,
  row: number,
  col: number,
  sRaw: number,
  tRaw: number,
  x: number,
  z: number,
): TerrainSample | null {
  const s = Math.max(0, Math.min(1, sRaw));
  const t = Math.max(0, Math.min(1, tRaw));
  const nw = row * grid.width + col;
  const ne = nw + 1;
  const sw = (row + 1) * grid.width + col;
  const se = sw + 1;

  const eps = 1e-9;
  const sum = s + t;
  if (sum <= 1 + eps) {
    const tri1 = interpolateTriangle(grid, nw, sw, ne, 1 - s - t, t, s, x, z);
    if (tri1) {
      return tri1;
    }
    if (sum >= 1 - eps) {
      return interpolateTriangle(grid, ne, sw, se, 1 - t, 1 - s, s + t - 1, x, z);
    }
    return null;
  }

  return interpolateTriangle(grid, ne, sw, se, 1 - t, 1 - s, s + t - 1, x, z);
}

/**
 * Barycentric terrain sampling on the exact (NW, SW, NE) and (NE, SW, SE) triangles.
 * Returns null if (x, z) is outside the valid cell-center bounds or lies over a NoData triangle.
 */
export function sampleTerrainAtXz(
  grid: TerrainGridData,
  x: number,
  z: number,
): TerrainSample | null {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return null;
  }
  const [xMin, zMin] = grid.boundsXzM;
  const uCol = (x - xMin) / grid.dx;
  const vRow = (z - zMin) / grid.dy;
  const eps = 1e-9;

  if (
    uCol < -eps ||
    uCol > grid.width - 1 + eps ||
    vRow < -eps ||
    vRow > grid.height - 1 + eps
  ) {
    return null;
  }

  const clampedU = Math.max(0, Math.min(grid.width - 1, uCol));
  const clampedV = Math.max(0, Math.min(grid.height - 1, vRow));

  const maxCol = grid.width - 2;
  const maxRow = grid.height - 2;
  const baseCol = Math.min(maxCol, Math.max(0, Math.floor(clampedU)));
  const baseRow = Math.min(maxRow, Math.max(0, Math.floor(clampedV)));

  const candidateCols: number[] = [baseCol];
  const nearRoundU = Math.round(clampedU);
  if (Math.abs(clampedU - nearRoundU) <= eps) {
    if (nearRoundU - 1 >= 0 && nearRoundU - 1 <= maxCol && nearRoundU - 1 !== baseCol) {
      candidateCols.push(nearRoundU - 1);
    }
    if (nearRoundU >= 0 && nearRoundU <= maxCol && nearRoundU !== baseCol) {
      candidateCols.push(nearRoundU);
    }
  }

  const candidateRows: number[] = [baseRow];
  const nearRoundV = Math.round(clampedV);
  if (Math.abs(clampedV - nearRoundV) <= eps) {
    if (nearRoundV - 1 >= 0 && nearRoundV - 1 <= maxRow && nearRoundV - 1 !== baseRow) {
      candidateRows.push(nearRoundV - 1);
    }
    if (nearRoundV >= 0 && nearRoundV <= maxRow && nearRoundV !== baseRow) {
      candidateRows.push(nearRoundV);
    }
  }

  // Inspect primary quad first, then adjacent edge/corner quads when right on a shared grid line.
  for (const rCand of candidateRows) {
    const t = clampedV - rCand;
    for (const cCand of candidateCols) {
      const s = clampedU - cCand;
      const hit = sampleQuadAt(grid, rCand, cCand, s, t, x, z);
      if (hit) {
        return hit;
      }
    }
  }

  return null;
}

function clipUnitSegmentToGrid(
  u0: number,
  v0: number,
  du: number,
  dv: number,
  uMax: number,
  vMax: number,
): readonly [number, number] | null {
  const eps = 1e-9;
  let t0 = 0;
  let t1 = 1;

  const clipAxis = (p: number, q: number): boolean => {
    if (Math.abs(p) <= 1e-14) {
      return q >= 0;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  if (
    !clipAxis(-du, u0 + eps) ||
    !clipAxis(du, uMax + eps - u0) ||
    !clipAxis(-dv, v0 + eps) ||
    !clipAxis(dv, vMax + eps - v0) ||
    t0 > t1
  ) {
    return null;
  }

  return [Math.max(0, t0), Math.min(1, t1)];
}

function collectStructuralSegmentCuts(
  grid: TerrainGridData,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
): number[] {
  const [xMin, zMin] = grid.boundsXzM;
  const u0 = (x0 - xMin) / grid.dx;
  const v0 = (z0 - zMin) / grid.dy;
  const u1 = (x1 - xMin) / grid.dx;
  const v1 = (z1 - zMin) / grid.dy;
  const du = u1 - u0;
  const dv = v1 - v0;
  const dw = du + dv;
  const w0 = u0 + v0;

  const rawCuts: number[] = [0, 1];
  const uMax = grid.width - 1;
  const vMax = grid.height - 1;
  const clipped = clipUnitSegmentToGrid(u0, v0, du, dv, uMax, vMax);

  if (clipped) {
    const [fLo, fHi] = clipped;
    if (fLo > 1e-10 && fLo < 1 - 1e-10) rawCuts.push(fLo);
    if (fHi > 1e-10 && fHi < 1 - 1e-10) rawCuts.push(fHi);

    const uLo = u0 + du * fLo;
    const uHi = u0 + du * fHi;
    if (Math.abs(du) > 1e-12) {
      const cStart = Math.max(0, Math.ceil(Math.min(uLo, uHi)));
      const cEnd = Math.min(uMax, Math.floor(Math.max(uLo, uHi)));
      for (let c = cStart; c <= cEnd; c += 1) {
        const f = (c - u0) / du;
        if (f > 1e-10 && f < 1 - 1e-10) rawCuts.push(f);
      }
    }

    const vLo = v0 + dv * fLo;
    const vHi = v0 + dv * fHi;
    if (Math.abs(dv) > 1e-12) {
      const rStart = Math.max(0, Math.ceil(Math.min(vLo, vHi)));
      const rEnd = Math.min(vMax, Math.floor(Math.max(vLo, vHi)));
      for (let r = rStart; r <= rEnd; r += 1) {
        const f = (r - v0) / dv;
        if (f > 1e-10 && f < 1 - 1e-10) rawCuts.push(f);
      }
    }

    const wLo = w0 + dw * fLo;
    const wHi = w0 + dw * fHi;
    if (Math.abs(dw) > 1e-12) {
      const kStart = Math.max(1, Math.ceil(Math.min(wLo, wHi)));
      const kEnd = Math.min(uMax + vMax - 1, Math.floor(Math.max(wLo, wHi)));
      for (let k = kStart; k <= kEnd; k += 1) {
        const f = (k - w0) / dw;
        if (f > 1e-10 && f < 1 - 1e-10) rawCuts.push(f);
      }
    }
  }

  rawCuts.sort((a, b) => a - b);
  const deduped: number[] = [0];
  for (let i = 1; i < rawCuts.length; i += 1) {
    const val = rawCuts[i]!;
    if (val - deduped[deduped.length - 1]! > 1e-10) {
      deduped.push(val);
    }
  }
  if (deduped[deduped.length - 1]! < 1) {
    if (1 - deduped[deduped.length - 1]! <= 1e-10) {
      deduped[deduped.length - 1] = 1;
    } else {
      deduped.push(1);
    }
  }
  return deduped;
}

export function drapePolylineOnTerrain(
  grid: TerrainGridData,
  pathXzM: readonly (readonly [number, number])[],
  stepSpacingM: number = Math.min(grid.dx, grid.dy) * 0.5,
  visualLiftM: number = 0,
): DrapedPolylineResult {
  if (pathXzM.length < 2) {
    throw new ContractValidationError(
      'invalid_polyline',
      'Cada traza requiere al menos dos vértices.',
    );
  }

  const effectiveStep = Math.max(1e-3, Math.min(stepSpacingM, Math.min(grid.dx, grid.dy)));
  const runs: DrapedPoint[][] = [];
  let currentRun: DrapedPoint[] = [];
  let hasCoverageGap = false;
  let totalSamples = 0;
  let validSamples = 0;
  let lengthM = 0;

  const appendValidSample = (sampled: TerrainSample) => {
    const prev = currentRun[currentRun.length - 1];
    if (
      prev &&
      Math.abs(prev.x - sampled.x) <= 1e-9 &&
      Math.abs(prev.z - sampled.z) <= 1e-9
    ) {
      return;
    }
    totalSamples += 1;
    validSamples += 1;
    currentRun.push({
      x: sampled.x,
      y: sampled.y + visualLiftM,
      z: sampled.z,
      elevationM: sampled.elevationM,
    });
  };

  const recordGap = () => {
    totalSamples += 1;
    hasCoverageGap = true;
    if (currentRun.length > 0) {
      runs.push(currentRun);
      currentRun = [];
    }
  };

  for (let segIdx = 0; segIdx < pathXzM.length - 1; segIdx += 1) {
    const [x0, z0] = pathXzM[segIdx]!;
    const [x1, z1] = pathXzM[segIdx + 1]!;
    const segLen = Math.hypot(x1 - x0, z1 - z0);
    lengthM += segLen;

    if (segIdx === 0) {
      const startSample = sampleTerrainAtXz(grid, x0, z0);
      if (startSample) {
        appendValidSample(startSample);
      } else {
        recordGap();
      }
    }

    if (segLen <= 1e-12) {
      continue;
    }

    const cuts = collectStructuralSegmentCuts(grid, x0, z0, x1, z1);
    for (let k = 0; k < cuts.length - 1; k += 1) {
      const fa = cuts[k]!;
      const fb = cuts[k + 1]!;
      const fMid = 0.5 * (fa + fb);
      const midX = x0 + (x1 - x0) * fMid;
      const midZ = z0 + (z1 - z0) * fMid;
      const midSample = sampleTerrainAtXz(grid, midX, midZ);

      if (!midSample) {
        recordGap();
        // If re-entering valid terrain right at fb (e.g. a grid boundary/vertex), start new run cleanly.
        const endSample = sampleTerrainAtXz(
          grid,
          x0 + (x1 - x0) * fb,
          z0 + (z1 - z0) * fb,
        );
        if (endSample) {
          appendValidSample(endSample);
        }
        continue;
      }

      if (currentRun.length === 0) {
        const startEdgeSample = sampleTerrainAtXz(
          grid,
          x0 + (x1 - x0) * fa,
          z0 + (z1 - z0) * fa,
        );
        if (startEdgeSample) {
          appendValidSample(startEdgeSample);
        } else {
          appendValidSample(midSample);
        }
      }

      const subLenM = segLen * (fb - fa);
      const subSteps = Math.max(1, Math.ceil(subLenM / effectiveStep));
      for (let s = 1; s < subSteps; s += 1) {
        const frac = fa + ((fb - fa) * s) / subSteps;
        const inner = sampleTerrainAtXz(
          grid,
          x0 + (x1 - x0) * frac,
          z0 + (z1 - z0) * frac,
        );
        if (inner) {
          appendValidSample(inner);
        } else {
          recordGap();
        }
      }

      const endSample = sampleTerrainAtXz(
        grid,
        x0 + (x1 - x0) * fb,
        z0 + (z1 - z0) * fb,
      );
      if (endSample) {
        appendValidSample(endSample);
      } else {
        appendValidSample(midSample);
        recordGap();
      }
    }
  }

  if (currentRun.length > 0) {
    runs.push(currentRun);
  }

  return {
    runs,
    hasCoverageGap,
    totalSamples,
    validSamples,
    lengthM,
  };
}

function parseMovement(
  value: unknown,
  field: string,
  expectedFromId: string,
  expectedToId: string,
  poiCoords: ReadonlyMap<string, readonly [number, number]>,
): ScenarioMovement {
  if (!isRecord(value)) {
    throw new ContractValidationError('invalid_movement', `Falta el movimiento "${field}".`);
  }
  const eventId = assertNonEmptyString(value.eventId, `${field}.eventId`);
  const minutes = assertNonNegativeFinite(value.minutes, `${field}.minutes`);
  const fromId = assertNonEmptyString(value.fromId, `${field}.fromId`);
  const toId = assertNonEmptyString(value.toId, `${field}.toId`);
  if (fromId !== expectedFromId || toId !== expectedToId) {
    throw new ContractValidationError(
      'movement_poi_mismatch',
      `El movimiento "${field}" debe unir "${expectedFromId}" -> "${expectedToId}".`,
    );
  }
  if (!Array.isArray(value.pathXzM) || value.pathXzM.length < 2) {
    throw new ContractValidationError(
      'invalid_movement_path',
      `El movimiento "${field}" debe incluir >= 2 vértices.`,
    );
  }
  const pathXzM = value.pathXzM.map((pt, idx) =>
    assertTuple2(pt, `${field}.pathXzM[${idx}]`),
  );

  const fromCoord = poiCoords.get(fromId);
  const toCoord = poiCoords.get(toId);
  const first = pathXzM[0]!;
  const last = pathXzM[pathXzM.length - 1]!;
  if (
    !fromCoord ||
    !toCoord ||
    Math.hypot(first[0] - fromCoord[0], first[1] - fromCoord[1]) > 1e-4 ||
    Math.hypot(last[0] - toCoord[0], last[1] - toCoord[1]) > 1e-4
  ) {
    throw new ContractValidationError(
      'movement_endpoint_mismatch',
      `Los extremos de "${field}.pathXzM" no coinciden con las posiciones de "${fromId}" y "${toId}".`,
    );
  }

  return { eventId, minutes, fromId, toId, pathXzM };
}

export function parseAndValidateScenarioManifest(
  raw: unknown,
  terrain: TerrainManifestV1,
): ScenarioManifestV1 {
  if (!isRecord(raw)) {
    throw new ContractValidationError(
      'invalid_scenario_manifest',
      'El manifiesto de escenario debe ser un objeto JSON.',
    );
  }
  if (raw.contract !== 'scenario/v1') {
    throw new ContractValidationError(
      'unsupported_scenario_contract',
      `Versión de contrato de escenario incompatible: ${String(raw.contract)}.`,
    );
  }

  const id = assertNonEmptyString(raw.id, 'id');
  const terrainId = assertNonEmptyString(raw.terrainId, 'terrainId');
  if (terrainId !== terrain.id) {
    throw new ContractValidationError(
      'terrain_id_mismatch',
      `El escenario referencia terrainId "${terrainId}", pero el terreno cargado es "${terrain.id}".`,
    );
  }
  const frameId = assertNonEmptyString(raw.frameId, 'frameId');
  if (frameId !== terrain.frame.id) {
    throw new ContractValidationError(
      'frame_id_mismatch',
      `El escenario referencia frameId "${frameId}", distinto al marco del terreno "${terrain.frame.id}".`,
    );
  }
  const geometryVersion = assertNonEmptyString(raw.geometryVersion, 'geometryVersion');
  const budgetMin = assertNonNegativeFinite(raw.budgetMin, 'budgetMin');
  const reserveMin = assertPositiveFinite(raw.reserveMin, 'reserveMin');

  if (!isRecord(raw.base)) {
    throw new ContractValidationError('invalid_base_poi', 'Falta la base en scenario.');
  }
  if (raw.base.simulated !== true) {
    throw new ContractValidationError(
      'poi_must_be_simulated',
      'La base debe declararse explícitamente como simulated: true.',
    );
  }
  const base: ScenarioPoiBase = {
    id: assertNonEmptyString(raw.base.id, 'base.id'),
    xzM: assertTuple2(raw.base.xzM, 'base.xzM'),
    simulated: true,
  };

  if (!Array.isArray(raw.stops) || raw.stops.length < 2) {
    throw new ContractValidationError(
      'invalid_stops',
      'El escenario debe declarar al menos la parada principal y la parada extra.',
    );
  }

  const poiCoords = new Map<string, readonly [number, number]>([[base.id, base.xzM]]);
  const stops: ScenarioStop[] = raw.stops.map((entry, idx) => {
    if (!isRecord(entry)) {
      throw new ContractValidationError('invalid_stop', `Parada #${idx} inválida.`);
    }
    if (entry.simulated !== true) {
      throw new ContractValidationError(
        'poi_must_be_simulated',
        `La parada #${idx} debe declararse como simulated: true.`,
      );
    }
    const stopId = assertNonEmptyString(entry.id, `stops[${idx}].id`);
    if (poiCoords.has(stopId)) {
      throw new ContractValidationError(
        'duplicate_poi_id',
        `Identificador de parada duplicado: "${stopId}".`,
      );
    }
    const xzM = assertTuple2(entry.xzM, `stops[${idx}].xzM`);
    poiCoords.set(stopId, xzM);

    const contextIds = Array.isArray(entry.contextIds)
      ? entry.contextIds.map((c, cIdx) =>
          assertNonEmptyString(c, `stops[${idx}].contextIds[${cIdx}]`),
        )
      : [];

    return {
      id: stopId,
      xzM,
      simulated: true,
      anchorControl: assertOptionalStringOrNull(
        entry.anchorControl,
        `stops[${idx}].anchorControl`,
      ),
      anchorLonLat:
        entry.anchorLonLat === null || entry.anchorLonLat === undefined
          ? null
          : assertTuple2(entry.anchorLonLat, `stops[${idx}].anchorLonLat`),
      evidenceId: assertOptionalStringOrNull(entry.evidenceId, `stops[${idx}].evidenceId`),
      contextIds,
    };
  });

  if (!poiCoords.has('science') || !poiCoords.has('extra-stop')) {
    throw new ContractValidationError(
      'missing_required_stops',
      'El escenario requiere las paradas "science" y "extra-stop".',
    );
  }

  if (!Array.isArray(raw.routes)) {
    throw new ContractValidationError('invalid_routes', 'Faltan las rutas A/B.');
  }
  const routes: ScenarioRouteEntry[] = raw.routes.map((entry, idx) => {
    if (!isRecord(entry)) {
      throw new ContractValidationError('invalid_route', `Ruta #${idx} inválida.`);
    }
    if (entry.id !== 'A' && entry.id !== 'B') {
      throw new ContractValidationError(
        'invalid_route_id',
        `Solo se admiten rutas A y B (recibido "${String(entry.id)}").`,
      );
    }
    if (entry.simulated !== true) {
      throw new ContractValidationError(
        'route_must_be_simulated',
        `La ruta ${entry.id} debe declararse como simulated: true.`,
      );
    }
    return {
      id: entry.id,
      simulated: true,
      outbound: parseMovement(
        entry.outbound,
        `routes[${idx}].outbound`,
        base.id,
        'science',
        poiCoords,
      ),
    };
  });

  if (
    routes.length !== 2 ||
    !routes.some((r) => r.id === 'A') ||
    !routes.some((r) => r.id === 'B')
  ) {
    throw new ContractValidationError(
      'missing_ab_routes',
      'El escenario debe incluir exactamente las rutas "A" y "B".',
    );
  }

  if (!isRecord(raw.shared) || !isRecord(raw.shared.observe)) {
    throw new ContractValidationError('invalid_shared', 'Falta el bloque "shared".');
  }
  const observeStopId = assertNonEmptyString(
    raw.shared.observe.stopId,
    'shared.observe.stopId',
  );
  if (observeStopId !== 'science') {
    throw new ContractValidationError(
      'invalid_observe_stop',
      'shared.observe.stopId debe apuntar a "science".',
    );
  }
  const observe = {
    eventId: assertNonEmptyString(raw.shared.observe.eventId, 'shared.observe.eventId'),
    minutes: assertNonNegativeFinite(raw.shared.observe.minutes, 'shared.observe.minutes'),
    stopId: observeStopId,
  };

  const extra = parseMovement(raw.shared.extra, 'shared.extra', 'science', 'extra-stop', poiCoords);
  const returnAfterExtra = parseMovement(
    raw.shared.returnAfterExtra,
    'shared.returnAfterExtra',
    'extra-stop',
    base.id,
    poiCoords,
  );
  const direct = parseMovement(raw.shared.direct, 'shared.direct', 'science', base.id, poiCoords);

  const eventIds = [
    ...routes.map((r) => r.outbound.eventId),
    observe.eventId,
    extra.eventId,
    returnAfterExtra.eventId,
    direct.eventId,
  ];
  if (new Set(eventIds).size !== eventIds.length) {
    throw new ContractValidationError(
      'duplicate_event_ids',
      'Los eventId de movimientos y observación en el escenario deben ser únicos.',
    );
  }

  const evidence: ScenarioEvidenceItem[] = [];
  const evidenceIds = new Set<string>();
  if (Array.isArray(raw.evidence)) {
    for (let idx = 0; idx < raw.evidence.length; idx += 1) {
      const item = raw.evidence[idx];
      if (!isRecord(item)) {
        throw new ContractValidationError('invalid_evidence', `Evidencia #${idx} inválida.`);
      }
      const evId = assertNonEmptyString(item.id, `evidence[${idx}].id`);
      if (evidenceIds.has(evId)) {
        throw new ContractValidationError(
          'duplicate_evidence_id',
          `Evidencia duplicada "${evId}".`,
        );
      }
      evidenceIds.add(evId);
      const captureDate = assertOptionalStringOrNull(
        item.captureDate,
        `evidence[${idx}].captureDate`,
      );
      const captureSol =
        item.captureSol === null || item.captureSol === undefined
          ? null
          : assertIntAtLeast(item.captureSol, 0, `evidence[${idx}].captureSol`);
      const captureLocation =
        item.captureLocation === null || item.captureLocation === undefined
          ? null
          : assertTuple2(item.captureLocation, `evidence[${idx}].captureLocation`);

      evidence.push({
        id: evId,
        kind: assertNonEmptyString(item.kind, `evidence[${idx}].kind`),
        productId: assertNonEmptyString(item.productId, `evidence[${idx}].productId`),
        asset: parseBinaryAssetDescriptor(item.asset, `evidence[${idx}].asset`),
        credit: assertNonEmptyString(item.credit, `evidence[${idx}].credit`),
        captureDate,
        captureSol,
        captureLocation,
        sourceUrl: sanitizeExternalHttpUrl(item.sourceUrl),
        missingReason: assertOptionalStringOrNull(
          item.missingReason,
          `evidence[${idx}].missingReason`,
        ),
        note: assertOptionalStringOrNull(item.note, `evidence[${idx}].note`),
      });
    }
  }

  const contextCards: ScenarioContextCard[] = [];
  const contextIds = new Set<string>();
  if (Array.isArray(raw.contextCards)) {
    for (let idx = 0; idx < raw.contextCards.length; idx += 1) {
      const card = raw.contextCards[idx];
      if (!isRecord(card)) {
        throw new ContractValidationError(
          'invalid_context_card',
          `Ficha de contexto #${idx} inválida.`,
        );
      }
      const cId = assertNonEmptyString(card.id, `contextCards[${idx}].id`);
      if (contextIds.has(cId)) {
        throw new ContractValidationError(
          'duplicate_context_id',
          `Ficha de contexto duplicada "${cId}".`,
        );
      }
      contextIds.add(cId);
      if (!Array.isArray(card.variables)) {
        throw new ContractValidationError(
          'invalid_context_variables',
          `contextCards[${idx}].variables debe ser una lista.`,
        );
      }
      const variables: ScenarioContextVariable[] = card.variables.map((v, vIdx) => {
        if (!isRecord(v)) {
          throw new ContractValidationError(
            'invalid_context_variable',
            `Variable #${vIdx} inválida.`,
          );
        }
        return {
          name: assertNonEmptyString(v.name, `contextCards[${idx}].variables[${vIdx}].name`),
          value: assertFiniteNumber(v.value, `contextCards[${idx}].variables[${vIdx}].value`),
          unit: assertNonEmptyString(v.unit, `contextCards[${idx}].variables[${vIdx}].unit`),
        };
      });

      contextCards.push({
        id: cId,
        kind: assertNonEmptyString(card.kind, `contextCards[${idx}].kind`),
        site: assertNonEmptyString(card.site, `contextCards[${idx}].site`),
        dateUtc: assertOptionalStringOrNull(card.dateUtc, `contextCards[${idx}].dateUtc`),
        dateLabel: assertOptionalStringOrNull(card.dateLabel, `contextCards[${idx}].dateLabel`),
        sol:
          card.sol === null || card.sol === undefined
            ? null
            : assertIntAtLeast(card.sol, 0, `contextCards[${idx}].sol`),
        credit: assertNonEmptyString(card.credit, `contextCards[${idx}].credit`),
        sourceUrl: sanitizeExternalHttpUrl(card.sourceUrl),
        variables,
      });
    }
  }

  for (const stop of stops) {
    if (stop.evidenceId && !evidenceIds.has(stop.evidenceId)) {
      throw new ContractValidationError(
        'unknown_evidence_ref',
        `La parada "${stop.id}" referencia evidencia inexistente "${stop.evidenceId}".`,
      );
    }
    for (const cid of stop.contextIds) {
      if (!contextIds.has(cid)) {
        throw new ContractValidationError(
          'unknown_context_ref',
          `La parada "${stop.id}" referencia contexto inexistente "${cid}".`,
        );
      }
    }
  }

  return {
    contract: 'scenario/v1',
    id,
    terrainId,
    frameId,
    geometryVersion,
    budgetMin,
    reserveMin,
    base,
    stops,
    routes,
    shared: { observe, extra, returnAfterExtra, direct },
    evidence,
    contextCards,
  };
}

export function validateScenarioOnTerrain(
  scenario: ScenarioManifestV1,
  grid: TerrainGridData,
  routeLiftM: number = 0.9,
): DrapedScenarioGeometry {
  if (
    scenario.terrainId !== grid.manifest.id ||
    scenario.frameId !== grid.manifest.frame.id
  ) {
    throw new ContractValidationError(
      'scenario_terrain_mismatch',
      'El escenario no coincide con el terreno y marco cargados.',
    );
  }

  const samplePoi = (
    id: string,
    xzM: readonly [number, number],
  ): DrapedPoint => {
    const sample = sampleTerrainAtXz(grid, xzM[0], xzM[1]);
    if (!sample) {
      throw new ContractValidationError(
        'poi_outside_valid_terrain',
        `El punto "${id}" en [${xzM[0]}, ${xzM[1]}] m cae fuera de triángulos válidos del DEM.`,
      );
    }
    return {
      x: sample.x,
      y: sample.y,
      z: sample.z,
      elevationM: sample.elevationM,
    };
  };

  const scienceStop = scenario.stops.find((s) => s.id === 'science')!;
  const extraStop = scenario.stops.find((s) => s.id === 'extra-stop')!;

  const basePoint = samplePoi(scenario.base.id, scenario.base.xzM);
  const sciencePoint = samplePoi(scienceStop.id, scienceStop.xzM);
  const extraPoint = samplePoi(extraStop.id, extraStop.xzM);

  const routeAEntry = scenario.routes.find((r) => r.id === 'A')!;
  const routeBEntry = scenario.routes.find((r) => r.id === 'B')!;

  const stepSpacing = Math.min(grid.dx, grid.dy) * 0.5;
  const routeA = drapePolylineOnTerrain(
    grid,
    routeAEntry.outbound.pathXzM,
    stepSpacing,
    routeLiftM,
  );
  const routeB = drapePolylineOnTerrain(
    grid,
    routeBEntry.outbound.pathXzM,
    stepSpacing,
    routeLiftM,
  );
  const extra = drapePolylineOnTerrain(
    grid,
    scenario.shared.extra.pathXzM,
    stepSpacing,
    routeLiftM,
  );
  const returnAfterExtra = drapePolylineOnTerrain(
    grid,
    scenario.shared.returnAfterExtra.pathXzM,
    stepSpacing,
    routeLiftM,
  );
  const direct = drapePolylineOnTerrain(
    grid,
    scenario.shared.direct.pathXzM,
    stepSpacing,
    routeLiftM,
  );

  const movementsList = [
    { name: 'Ruta A', res: routeA },
    { name: 'Ruta B', res: routeB },
    { name: 'Acceso parada extra', res: extra },
    { name: 'Regreso tras extra', res: returnAfterExtra },
    { name: 'Regreso directo', res: direct },
  ];
  for (const item of movementsList) {
    if (item.res.hasCoverageGap || item.res.validSamples === 0) {
      throw new ContractValidationError(
        'movement_crosses_nodata',
        `El tramo "${item.name}" atraviesa celdas sin cobertura válida del DEM.`,
      );
    }
  }

  return {
    base: { ...basePoint, id: scenario.base.id, simulated: true },
    science: {
      ...sciencePoint,
      id: scienceStop.id,
      simulated: true,
      anchorControl: scienceStop.anchorControl,
      anchorLonLat: scienceStop.anchorLonLat,
    },
    extraStop: {
      ...extraPoint,
      id: extraStop.id,
      simulated: true,
      anchorControl: extraStop.anchorControl,
      anchorLonLat: extraStop.anchorLonLat,
    },
    movements: {
      routeA,
      routeB,
      extra,
      returnAfterExtra,
      direct,
    },
  };
}

export function mapScenarioToMissionBaseline(
  scenario: ScenarioManifestV1,
  template: MissionBaselineConstants = SIMULATED_MISSION_BASELINE,
  hasValidatedGeometry: boolean = false,
): MissionBaselineConstants {
  const routeA = scenario.routes.find((r) => r.id === 'A')!;
  const routeB = scenario.routes.find((r) => r.id === 'B')!;
  const geographyStatus = hasValidatedGeometry ? 'validated_crop' : 'pending_real_crop';

  return {
    productName: template.productName,
    missionTitle: template.missionTitle,
    scientificContext: template.scientificContext,
    initialBudgetMin: scenario.budgetMin,
    reserveMin: scenario.reserveMin,
    extraStop: {
      id: 'extra',
      label: template.extraStop.label,
      accessAndObservationMin: scenario.shared.extra.minutes,
      returnToBaseMin: scenario.shared.returnAfterExtra.minutes,
    },
    routes: {
      A: {
        ...template.routes.A,
        outboundMin: routeA.outbound.minutes,
        primaryObservationMin: scenario.shared.observe.minutes,
        directReturnMin: scenario.shared.direct.minutes,
        geographyStatus,
      },
      B: {
        ...template.routes.B,
        outboundMin: routeB.outbound.minutes,
        primaryObservationMin: scenario.shared.observe.minutes,
        directReturnMin: scenario.shared.direct.minutes,
        geographyStatus,
      },
    },
  };
}

export function computeThermalUv(
  thermalGrid: GridSpec,
  frame: TerrainFrameSpec,
  x: number,
  z: number,
): { readonly u: number; readonly vNorth: number; readonly vFlipY: number } {
  const [E0, N0] = frame.sceneOriginProjectedM;
  const [Wt, St, Emaxt, Nmaxt] = thermalGrid.extentM;
  const E = E0 + x;
  const N = N0 - z;
  const u = (E - Wt) / (Emaxt - Wt);
  const vNorth = (Nmaxt - N) / (Nmaxt - St);
  return { u, vNorth, vFlipY: 1 - vNorth };
}

export function sampleThermalPixelAtXz(
  thermalGrid: GridSpec,
  rgbaBytes: Uint8ClampedArray | Uint8Array,
  frame: TerrainFrameSpec,
  x: number,
  z: number,
): ThermalSampleResult | null {
  const { u, vNorth, vFlipY } = computeThermalUv(thermalGrid, frame, x, z);
  if (u < 0 || u >= 1 || vNorth < 0 || vNorth >= 1) {
    return null;
  }
  const col = Math.min(thermalGrid.width - 1, Math.floor(u * thermalGrid.width));
  const row = Math.min(thermalGrid.height - 1, Math.floor(vNorth * thermalGrid.height));
  const idx = (row * thermalGrid.width + col) * 4;
  const dn = rgbaBytes[idx] ?? 0;
  const alpha = rgbaBytes[idx + 3] ?? 0;
  return {
    col,
    row,
    dn,
    alpha,
    uv: [u, vFlipY],
    vNorth,
  };
}

export function validateThermalDecodedPixels(
  manifest: TerrainManifestV1,
  pixelWidth: number,
  pixelHeight: number,
  rgba: Uint8ClampedArray | Uint8Array,
): DecodedThermalData {
  const { width, height } = manifest.thermal.grid;
  if (pixelWidth !== width || pixelHeight !== height) {
    throw new ContractValidationError(
      'thermal_dimension_mismatch',
      `La imagen térmica mide ${pixelWidth}×${pixelHeight}; se esperaba ${width}×${height}.`,
    );
  }
  const totalSamples = width * height;
  if (rgba.length !== totalSamples * 4) {
    throw new ContractValidationError(
      'thermal_buffer_length_mismatch',
      'El búfer RGBA térmico no coincide con las dimensiones declaradas.',
    );
  }

  const copy = new Uint8ClampedArray(rgba);
  let validSamples = 0;
  let minValidDn: number | null = null;
  let maxValidDn: number | null = null;

  for (let i = 0; i < totalSamples; i += 1) {
    const r = copy[i * 4] ?? 0;
    const g = copy[i * 4 + 1] ?? 0;
    const b = copy[i * 4 + 2] ?? 0;
    const a = copy[i * 4 + 3] ?? 0;
    if (a !== 0 && a !== 255) {
      throw new ContractValidationError(
        'invalid_thermal_alpha',
        `La máscara térmica contiene alfa inválido (${a}) en la celda ${i}.`,
      );
    }
    if (a === 255) {
      if (r !== g || g !== b) {
        throw new ContractValidationError(
          'invalid_thermal_grayscale',
          `La celda térmica ${i} no conserva R=G=B para la señal relativa DN.`,
        );
      }
      validSamples += 1;
      if (minValidDn === null || r < minValidDn) minValidDn = r;
      if (maxValidDn === null || r > maxValidDn) maxValidDn = r;
    }
  }

  if (validSamples !== manifest.thermal.coverage.validSamples) {
    throw new ContractValidationError(
      'thermal_coverage_mismatch',
      `La máscara térmica contiene ${validSamples} celdas válidas frente a ${manifest.thermal.coverage.validSamples} declaradas.`,
    );
  }

  return {
    width,
    height,
    rgba: copy,
    validSamples,
    totalSamples,
    minValidDn,
    maxValidDn,
  };
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function computeCrc32(bytes: Uint8Array, start: number, length: number): number {
  let c = 0xffffffff;
  for (let i = 0; i < length; i += 1) {
    const byte = bytes[start + i] ?? 0;
    c = CRC32_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
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

async function decompressZlibBytes(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'function') {
    throw new ContractValidationError(
      'png_decompression_unsupported',
      'Este entorno no soporta DecompressionStream("deflate") para decodificar PNG sin Canvas.',
    );
  }
  try {
    const stream = new DecompressionStream('deflate');
    const writer = stream.writable.getWriter();
    const copy = new Uint8Array(compressed.byteLength);
    copy.set(compressed);
    const writePromise = writer.write(copy).then(() => writer.close());
    const readPromise = new Response(stream.readable).arrayBuffer();
    const [buffer] = await Promise.all([readPromise, writePromise]);
    return new Uint8Array(buffer);
  } catch (err) {
    throw new ContractValidationError(
      'corrupt_png_idat',
      `No se pudo descomprimir el flujo zlib de IDAT: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Decodes PNG RGBA8 non-interlaced bytes strictly in JS + Web DecompressionStream
 * without invoking Canvas 2D getImageData (immune to canvas noise/farbling).
 * Explicit v1 scope: bitDepth=8, colorType=6 (RGBA), compression=0, filter=0, interlace=0.
 */
export async function decodePngRgbaDirect(
  bytes: Uint8Array,
): Promise<{ readonly width: number; readonly height: number; readonly rgba: Uint8ClampedArray }> {
  if (bytes.byteLength < 8) {
    throw new ContractValidationError('invalid_png_signature', 'El archivo PNG está truncado.');
  }
  for (let i = 0; i < 8; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new ContractValidationError(
        'invalid_png_signature',
        'Cabecera PNG inválida al decodificar térmica.',
      );
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let sawIhdr = false;
  let sawIend = false;
  const idatChunks: Uint8Array[] = [];

  while (offset < bytes.byteLength) {
    if (offset + 12 > bytes.byteLength) {
      throw new ContractValidationError('truncated_png_chunk', 'Chunk PNG truncado.');
    }
    const length = view.getUint32(offset, false);
    if (length > 0x7fffffff || offset + 12 + length > bytes.byteLength) {
      throw new ContractValidationError('truncated_png_chunk', 'Longitud de chunk PNG fuera de rango.');
    }
    const chunkType = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!,
    );
    const dataStart = offset + 8;
    const expectedCrc = view.getUint32(dataStart + length, false);
    const actualCrc = computeCrc32(bytes, offset + 4, 4 + length);
    if (actualCrc !== expectedCrc) {
      throw new ContractValidationError(
        'invalid_png_crc',
        `CRC-32 inválido en el chunk ${chunkType} del PNG térmico.`,
      );
    }

    if (sawIend) {
      throw new ContractValidationError(
        'trailing_png_chunks',
        `Se encontraron chunks PNG (${chunkType}) después de IEND.`,
      );
    }

    if (chunkType === 'IHDR') {
      if (sawIhdr || offset !== 8 || length !== 13) {
        throw new ContractValidationError('invalid_png_ihdr', 'Chunk IHDR inválido o duplicado.');
      }
      sawIhdr = true;
      width = view.getUint32(dataStart, false);
      height = view.getUint32(dataStart + 4, false);
      const bitDepth = bytes[dataStart + 8]!;
      const colorType = bytes[dataStart + 9]!;
      const compressionMethod = bytes[dataStart + 10]!;
      const filterMethod = bytes[dataStart + 11]!;
      const interlaceMethod = bytes[dataStart + 12]!;

      if (width <= 0 || height <= 0 || width > 8192 || height > 8192 || width * height > 16_777_216) {
        throw new ContractValidationError(
          'invalid_png_dimensions',
          `Dimensiones PNG inválidas o fuera de límite: ${width}×${height}.`,
        );
      }
      if (bitDepth !== 8 || colorType !== 6 || compressionMethod !== 0 || filterMethod !== 0) {
        throw new ContractValidationError(
          'unsupported_png_format',
          `Solo se soporta PNG RGBA8 no entrelazado v1 (recibido bitDepth=${bitDepth}, colorType=${colorType}).`,
        );
      }
      if (interlaceMethod !== 0) {
        throw new ContractValidationError(
          'unsupported_png_interlaced',
          'PNG Adam7 entrelazado fuera de alcance v1: se requiere interlaceMethod=0.',
        );
      }
    } else {
      if (!sawIhdr) {
        throw new ContractValidationError('missing_png_ihdr', 'El PNG no comienza con IHDR.');
      }
      if (chunkType === 'IDAT') {
        idatChunks.push(bytes.subarray(dataStart, dataStart + length));
      } else if (chunkType === 'IEND') {
        if (length !== 0) {
          throw new ContractValidationError('invalid_png_iend', 'Chunk IEND con longitud distinta de cero.');
        }
        sawIend = true;
      } else {
        const isCritical = ((bytes[offset + 4]! >> 5) & 1) === 0;
        if (isCritical && chunkType !== 'PLTE') {
          throw new ContractValidationError(
            'unsupported_png_chunk',
            `Chunk crítico PNG no soportado en alcance v1: ${chunkType}.`,
          );
        }
      }
    }

    offset += 12 + length;
  }

  if (!sawIhdr || !sawIend || idatChunks.length === 0) {
    throw new ContractValidationError(
      'incomplete_png_stream',
      'El archivo PNG carece de IHDR, IDAT o IEND completos.',
    );
  }

  const totalIdatLength = idatChunks.reduce((acc, c) => acc + c.byteLength, 0);
  const compressed = new Uint8Array(totalIdatLength);
  let cursor = 0;
  for (const chunk of idatChunks) {
    compressed.set(chunk, cursor);
    cursor += chunk.byteLength;
  }

  const inflated = await decompressZlibBytes(compressed);
  const stride = width * 4;
  const expectedLength = height * (1 + stride);
  if (inflated.byteLength !== expectedLength) {
    throw new ContractValidationError(
      'corrupt_png_scanlines',
      `Las scanlines descomprimidas miden ${inflated.byteLength} B frente a ${expectedLength} B esperados.`,
    );
  }

  const rgba = new Uint8ClampedArray(width * height * 4);
  const bpp = 4;

  for (let row = 0; row < height; row += 1) {
    const scanStart = row * (1 + stride);
    const filterType = inflated[scanStart]!;
    if (filterType > 4) {
      throw new ContractValidationError(
        'unsupported_png_filter',
        `Tipo de filtro PNG inválido (${filterType}) en la fila ${row}.`,
      );
    }
    const rowInOffset = scanStart + 1;
    const rowOutOffset = row * stride;
    const prevRowOutOffset = (row - 1) * stride;

    for (let i = 0; i < stride; i += 1) {
      const rawByte = inflated[rowInOffset + i]!;
      const left = i >= bpp ? rgba[rowOutOffset + i - bpp]! : 0;
      const up = row > 0 ? rgba[prevRowOutOffset + i]! : 0;
      const upLeft = row > 0 && i >= bpp ? rgba[prevRowOutOffset + i - bpp]! : 0;

      let predictor = 0;
      if (filterType === 1) {
        predictor = left;
      } else if (filterType === 2) {
        predictor = up;
      } else if (filterType === 3) {
        predictor = (left + up) >> 1;
      } else if (filterType === 4) {
        predictor = paethPredictor(left, up, upLeft);
      }
      rgba[rowOutOffset + i] = (rawByte + predictor) & 0xff;
    }
  }

  return { width, height, rgba };
}

export function samplePoseAlongDrapedPolyline(
  polyline: DrapedPolylineResult,
  fraction01: number,
): DrapedPose | null {
  const validRuns = polyline.runs.filter((run) => run.length > 0);
  if (validRuns.length === 0) {
    return null;
  }

  const runData: Array<{
    readonly points: readonly DrapedPoint[];
    readonly cumulative: number[];
    readonly lengthM: number;
  }> = [];
  let totalValidLength = 0;

  for (const run of validRuns) {
    const cumulative: number[] = [0];
    let acc = 0;
    for (let i = 1; i < run.length; i += 1) {
      const prev = run[i - 1]!;
      const curr = run[i]!;
      acc += Math.hypot(curr.x - prev.x, curr.z - prev.z);
      cumulative.push(acc);
    }
    runData.push({ points: run, cumulative, lengthM: acc });
    totalValidLength += acc;
  }

  const computeRunYaw = (pts: readonly DrapedPoint[], segIndex: number): number => {
    const minIdx = Math.max(0, Math.min(pts.length - 2, segIndex));
    if (pts.length >= 2) {
      for (let i = minIdx; i < pts.length - 1; i += 1) {
        const dx = pts[i + 1]!.x - pts[i]!.x;
        const dz = pts[i + 1]!.z - pts[i]!.z;
        if (Math.hypot(dx, dz) > 1e-9) {
          return Math.atan2(dx, dz);
        }
      }
      for (let i = minIdx - 1; i >= 0; i -= 1) {
        const dx = pts[i + 1]!.x - pts[i]!.x;
        const dz = pts[i + 1]!.z - pts[i]!.z;
        if (Math.hypot(dx, dz) > 1e-9) {
          return Math.atan2(dx, dz);
        }
      }
    }
    return 0;
  };

  if (totalValidLength <= 1e-12) {
    const first = validRuns[0]![0]!;
    return { ...first, yawRad: 0 };
  }

  const t = Math.max(0, Math.min(1, fraction01));
  const targetLen = t * totalValidLength;
  let passedLength = 0;

  for (let rIdx = 0; rIdx < runData.length; rIdx += 1) {
    const run = runData[rIdx]!;
    const isLastRun = rIdx === runData.length - 1;
    if (run.lengthM <= 1e-12 && !isLastRun) {
      continue;
    }
    if (targetLen <= passedLength + run.lengthM || isLastRun) {
      const localTarget = Math.max(0, Math.min(run.lengthM, targetLen - passedLength));
      const pts = run.points;
      if (pts.length === 1 || run.lengthM <= 1e-12) {
        return { ...pts[0]!, yawRad: computeRunYaw(pts, 0) };
      }
      for (let i = 1; i < pts.length; i += 1) {
        const l0 = run.cumulative[i - 1]!;
        const l1 = run.cumulative[i]!;
        if (localTarget <= l1 || i === pts.length - 1) {
          const segLen = l1 - l0 || 1;
          const alpha = Math.max(0, Math.min(1, (localTarget - l0) / segLen));
          const p0 = pts[i - 1]!;
          const p1 = pts[i]!;
          return {
            x: p0.x + (p1.x - p0.x) * alpha,
            y: p0.y + (p1.y - p0.y) * alpha,
            z: p0.z + (p1.z - p0.z) * alpha,
            elevationM: p0.elevationM + (p1.elevationM - p0.elevationM) * alpha,
            yawRad: computeRunYaw(pts, i - 1),
          };
        }
      }
    }
    passedLength += run.lengthM;
  }

  const lastRun = validRuns[validRuns.length - 1]!;
  return {
    ...lastRun[lastRun.length - 1]!,
    yawRad: computeRunYaw(lastRun, lastRun.length - 2),
  };
}

export function samplePointAlongDrapedPolyline(
  polyline: DrapedPolylineResult,
  fraction01: number,
): DrapedPoint | null {
  const pose = samplePoseAlongDrapedPolyline(polyline, fraction01);
  if (!pose) {
    return null;
  }
  return {
    x: pose.x,
    y: pose.y,
    z: pose.z,
    elevationM: pose.elevationM,
  };
}

export function getDefaultMissionRouteFallback(): RouteId {
  return DEFAULT_ROUTE_ID;
}
