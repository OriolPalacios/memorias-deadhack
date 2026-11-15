/**
 * Consumer-side data integration seam (APP-06).
 *
 * Isolates the application shell from external NASA/USGS/HiRISE/THEMIS/MEDA
 * file formats, projections, grid layouts, and manifests while Issue #6 / #8
 * are still in progress.
 *
 * ADAPTER CONNECTION POINT:
 * When Lucian's frozen data contracts (Issue #6 / #8) are approved
 * and prepared assets exist, implement a dedicated adapter
 * (e.g. `src/data/externalBundleAdapter.ts`) that validates the frozen manifest,
 * converts coordinates into the accepted local scene frame (+X East, +Y Up, +Z South),
 * and passes a populated `SceneDataPort` into `<App dataPort={...} />`.
 *
 * This module intentionally performs NO network fetches, defines NO unapproved
 * external JSON manifest schema, invents NO coordinates/elevations/temperatures,
 * and uses NO silent parse defaults.
 */

export type DataLayerId =
  | 'terrain_dem'
  | 'route_geometries'
  | 'thermal_ir'
  | 'orbital_texture'
  | 'surface_photo'
  | 'meda_context';

export type DataRequirementTier = 'required_mvp' | 'optional_mvp' | 'historical_context';

export type DataLayerStatus = 'awaiting_contract' | 'ready';

export interface DataLayerDescriptor<TPayload = unknown> {
  readonly id: DataLayerId;
  readonly label: string;
  readonly sourceHint: string;
  readonly requirement: DataRequirementTier;
  readonly status: DataLayerStatus;
  readonly unavailableReason: string;
  readonly payload: TPayload | null;
}

/** Opaque consumer view-model slots for future adapters (filled when ready). */
export interface ReadyTerrainRef {
  readonly productId: string;
  readonly sourceAttribution: string;
}

export interface ReadyThermalRef {
  readonly productId: string;
  readonly acquisitionContext: string;
  readonly sourceAttribution: string;
}

export interface ReadySurfacePhotoRef {
  readonly title: string;
  readonly capturedAt: string;
  readonly credit: string;
}

export interface ReadyMedaContextRef {
  readonly siteLabel: string;
  readonly observedPeriod: string;
  readonly sourceAttribution: string;
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
        label: 'Foto (Enchanted Lake)',
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
