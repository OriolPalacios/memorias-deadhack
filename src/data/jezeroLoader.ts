import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SIMULATED_MISSION_BASELINE,
  type MissionBaselineConstants,
} from '../domain/scenario.ts';
import {
  type DataLayerId,
  type ReadyMedaContextRef,
  type ReadyRouteGeometriesRef,
  type ReadySurfacePhotoRef,
  type ReadyTerrainRef,
  type ReadyThermalRef,
  type SceneDataPort,
} from './dataSeam.ts';
import {
  ContractValidationError,
  decodeAndValidateDemBinaries,
  decodePngRgbaDirect,
  mapScenarioToMissionBaseline,
  parseAndValidateScenarioManifest,
  parseAndValidateTerrainManifest,
  resolvePackageAssetUrl,
  resolveTerrainEntryUrl,
  sanitizeExternalHttpUrl,
  validateScenarioOnTerrain,
  validateThermalDecodedPixels,
  verifyBinaryIntegrity,
  type DecodedThermalData,
  type DrapedScenarioGeometry,
  type ScenarioManifestV1,
  type TerrainGridData,
  type TerrainManifestV1,
} from './jezeroContracts.ts';

export type ResourceChannelStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ScenarioConfigAuthority = 'loading' | 'ready' | 'fallback';

export interface ResourceChannelState<T> {
  readonly status: ResourceChannelStatus;
  readonly data: T | null;
  readonly errorMessage: string | null;
}

export interface ThermalLoadedBundle {
  readonly decoded: DecodedThermalData;
  readonly objectUrl: string;
}

export interface PhotoLoadedBundle {
  readonly objectUrl: string;
}

export interface JezeroLoaderState {
  readonly manifest: ResourceChannelState<TerrainManifestV1>;
  readonly dem: ResourceChannelState<TerrainGridData>;
  readonly thermal: ResourceChannelState<ThermalLoadedBundle>;
  readonly scenario: ResourceChannelState<ScenarioManifestV1>;
  readonly photo: ResourceChannelState<PhotoLoadedBundle>;
}

export interface JezeroPackageHandle {
  readonly dataPort: SceneDataPort;
  readonly terrainManifest: TerrainManifestV1 | null;
  readonly terrainGrid: TerrainGridData | null;
  readonly thermalBundle: ThermalLoadedBundle | null;
  readonly scenarioManifest: ScenarioManifestV1 | null;
  readonly drapedGeometry: DrapedScenarioGeometry | null;
  readonly geometryError: string | null;
  readonly activeBaseline: MissionBaselineConstants;
  readonly scenarioAuthority: ScenarioConfigAuthority;
  readonly scenarioStatus: ResourceChannelStatus;
  readonly scenarioError: string | null;
  readonly usingFallbackTimings: boolean;
  readonly layerRetries: Readonly<Partial<Record<DataLayerId, () => void>>>;
  readonly retryAll: () => void;
  readonly retryScenario: () => void;
}

function initialChannel<T>(status: ResourceChannelStatus = 'loading'): ResourceChannelState<T> {
  return { status, data: null, errorMessage: null };
}

function toUserFacingError(error: unknown, contextLabel: string): string {
  if (error instanceof ContractValidationError) {
    return error.message;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return `Carga cancelada para ${contextLabel}.`;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return `No se pudo validar ${contextLabel}: ${error.message}`;
  }
  return `No se pudo cargar o verificar ${contextLabel}.`;
}

async function fetchJsonResource(
  url: string,
  signal: AbortSignal,
  label: string,
): Promise<unknown> {
  const response = await fetch(url, { signal, cache: 'no-cache' });
  if (!response.ok) {
    throw new ContractValidationError(
      'http_error',
      `El recurso ${label} respondió con estado HTTP ${response.status}.`,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new ContractValidationError(
      'invalid_json',
      `El recurso ${label} no contiene JSON válido.`,
    );
  }
}

async function fetchBinaryResource(
  url: string,
  signal: AbortSignal,
  label: string,
): Promise<Uint8Array> {
  const response = await fetch(url, { signal, cache: 'no-cache' });
  if (!response.ok) {
    throw new ContractValidationError(
      'http_error',
      `El recurso ${label} respondió con estado HTTP ${response.status}.`,
    );
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

async function verifyImageDecodable(objectUrl: string, label: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        reject(
          new ContractValidationError(
            'invalid_image_dimensions',
            `La imagen de ${label} tiene dimensiones inválidas.`,
          ),
        );
        return;
      }
      resolve();
    };
    img.onerror = () => {
      reject(
        new ContractValidationError(
          'image_decode_failed',
          `La imagen de ${label} está dañada o no pudo decodificarse.`,
        ),
      );
    };
    img.src = objectUrl;
  });
}

