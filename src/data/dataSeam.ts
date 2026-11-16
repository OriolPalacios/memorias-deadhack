/**
 * Consumer-side data integration seam (APP-06).
 *
 * Isolates the application shell from external NASA/USGS/HiRISE/THEMIS/MEDA
 * file formats, projections, grid layouts, and manifests.
 *
 * `createPendingDataPort()` remains the pure synchronous baseline port with no
 * network fetches; `jezeroLoader.ts` populates a live `SceneDataPort` when loading
 * the local Jezero package (`demo/jezero/terrain.json`).
 */

import type { ScenarioContextVariable } from './jezeroContracts.ts';

export type DataLayerId =
  | 'terrain_dem'
  | 'route_geometries'
  | 'thermal_ir'
  | 'orbital_texture'
  | 'surface_photo'
  | 'meda_context';

export type DataRequirementTier = 'required_mvp' | 'optional_mvp' | 'historical_context';

export type DataLayerStatus =
  | 'awaiting_contract'
  | 'loading'
  | 'ready'
  | 'unavailable'
  | 'error';

export interface DataLayerDescriptor<TPayload = unknown> {
  readonly id: DataLayerId;
  readonly label: string;
  readonly sourceHint: string;
  readonly requirement: DataRequirementTier;
  readonly status: DataLayerStatus;
  readonly unavailableReason: string;
  readonly payload: TPayload | null;
  readonly externalUrl?: string | null;
}

export interface ReadyTerrainRef {
  readonly productId: string;
  readonly sourceAttribution: string;
  readonly width: number;
  readonly height: number;
  readonly dxM: number;
  readonly dyM: number;
  readonly minElevationM: number;
  readonly maxElevationM: number;
  readonly verticalDatum: string;
  readonly verticalExaggeration: number;
  readonly validSamples: number;
  readonly totalSamples: number;
  readonly boundsXzM: readonly [number, number, number, number];
}

export interface ReadyRouteGeometriesRef {
  readonly scenarioId: string;
  readonly geometryVersion: string;
  readonly movementCount: number;
  readonly coverageVerified: boolean;
}

export interface ReadyThermalRef {
  readonly productId: string;
  readonly acquisitionContext: string;
  readonly acquisitionDatesKnown: boolean;
  readonly acquisitionDetail: string;
  readonly sourceAttribution: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly nativeResolutionMpp: number;
  readonly validSamples: number;
  readonly totalSamples: number;
  readonly lowDN: number;
  readonly highDN: number;
  readonly minObservedDn: number | null;
  readonly maxObservedDn: number | null;
}

export interface ReadySurfacePhotoRef {
  readonly title: string;
  readonly productId: string;
  readonly capturedAt: string;
  readonly captureSol: number | null;
  readonly credit: string;
  readonly objectUrl: string;
  readonly sourceUrl: string | null;
  readonly locationUnverifiedNote: string;
}

export interface ReadyMedaContextRef {
  readonly siteLabel: string;
  readonly observedPeriod: string;
  readonly sourceAttribution: string;
  readonly sourceUrl: string | null;
  readonly variables: readonly ScenarioContextVariable[];
}

export interface SceneDataPort {
  readonly integrationStage: 'skeleton_awaiting_assets' | 'connected';
  readonly layers: Readonly<Record<DataLayerId, DataLayerDescriptor>>;
}

export const DATA_LAYER_ORDER: readonly DataLayerId[] = [
  'terrain_dem',
  'route_geometries',
  'thermal_ir',
  'orbital_texture',
  'surface_photo',
  'meda_context',
];

export function isLayerReady(layer: DataLayerDescriptor): boolean {
  return layer.status === 'ready' && layer.payload !== null;
}

export function createPendingDataPort(): SceneDataPort {
  return {
    integrationStage: 'skeleton_awaiting_assets',
    layers: {
      terrain_dem: {
        id: 'terrain_dem',
        label: 'Terreno 3D (DTM/DEM)',
        sourceHint: 'HiRISE / USGS',
        requirement: 'required_mvp',
        status: 'awaiting_contract',
        unavailableReason: 'Sin recorte DEM ni relieve sintético.',
        payload: null,
      },
      route_geometries: {
        id: 'route_geometries',
        label: 'Trazas geográficas A/B',
        sourceHint: 'Jezero',
        requirement: 'required_mvp',
        status: 'awaiting_contract',
        unavailableReason: 'Simulación previa sin geometrías en recorte.',
        payload: null,
      },
      thermal_ir: {
        id: 'thermal_ir',
        label: 'Capa térmica IR',
        sourceHint: 'NASA/USGS THEMIS',
        requirement: 'required_mvp',
        status: 'awaiting_contract',
        unavailableReason: 'Producto alineado y leyenda pendientes.',
        payload: null,
      },
      orbital_texture: {
        id: 'orbital_texture',
        label: 'Ortoimagen y geología',
        sourceHint: 'HiRISE / SIM 3464',
        requirement: 'optional_mvp',
        status: 'awaiting_contract',
        unavailableReason: 'Alineación opcional pendiente.',
        payload: null,
      },
      surface_photo: {
        id: 'surface_photo',
        label: 'Foto contextual (Enchanted Lake)',
        sourceHint: 'Perseverance (JPL)',
        requirement: 'required_mvp',
        status: 'awaiting_contract',
        unavailableReason: 'Asset local y pose aún pendientes.',
        payload: null,
      },
      meda_context: {
        id: 'meda_context',
        label: 'Ficha histórica MEDA',
        sourceHint: 'Archivo MEDA',
        requirement: 'historical_context',
        status: 'awaiting_contract',
        unavailableReason: 'Contexto pendiente; no altera autonomía.',
        payload: null,
      },
    },
  };
}