function describeAcquisitionReason(missingReason: string | null): string {
  switch (missingReason) {
    case 'stac_interval_inverted_and_provenance_has_no_observation_dates':
      return 'Inicio/fin desconocidos (intervalo de catálogo invertido y sin fecha de observación verificada)';
    case 'synthetic_fixture':
      return 'Inicio/fin desconocidos (ejemplo sintético de verificación)';
    default:
      return missingReason
        ? 'Fechas exactas de adquisición no verificadas'
        : 'Sin rango temporal de adquisición declarado';
  }
}

function describePhotoLocationReason(missingReason: string | null): string {
  switch (missingReason) {
    case 'exact_capture_location_unverified':
      return 'Ubicación exacta de captura no verificada (sin georreferenciar en el terreno)';
    case 'synthetic_fixture':
      return 'Ubicación exacta no aplicable en fixture sintético';
    default:
      return 'Ubicación exacta de captura sin verificar';
  }
}

export function useJezeroPackageLoader(enabled: boolean): JezeroPackageHandle {
  const [state, setState] = useState<JezeroLoaderState>(() => ({
    manifest: initialChannel(enabled ? 'loading' : 'idle'),
    dem: initialChannel(enabled ? 'loading' : 'idle'),
    thermal: initialChannel(enabled ? 'loading' : 'idle'),
    scenario: initialChannel(enabled ? 'loading' : 'idle'),
    photo: initialChannel(enabled ? 'loading' : 'idle'),
  }));

  const [manifestSeq, setManifestSeq] = useState(0);
  const [demSeq, setDemSeq] = useState(0);
  const [thermalSeq, setThermalSeq] = useState(0);
  const [scenarioSeq, setScenarioSeq] = useState(0);
  const [photoSeq, setPhotoSeq] = useState(0);

  const objectUrlsRef = useRef<{ thermal: string | null; photo: string | null }>({
    thermal: null,
    photo: null,
  });

  const entryUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return resolveTerrainEntryUrl(import.meta.env.BASE_URL ?? '/', window.location.href);
  }, []);

  // Revoke any tracked object URLs on unmount
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      if (urls.thermal) {
        URL.revokeObjectURL(urls.thermal);
        urls.thermal = null;
      }
      if (urls.photo) {
        URL.revokeObjectURL(urls.photo);
        urls.photo = null;
      }
    };
  }, []);

  // Stage 1: Load and validate terrain.json
  useEffect(() => {
    if (!enabled || !entryUrl) {
      return undefined;
    }
    const controller = new AbortController();

    setState({
      manifest: initialChannel('loading'),
      dem: initialChannel('loading'),
      thermal: initialChannel('loading'),
      scenario: initialChannel('loading'),
      photo: initialChannel('loading'),
    });

    (async () => {
      try {
        const raw = await fetchJsonResource(
          entryUrl,
          controller.signal,
          'el manifiesto de terreno',
        );
        const manifest = parseAndValidateTerrainManifest(raw);
        if (controller.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          manifest: { status: 'ready', data: manifest, errorMessage: null },
        }));
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg = toUserFacingError(err, 'el manifiesto de terreno');
        setState({
          manifest: { status: 'error', data: null, errorMessage: msg },
          dem: {
            status: 'error',
            data: null,
            errorMessage: 'Requiere manifiesto de terreno válido.',
          },
          thermal: {
            status: 'error',
            data: null,
            errorMessage: 'Requiere manifiesto de terreno válido.',
          },
          scenario: {
            status: 'error',
            data: null,
            errorMessage: 'Requiere manifiesto de terreno válido.',
          },
          photo: {
            status: 'error',
            data: null,
            errorMessage: 'Requiere escenario y manifiesto válidos.',
          },
        });
      }
    })();

    return () => controller.abort();
  }, [enabled, entryUrl, manifestSeq]);

  const manifestData = state.manifest.data;

  // Stage 2A: Load & verify DEM binaries (height.f32 + height-mask.u8)
  useEffect(() => {
    if (!enabled || !manifestData || !entryUrl) {
      return undefined;
    }
    const controller = new AbortController();

    setState((prev) => ({
      ...prev,
      dem: initialChannel('loading'),
    }));

    (async () => {
      try {
        const heightUrl = resolvePackageAssetUrl(
          entryUrl,
          manifestData.heightAsset.path,
          entryUrl,
        );
        const maskUrl = resolvePackageAssetUrl(
          entryUrl,
          manifestData.heightMaskAsset.path,
          entryUrl,
        );
        const [heightBytes, maskBytes] = await Promise.all([
          fetchBinaryResource(heightUrl, controller.signal, 'las alturas DEM'),
          fetchBinaryResource(maskUrl, controller.signal, 'la máscara DEM'),
        ]);
        await Promise.all([
          verifyBinaryIntegrity(heightBytes, manifestData.heightAsset, 'el archivo de alturas'),
          verifyBinaryIntegrity(
            maskBytes,
            manifestData.heightMaskAsset,
            'la máscara de elevación',
          ),
        ]);
        const grid = decodeAndValidateDemBinaries(manifestData, heightBytes, maskBytes);
        if (controller.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          dem: { status: 'ready', data: grid, errorMessage: null },
        }));
      } catch (err) {
        if (controller.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          dem: {
            status: 'error',
            data: null,
            errorMessage: toUserFacingError(err, 'los datos DEM'),
          },
        }));
      }
    })();

    return () => controller.abort();
  }, [enabled, manifestData, entryUrl, demSeq]);

  // Stage 2B: Load & verify thermal.png independently
  useEffect(() => {
    if (!enabled || !manifestData || !entryUrl) {
      return undefined;
    }
    const controller = new AbortController();

    setState((prev) => ({
      ...prev,
      thermal: initialChannel('loading'),
    }));

    (async () => {
      try {
        const thermalUrl = resolvePackageAssetUrl(
          entryUrl,
          manifestData.thermal.asset.path,
          entryUrl,
        );
        const pngBytes = await fetchBinaryResource(
          thermalUrl,
          controller.signal,
          'la capa térmica THEMIS',
        );
        await verifyBinaryIntegrity(
          pngBytes,
          manifestData.thermal.asset,
          'la imagen térmica PNG',
        );
        const { width, height, rgba } = await decodePngRgbaDirect(pngBytes);
        const decoded = validateThermalDecodedPixels(manifestData, width, height, rgba);
        if (controller.signal.aborted) {
          return;
        }
        setState((prev) => ({
          ...prev,
          thermal: {
            status: 'ready',
            data: { decoded, objectUrl: '' },
            errorMessage: null,
          },
        }));
      } catch (err) {
        if (controller.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          thermal: {
            status: 'error',
            data: null,
            errorMessage: toUserFacingError(err, 'la capa térmica IR'),
          },
        }));
      }
    })();

    return () => {
      controller.abort();
    };
  }, [enabled, manifestData, entryUrl, thermalSeq]);

  // Stage 2C: Load & verify scenario.json independently
  useEffect(() => {
    if (!enabled || !manifestData || !entryUrl) {
      return undefined;
    }
    const controller = new AbortController();

    setState((prev) => ({
      ...prev,
      scenario: initialChannel('loading'),
      photo: initialChannel('loading'),
    }));

    (async () => {
      try {
        const scenarioUrl = resolvePackageAssetUrl(
          entryUrl,
          manifestData.scenarioAsset,
          entryUrl,
        );
        const rawScenario = await fetchJsonResource(
          scenarioUrl,
          controller.signal,
          'el escenario de misión',
        );
        const scenario = parseAndValidateScenarioManifest(rawScenario, manifestData);
        if (controller.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          scenario: { status: 'ready', data: scenario, errorMessage: null },
        }));
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg = toUserFacingError(err, 'el escenario de misión');
        setState((prev) => ({
          ...prev,
          scenario: { status: 'error', data: null, errorMessage: msg },
          photo: {
            status: 'error',
            data: null,
            errorMessage: 'Requiere escenario válido para localizar la fotografía.',
          },
        }));
      }
    })();

    return () => controller.abort();
  }, [enabled, manifestData, entryUrl, scenarioSeq]);

  const scenarioData = state.scenario.data;

  // Stage 3: Load & verify surface photo once scenario.json is ready
  useEffect(() => {
    if (!enabled || !manifestData || !scenarioData || !entryUrl) {
      return undefined;
    }
    const scienceStop = scenarioData.stops.find((s) => s.id === 'science');
    const evidenceItem = scienceStop?.evidenceId
      ? scenarioData.evidence.find((e) => e.id === scienceStop.evidenceId) ?? null
      : null;
    if (!evidenceItem) {
      setState((prev) => ({
        ...prev,
        photo: {
          status: 'error',
          data: null,
          errorMessage: 'El escenario no declara una fotografía de superficie asociada.',
        },
      }));
      return undefined;
    }

    const controller = new AbortController();
    let localUrl: string | null = null;
    const scenarioUrl = resolvePackageAssetUrl(
      entryUrl,
      manifestData.scenarioAsset,
      entryUrl,
    );

    setState((prev) => ({
      ...prev,
      photo: initialChannel('loading'),
    }));

    (async () => {
      try {
        const photoUrl = resolvePackageAssetUrl(
          scenarioUrl,
          evidenceItem.asset.path,
          entryUrl,
        );
        const jpgBytes = await fetchBinaryResource(
          photoUrl,
          controller.signal,
          `la fotografía ${evidenceItem.productId}`,
        );
        await verifyBinaryIntegrity(
          jpgBytes,
          evidenceItem.asset,
          `la fotografía ${evidenceItem.productId}`,
        );
        const mimeType =
          evidenceItem.asset.format === 'png-rgba8' ? 'image/png' : 'image/jpeg';
        const blob = new Blob([jpgBytes.slice().buffer], { type: mimeType });
        localUrl = URL.createObjectURL(blob);
        await verifyImageDecodable(localUrl, evidenceItem.productId);
        if (controller.signal.aborted) {
          URL.revokeObjectURL(localUrl);
          localUrl = null;
          return;
        }
        const prevUrl = objectUrlsRef.current.photo;
        objectUrlsRef.current.photo = localUrl;
        if (prevUrl && prevUrl !== localUrl) {
          URL.revokeObjectURL(prevUrl);
        }
        const assignedUrl = localUrl;
        localUrl = null;
        setState((prev) => ({
          ...prev,
          photo: {
            status: 'ready',
            data: { objectUrl: assignedUrl },
            errorMessage: null,
          },
        }));
      } catch (err) {
        if (localUrl) {
          URL.revokeObjectURL(localUrl);
          localUrl = null;
        }
        if (controller.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          photo: {
            status: 'error',
            data: null,
            errorMessage: toUserFacingError(err, `la fotografía ${evidenceItem.productId}`),
          },
        }));
      }
    })();

    return () => {
      controller.abort();
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [enabled, manifestData, scenarioData, entryUrl, photoSeq]);

  // Derived draped geometry validation on the real DEM mesh
  const { drapedGeometry, geometryError } = useMemo(() => {
    if (!state.dem.data || !state.scenario.data) {
      return { drapedGeometry: null, geometryError: null };
    }
    try {
      return {
        drapedGeometry: validateScenarioOnTerrain(state.scenario.data, state.dem.data),
        geometryError: null,
      };
    } catch (err) {
      return {
        drapedGeometry: null,
        geometryError: toUserFacingError(err, 'las geometrías sobre el DEM'),
      };
    }
  }, [state.dem.data, state.scenario.data]);

  const activeBaseline = useMemo(() => {
    if (!state.scenario.data) {
      return undefined;
    }
    return mapScenarioToMissionBaseline(
      state.scenario.data,
      undefined,
      drapedGeometry !== null,
    );
  }, [state.scenario.data, drapedGeometry]);

  const retryAll = useCallback(() => {
    setManifestSeq((n) => n + 1);
  }, []);

  const retryDem = useCallback(() => {
    if (state.manifest.status !== 'ready') {
      setManifestSeq((n) => n + 1);
    } else {
      setDemSeq((n) => n + 1);
    }
  }, [state.manifest.status]);

  const retryThermal = useCallback(() => {
    if (state.manifest.status !== 'ready') {
      setManifestSeq((n) => n + 1);
    } else {
      setThermalSeq((n) => n + 1);
    }
  }, [state.manifest.status]);

  const retryScenario = useCallback(() => {
    if (state.manifest.status !== 'ready') {
      setManifestSeq((n) => n + 1);
    } else {
      setScenarioSeq((n) => n + 1);
    }
  }, [state.manifest.status]);

  const retryPhoto = useCallback(() => {
    if (state.manifest.status !== 'ready') {
      setManifestSeq((n) => n + 1);
    } else if (state.scenario.status !== 'ready') {
      setScenarioSeq((n) => n + 1);
    } else {
      setPhotoSeq((n) => n + 1);
    }
  }, [state.manifest.status, state.scenario.status]);

  const layerRetries = useMemo(() => {
    const retries: Partial<Record<DataLayerId, () => void>> = {};
    if (state.dem.status === 'error') {
      retries.terrain_dem = retryDem;
    }
    if (state.thermal.status === 'error') {
      retries.thermal_ir = retryThermal;
    }
    if (state.scenario.status === 'error' || geometryError) {
      retries.route_geometries = state.scenario.status === 'error' ? retryScenario : retryDem;
      retries.meda_context = retryScenario;
    }
    if (state.photo.status === 'error') {
      retries.surface_photo = retryPhoto;
    }
    return retries;
  }, [
    state.dem.status,
    state.thermal.status,
    state.scenario.status,
    state.photo.status,
    geometryError,
    retryDem,
    retryThermal,
    retryScenario,
    retryPhoto,
  ]);

  const dataPort = useMemo<SceneDataPort>(() => {
    const manifest = state.manifest.data;
    const dem = state.dem.data;
    const thermal = state.thermal.data;
    const scenario = state.scenario.data;
    const photo = state.photo.data;

    const demSource = manifest?.sources.find((s) => s.id === manifest.heightSourceId);
    const thermalSource = manifest?.sources.find((s) => s.id === manifest.thermal.sourceId);

    const terrainLayer = (() => {
      if (state.dem.status === 'ready' && manifest && dem && demSource) {
        const payload: ReadyTerrainRef = {
          productId: demSource.productId,
          sourceAttribution: `${demSource.mission ?? 'MRO'} ${demSource.instrument ?? 'HiRISE'} · ${demSource.credit}`,
          width: dem.width,
          height: dem.height,
          dxM: dem.dx,
          dyM: dem.dy,
          minElevationM: dem.minElevationM,
          maxElevationM: dem.maxElevationM,
          verticalDatum: manifest.frame.verticalDatum,
          verticalExaggeration: manifest.frame.verticalExaggeration,
          validSamples: dem.validSamples,
          totalSamples: dem.totalSamples,
          boundsXzM: dem.boundsXzM,
        };
        return {
          id: 'terrain_dem' as const,
          label: 'Terreno 3D (DTM/DEM)',
          sourceHint: `${demSource.instrument ?? 'HiRISE'} · ${demSource.productId}`,
          requirement: 'required_mvp' as const,
          status: 'ready' as const,
          unavailableReason: '',
          payload,
          externalUrl:
            sanitizeExternalHttpUrl(demSource.referenceUrl) ??
            sanitizeExternalHttpUrl(demSource.url),
        };
      }
      return {
        id: 'terrain_dem' as const,
        label: 'Terreno 3D (DTM/DEM)',
        sourceHint: demSource ? `${demSource.productId}` : 'HiRISE / USGS',
        requirement: 'required_mvp' as const,
        status: state.dem.status === 'error' ? ('error' as const) : ('loading' as const),
        unavailableReason:
          state.dem.errorMessage ?? 'Cargando y verificando elevación numérica DEM...',
        payload: null,
        externalUrl: sanitizeExternalHttpUrl(demSource?.referenceUrl),
      };
    })();

    const routesLayer = (() => {
      if (drapedGeometry && scenario) {
        const payload: ReadyRouteGeometriesRef = {
          scenarioId: scenario.id,
          geometryVersion: scenario.geometryVersion,
          movementCount: 5,
          coverageVerified: true,
        };
        return {
          id: 'route_geometries' as const,
          label: 'Trazas simuladas A/B y regresos',
          sourceHint: `Jezero · ${scenario.geometryVersion}`,
          requirement: 'required_mvp' as const,
          status: 'ready' as const,
          unavailableReason: '',
          payload,
        };
      }
      if (geometryError) {
        return {
          id: 'route_geometries' as const,
          label: 'Trazas simuladas A/B y regresos',
          sourceHint: 'Jezero',
          requirement: 'required_mvp' as const,
          status: 'error' as const,
          unavailableReason: geometryError,
          payload: null,
        };
      }
      if (state.scenario.status === 'error' || state.dem.status === 'error') {
        return {
          id: 'route_geometries' as const,
          label: 'Trazas simuladas A/B y regresos',
          sourceHint: 'Jezero',
          requirement: 'required_mvp' as const,
          status: 'error' as const,
          unavailableReason:
            state.scenario.errorMessage ??
            'Requiere terreno DEM válido para proyectar las trazas.',
          payload: null,
        };
      }
      return {
        id: 'route_geometries' as const,
        label: 'Trazas simuladas A/B y regresos',
        sourceHint: 'Jezero',
        requirement: 'required_mvp' as const,
        status: 'loading' as const,
        unavailableReason: 'Validando cobertura de las 5 trazas sobre el DEM...',
        payload: null,
      };
    })();

    const thermalLayer = (() => {
      if (state.thermal.status === 'ready' && manifest && thermal && thermalSource) {
        const payload: ReadyThermalRef = {
          productId: thermalSource.productId,
          acquisitionContext: `${manifest.thermal.acquisition.kind === 'mosaic' ? 'Mosaico' : manifest.thermal.acquisition.kind} · ${manifest.thermal.acquisition.illumination === 'night' ? 'nocturno' : manifest.thermal.acquisition.illumination}`,
          acquisitionDatesKnown:
            manifest.thermal.acquisition.startUtc !== null ||
            manifest.thermal.acquisition.endUtc !== null,
          acquisitionDetail: describeAcquisitionReason(
            manifest.thermal.acquisition.missingReason,
          ),
          sourceAttribution: `${thermalSource.mission ?? 'Mars Odyssey'} ${thermalSource.instrument ?? 'THEMIS'} · ${thermalSource.credit}`,
          label: manifest.thermal.legend.label,
          width: thermal.decoded.width,
          height: thermal.decoded.height,
          nativeResolutionMpp: manifest.thermal.nativeResolutionMpp,
          validSamples: thermal.decoded.validSamples,
          totalSamples: thermal.decoded.totalSamples,
          lowDN: manifest.thermal.legend.lowDN,
          highDN: manifest.thermal.legend.highDN,
          minObservedDn: thermal.decoded.minValidDn,
          maxObservedDn: thermal.decoded.maxValidDn,
        };
        return {
          id: 'thermal_ir' as const,
          label: 'Capa térmica IR',
          sourceHint: `THEMIS · ${thermalSource.productId}`,
          requirement: 'required_mvp' as const,
          status: 'ready' as const,
          unavailableReason: '',
          payload,
          externalUrl:
            sanitizeExternalHttpUrl(thermalSource.documentationUrl) ??
            sanitizeExternalHttpUrl(thermalSource.stacItemUrl),
        };
      }
      return {
        id: 'thermal_ir' as const,
        label: 'Capa térmica IR',
        sourceHint: thermalSource ? `THEMIS · ${thermalSource.productId}` : 'NASA/USGS THEMIS',
        requirement: 'required_mvp' as const,
        status: state.thermal.status === 'error' ? ('error' as const) : ('loading' as const),
        unavailableReason:
          state.thermal.errorMessage ?? 'Cargando y verificando capa térmica IR...',
        payload: null,
        externalUrl: sanitizeExternalHttpUrl(thermalSource?.documentationUrl),
      };
    })();

    const orthoLayer = {
      id: 'orbital_texture' as const,
      label: 'Ortoimagen y geología',
      sourceHint: 'HiRISE / mapa geológico',
      requirement: 'optional_mvp' as const,
      status:
        manifest?.textureAsset === null ? ('unavailable' as const) : ('awaiting_contract' as const),
      unavailableReason:
        manifest?.textureAsset === null
          ? 'No incluida en este paquete (opcional); el terreno muestra escala física de elevación.'
          : 'Alineación opcional no disponible.',
      payload: null,
    };

    const scienceStop = scenario?.stops.find((s) => s.id === 'science') ?? null;
    const evidenceItem =
      scienceStop?.evidenceId && scenario
        ? scenario.evidence.find((e) => e.id === scienceStop.evidenceId) ?? null
        : null;

    const photoLayer = (() => {
      if (state.photo.status === 'ready' && photo && evidenceItem) {
        const payload: ReadySurfacePhotoRef = {
          title: `Hazcam de Perseverance · ${evidenceItem.productId}`,
          productId: evidenceItem.productId,
          capturedAt: evidenceItem.captureDate ?? 'Fecha desconocida',
          captureSol: evidenceItem.captureSol,
          credit: evidenceItem.credit,
          objectUrl: photo.objectUrl,
          sourceUrl: evidenceItem.sourceUrl,
          locationUnverifiedNote: describePhotoLocationReason(evidenceItem.missingReason),
        };
        return {
          id: 'surface_photo' as const,
          label: 'Foto contextual (Enchanted Lake)',
          sourceHint: `Perseverance · ${evidenceItem.productId}`,
          requirement: 'required_mvp' as const,
          status: 'ready' as const,
          unavailableReason: '',
          payload,
          externalUrl: evidenceItem.sourceUrl,
        };
      }
      return {
        id: 'surface_photo' as const,
        label: 'Foto contextual (Enchanted Lake)',
        sourceHint: evidenceItem ? `Perseverance · ${evidenceItem.productId}` : 'Perseverance (JPL)',
        requirement: 'required_mvp' as const,
        status: state.photo.status === 'error' ? ('error' as const) : ('loading' as const),
        unavailableReason:
          state.photo.errorMessage ?? 'Cargando y verificando fotografía local...',
        payload: null,
        externalUrl: evidenceItem?.sourceUrl ?? null,
      };
    })();

    const medaId = scienceStop?.contextIds[0];
    const medaCard =
      (medaId && scenario ? scenario.contextCards.find((c) => c.id === medaId) : null) ??
      scenario?.contextCards[0] ??
      null;

    const medaLayer = (() => {
      if (state.scenario.status === 'ready' && medaCard) {
        const period =
          medaCard.dateLabel ??
          medaCard.dateUtc ??
          (medaCard.sol !== null ? `Sol ${medaCard.sol}` : 'Fecha histórica no especificada');
        const payload: ReadyMedaContextRef = {
          siteLabel: medaCard.site,
          observedPeriod: period,
          sourceAttribution: medaCard.credit,
          sourceUrl: medaCard.sourceUrl,
          variables: medaCard.variables,
        };
        return {
          id: 'meda_context' as const,
          label: 'Ficha histórica MEDA',
          sourceHint: medaCard.credit,
          requirement: 'historical_context' as const,
          status: 'ready' as const,
          unavailableReason: '',
          payload,
          externalUrl: medaCard.sourceUrl,
        };
      }
      return {
        id: 'meda_context' as const,
        label: 'Ficha histórica MEDA',
        sourceHint: 'Archivo MEDA',
        requirement: 'historical_context' as const,
        status: state.scenario.status === 'error' ? ('error' as const) : ('loading' as const),
        unavailableReason:
          state.scenario.errorMessage ?? 'Cargando ficha histórica MEDA (no altera autonomía)...',
        payload: null,
      };
    })();

    const hasAnyConnected =
      terrainLayer.status === 'ready' ||
      routesLayer.status === 'ready' ||
      thermalLayer.status === 'ready' ||
      photoLayer.status === 'ready' ||
      medaLayer.status === 'ready';

    return {
      integrationStage: hasAnyConnected ? 'connected' : 'skeleton_awaiting_assets',
      layers: {
        terrain_dem: terrainLayer,
        route_geometries: routesLayer,
        thermal_ir: thermalLayer,
        orbital_texture: orthoLayer,
        surface_photo: photoLayer,
        meda_context: medaLayer,
      },
    };
  }, [state, drapedGeometry, geometryError]);

  const scenarioAuthority: ScenarioConfigAuthority = !enabled
    ? 'ready'
    : state.scenario.status === 'ready' && activeBaseline !== undefined
      ? 'ready'
      : state.manifest.status === 'error' || state.scenario.status === 'error'
        ? 'fallback'
        : 'loading';

  return {
    dataPort,
    terrainManifest: state.manifest.data,
    terrainGrid: state.dem.data,
    thermalBundle: state.thermal.data,
    scenarioManifest: state.scenario.data,
    drapedGeometry,
    geometryError,
    activeBaseline: activeBaseline ?? SIMULATED_MISSION_BASELINE,
    scenarioAuthority,
    scenarioStatus: state.scenario.status,
    scenarioError: state.scenario.errorMessage,
    usingFallbackTimings: scenarioAuthority === 'fallback',
    layerRetries,
    retryAll,
    retryScenario,
  };
}
