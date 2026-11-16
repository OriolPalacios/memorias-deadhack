import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlaybackState } from '../app/missionPlayback.ts';
import type { DecisionOptionId } from '../domain/autonomy.ts';
import type { SimulatedMissionState } from '../domain/missionEngine.ts';
import type { RouteId } from '../domain/scenario.ts';
import {
  buildTerrainMeshData,
  samplePoseAlongDrapedPolyline,
  type DecodedThermalData,
  type DrapedPoint,
  type DrapedPolylineResult,
  type DrapedPose,
  type DrapedScenarioGeometry,
  type TerrainGridData,
} from '../data/jezeroContracts.ts';
import { AstronautFigure } from './AstronautFigure.tsx';

export type InspectablePoiId = 'base' | 'science' | 'extra-stop';
export type TerrainSurfaceMode = 'illustrative' | 'elevation';
export type MapOverlayLabelId = 'base' | 'science' | 'extra-stop' | 'route-a' | 'route-b';

interface JezeroTerrainStageProps {
  readonly terrainGrid: TerrainGridData;
  readonly thermalData: DecodedThermalData | null;
  readonly thermalEnabled: boolean;
  readonly thermalOpacity: number;
  readonly surfaceMode: TerrainSurfaceMode;
  readonly routesVisible: boolean;
  readonly poisVisible: boolean;
  readonly drapedGeometry: DrapedScenarioGeometry | null;
  readonly selectedRouteId: RouteId;
  readonly inspectedOptionId: DecisionOptionId | null;
  readonly mission: SimulatedMissionState;
  readonly playback: PlaybackState;
  readonly selectedPoiId: InspectablePoiId;
  readonly reducedMotion: boolean;
  readonly onSelectPoi: (poiId: InspectablePoiId) => void;
  readonly resolveLabelElement: (id: MapOverlayLabelId) => HTMLElement | null;
}

const TERRAIN_VERTEX_SHADER = /* glsl */ `
attribute vec3 color;
varying vec3 vElevColor;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vThermalUv;

void main() {
  vElevColor = color;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vThermalUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const TERRAIN_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uThermalMap;
uniform float uThermalActive;
uniform float uThermalOpacity;
uniform float uElevationMode;
uniform float uMinY;
uniform float uMaxY;
uniform vec3 uSunDir;
uniform vec3 uFillDir;
varying vec3 vElevColor;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vThermalUv;

vec3 srgbToLinearVec(vec3 c) {
  vec3 lo = c / 12.92;
  vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(lo, hi, step(vec3(0.04045), c));
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Monotonic false-color ramp for relative IR DN (0..255); never Celsius.
vec3 sampleThermalRampLinear(float dnNorm) {
  float t = clamp(dnNorm, 0.0, 1.0);
  vec3 c0 = vec3(18.0, 28.0, 68.0) / 255.0;
  vec3 c1 = vec3(58.0, 88.0, 168.0) / 255.0;
  vec3 c2 = vec3(178.0, 66.0, 108.0) / 255.0;
  vec3 c3 = vec3(230.0, 138.0, 62.0) / 255.0;
  vec3 c4 = vec3(250.0, 232.0, 178.0) / 255.0;
  vec3 srgb;
  if (t < 0.25) {
    srgb = mix(c0, c1, t / 0.25);
  } else if (t < 0.5) {
    srgb = mix(c1, c2, (t - 0.25) / 0.25);
  } else if (t < 0.75) {
    srgb = mix(c2, c3, (t - 0.5) / 0.25);
  } else {
    srgb = mix(c3, c4, (t - 0.75) / 0.25);
  }
  return srgbToLinearVec(srgb);
}

vec3 computeIllustrativeRegolithLinear(vec2 xz, vec3 normalDir, float worldY) {
  float spanY = max(uMaxY - uMinY, 1.0);
  float elevT = clamp((worldY - uMinY) / spanY, 0.0, 1.0);
  float slopeFactor = clamp(1.0 - max(normalDir.y, 0.0), 0.0, 1.0);

  // Two-scale deterministic procedural surface grain (illustrative only; zero vertex displacement).
  float macroPatch = valueNoise2D(xz * 0.032 + vec2(4.2, 9.7));
  float fineGrain = valueNoise2D(xz * 0.21 + vec2(17.1, 3.8));
  float microSilt = valueNoise2D(xz * 0.65);

  vec3 darkBasalt = srgbToLinearVec(vec3(93.0, 64.0, 51.0) / 255.0);
  vec3 midOchre = srgbToLinearVec(vec3(169.0, 109.0, 73.0) / 255.0);
  vec3 highlightDust = srgbToLinearVec(vec3(214.0, 163.0, 117.0) / 255.0);

  vec3 base = mix(darkBasalt, midOchre, smoothstep(0.12, 0.72, elevT * 0.75 + macroPatch * 0.4));
  base = mix(base, highlightDust, smoothstep(0.55, 0.96, elevT * 0.68 + fineGrain * 0.38));

  // Slightly cooler basaltic undertone along steep rocky outcrops & minor ~9% grain contrast
  base = mix(base, darkBasalt * 0.92, clamp(slopeFactor * 0.65, 0.0, 0.45));
  float grainMod = 1.0 + (fineGrain - 0.5) * 0.14 + (microSilt - 0.5) * 0.07;
  return base * grainMod;
}

void main() {
  vec3 n = normalize(vWorldNormal);
  float sunDiff = max(dot(n, normalize(uSunDir)), 0.0);
  float fillDiff = max(dot(n, normalize(uFillDir)), 0.0);
  float shade = uElevationMode > 0.5
    ? (0.34 + 0.64 * sunDiff + 0.16 * fillDiff)
    : (0.28 + 0.76 * sunDiff + 0.16 * fillDiff);

  vec3 surfaceBase = uElevationMode > 0.5
    ? vElevColor
    : computeIllustrativeRegolithLinear(vWorldPos.xz, n, vWorldPos.y);

  vec3 litTerrain = surfaceBase * shade;
  vec3 finalColor = litTerrain;
  float vNorth = 1.0 - vThermalUv.y;
  if (
    uThermalActive > 0.5 &&
    uThermalOpacity > 0.0 &&
    vThermalUv.x >= 0.0 &&
    vThermalUv.x < 1.0 &&
    vNorth >= 0.0 &&
    vNorth < 1.0
  ) {
    vec4 irTex = texture2D(uThermalMap, vThermalUv);
    float effectiveAlpha = clamp(uThermalOpacity, 0.0, 1.0) * irTex.a;
    if (effectiveAlpha > 0.0) {
      vec3 irColor = sampleThermalRampLinear(irTex.r) * (0.45 + 0.55 * shade);
      finalColor = mix(litTerrain, irColor, effectiveAlpha);
    }
  }

  gl_FragColor = vec4(finalColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function pushRibbonSegmentVertices(
  segmentPts: readonly DrapedPoint[],
  halfWidth: number,
  positions: number[],
  indices: number[],
  vertexOffsetStart: number,
): number {
  if (segmentPts.length < 2) {
    return vertexOffsetStart;
  }
  for (let i = 0; i < segmentPts.length; i += 1) {
    const prev = segmentPts[Math.max(0, i - 1)]!;
    const next = segmentPts[Math.min(segmentPts.length - 1, i + 1)]!;
    const curr = segmentPts[i]!;
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len;
    const nz = tx / len;

    positions.push(
      curr.x + nx * halfWidth,
      curr.y + 0.38,
      curr.z + nz * halfWidth,
      curr.x - nx * halfWidth,
      curr.y + 0.38,
      curr.z - nz * halfWidth,
    );
  }

  for (let i = 0; i < segmentPts.length - 1; i += 1) {
    const a = vertexOffsetStart + i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }
  return vertexOffsetStart + segmentPts.length * 2;
}

function buildRibbonGeometryFromRuns(
  runs: readonly (readonly DrapedPoint[])[],
  halfWidth: number,
  dashed: boolean,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  if (!dashed) {
    for (const run of runs) {
      vertexOffset = pushRibbonSegmentVertices(run, halfWidth, positions, indices, vertexOffset);
    }
  } else {
    const dashLen = 6.5;
    const gapLen = 4.2;
    const period = dashLen + gapLen;

    for (const run of runs) {
      if (run.length < 2) continue;
      let acc = 0;
      let activeDash: DrapedPoint[] = [];

      const flushDash = () => {
        if (activeDash.length >= 2) {
          vertexOffset = pushRibbonSegmentVertices(
            activeDash,
            halfWidth,
            positions,
            indices,
            vertexOffset,
          );
        }
        activeDash = [];
      };

      for (let i = 0; i < run.length - 1; i += 1) {
        const p0 = run[i]!;
        const p1 = run[i + 1]!;
        const segLen = Math.hypot(p1.x - p0.x, p1.z - p0.z);
        if (segLen <= 1e-6) continue;

        let localCursor = 0;
        while (localCursor < segLen - 1e-6) {
          const cyclePos = (acc + localCursor) % period;
          if (cyclePos < dashLen) {
            const stepEnd = Math.min(segLen, localCursor + (dashLen - cyclePos));
            const a0 = localCursor / segLen;
            const a1 = stepEnd / segLen;
            if (activeDash.length === 0) {
              activeDash.push({
                x: p0.x + (p1.x - p0.x) * a0,
                y: p0.y + (p1.y - p0.y) * a0,
                z: p0.z + (p1.z - p0.z) * a0,
                elevationM: p0.elevationM + (p1.elevationM - p0.elevationM) * a0,
              });
            }
            activeDash.push({
              x: p0.x + (p1.x - p0.x) * a1,
              y: p0.y + (p1.y - p0.y) * a1,
              z: p0.z + (p1.z - p0.z) * a1,
              elevationM: p0.elevationM + (p1.elevationM - p0.elevationM) * a1,
            });
            localCursor = stepEnd;
            if ((acc + localCursor) % period >= dashLen - 1e-5 || stepEnd >= segLen - 1e-6) {
              if (stepEnd < segLen - 1e-6) flushDash();
            }
          } else {
            flushDash();
            const gapRemaining = period - cyclePos;
            localCursor = Math.min(segLen, localCursor + gapRemaining);
          }
        }
        acc += segLen;
      }
      flushDash();
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

interface DrapedRouteRibbonProps {
  readonly polyline: DrapedPolylineResult;
  readonly color: string;
  readonly halfWidth: number;
  readonly opacity: number;
  readonly dashed?: boolean;
  readonly renderOrder?: number;
}

function DrapedRouteRibbon({
  polyline,
  color,
  halfWidth,
  opacity,
  dashed = false,
  renderOrder = 2,
}: DrapedRouteRibbonProps) {
  const geometry = useMemo(
    () => buildRibbonGeometryFromRuns(polyline.runs, halfWidth, dashed),
    [polyline, halfWidth, dashed],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  if (geometry.getAttribute('position').count === 0) {
    return null;
  }

  return (
    <mesh geometry={geometry} renderOrder={renderOrder}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
}

interface PoiBeaconProps {
  readonly id: InspectablePoiId;
  readonly point: DrapedPoint;
  readonly color: string;
  readonly selected: boolean;
  readonly onSelect: (id: InspectablePoiId) => void;
}

function PoiBeacon({
  id,
  point,
  color,
  selected,
  onSelect,
}: PoiBeaconProps) {
  return (
    <group position={[point.x, point.y, point.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.7, 0]} renderOrder={4}>
        <ringGeometry args={[selected ? 4.4 : 3.1, selected ? 6.8 : 4.9, 32]} />
        <meshBasicMaterial
          color={selected ? '#f2f5f3' : color}
          side={THREE.DoubleSide}
          transparent
          opacity={selected ? 0.96 : 0.8}
        />
      </mesh>

      <mesh position={[0, 5.4, 0]} renderOrder={4}>
        <cylinderGeometry args={[0.62, 0.62, 9.6, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>

      <mesh position={[0, 10.6, 0]} renderOrder={4}>
        <sphereGeometry args={[selected ? 2.8 : 2.1, 16, 16]} />
        <meshBasicMaterial color={selected ? '#f2f5f3' : color} />
      </mesh>

      {/* Invisible pickable hit volume */}
      <mesh
        position={[0, 7.5, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[12, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function resolveAstronautPose(
  mission: SimulatedMissionState,
  playback: PlaybackState,
  geometry: DrapedScenarioGeometry,
): { readonly pose: DrapedPose; readonly isWalking: boolean } {
  const outbound =
    mission.selectedRouteId === 'B'
      ? geometry.movements.routeB
      : geometry.movements.routeA;

  switch (mission.phase) {
    case 'planning': {
      const startPose = samplePoseAlongDrapedPolyline(outbound, 0);
      return {
        pose: startPose ?? { ...geometry.base, yawRad: 0 },
        isWalking: false,
      };
    }
    case 'completed': {
      const returnLeg =
        mission.chosenBranch === 'extra'
          ? geometry.movements.returnAfterExtra
          : geometry.movements.direct;
      const endPose = samplePoseAlongDrapedPolyline(returnLeg, 1);
      return {
        pose: endPose ?? { ...geometry.base, yawRad: 0 },
        isWalking: false,
      };
    }
    case 'outbound': {
      const frac = playback.activeLeg === 'outbound' ? playback.legProgress01 : 0.5;
      const pose = samplePoseAlongDrapedPolyline(outbound, frac);
      return {
        pose: pose ?? { ...geometry.base, yawRad: 0 },
        isWalking: true,
      };
    }
    case 'observing':
    case 'deciding': {
      const arrivalPose = samplePoseAlongDrapedPolyline(outbound, 1);
      return {
        pose: arrivalPose ?? { ...geometry.science, yawRad: 0 },
        isWalking: false,
      };
    }
    case 'extra_stop': {
      const frac = playback.activeLeg === 'extra_stop' ? playback.legProgress01 : 0.5;
      const pose = samplePoseAlongDrapedPolyline(geometry.movements.extra, frac);
      return {
        pose: pose ?? { ...geometry.extraStop, yawRad: 0 },
        isWalking: true,
      };
    }
    case 'returning': {
      const returnLeg =
        mission.chosenBranch === 'extra'
          ? geometry.movements.returnAfterExtra
          : geometry.movements.direct;
      const frac = playback.activeLeg === 'returning' ? playback.legProgress01 : 0.5;
      const pose = samplePoseAlongDrapedPolyline(returnLeg, frac);
      return {
        pose: pose ?? { ...geometry.science, yawRad: 0 },
        isWalking: true,
      };
    }
  }
}

const TEMP_VEC3 = new THREE.Vector3();

export function JezeroTerrainStage({
  terrainGrid,
  thermalData,
  thermalEnabled,
  thermalOpacity,
  surfaceMode,
  routesVisible,
  poisVisible,
  drapedGeometry,
  selectedRouteId,
  inspectedOptionId,
  mission,
  playback,
  selectedPoiId,
  reducedMotion,
  onSelectPoi,
  resolveLabelElement,
}: JezeroTerrainStageProps) {
  const { invalidate } = useThree();
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const thermalTexRef = useRef<THREE.DataTexture | null>(null);
  const thermalEnabledRef = useRef(thermalEnabled);
  const thermalOpacityRef = useRef(thermalOpacity);
  const surfaceModeRef = useRef(surfaceMode);

  // Build indexed terrain geometry with exact mask holes and elevation color ramp
  const { terrainGeometry, minY, maxY } = useMemo(() => {
    const meshData = buildTerrainMeshData(terrainGrid);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(meshData.positions, 3),
    );
    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(meshData.colorsLinear, 3),
    );
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(meshData.uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
    geometry.computeVertexNormals();
    geometry.boundingBox = new THREE.Box3(
      new THREE.Vector3(...meshData.boundsMin),
      new THREE.Vector3(...meshData.boundsMax),
    );
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    const radius = geometry.boundingBox.min.distanceTo(geometry.boundingBox.max) * 0.5;
    geometry.boundingSphere = new THREE.Sphere(center, radius);
    return {
      terrainGeometry: geometry,
      minY: meshData.boundsMin[1],
      maxY: meshData.boundsMax[1],
    };
  }, [terrainGrid]);

  useEffect(() => {
    return () => {
      terrainGeometry.dispose();
    };
  }, [terrainGeometry]);

  // 1x1 transparent fallback texture when thermal asset is unavailable
  const fallbackTexture = useMemo(() => {
    const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }, []);

  useEffect(() => {
    return () => {
      fallbackTexture.dispose();
    };
  }, [fallbackTexture]);

  // Create and attach ShaderMaterial inside effect so Three.js uniform updates stay imperatively owned
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return undefined;
    }

    const material = new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERTEX_SHADER,
      fragmentShader: TERRAIN_FRAGMENT_SHADER,
      uniforms: {
        uThermalMap: { value: thermalTexRef.current ?? fallbackTexture },
        uThermalActive: {
          value: thermalEnabledRef.current && thermalTexRef.current !== null ? 1 : 0,
        },
        uThermalOpacity: { value: thermalOpacityRef.current },
        uElevationMode: { value: surfaceModeRef.current === 'elevation' ? 1 : 0 },
        uMinY: { value: minY },
        uMaxY: { value: maxY },
        uSunDir: { value: new THREE.Vector3(0.68, 0.52, 0.34).normalize() },
        uFillDir: { value: new THREE.Vector3(-0.52, 0.38, -0.58).normalize() },
      },
    });

    materialRef.current = material;
    mesh.material = material;
    invalidate();

    return () => {
      materialRef.current = null;
      material.dispose();
    };
  }, [fallbackTexture, invalidate, minY, maxY]);

  // Upload validated raw thermal bytes directly via DataTexture (flipY=true, NearestFilter, no mipmaps)
  useEffect(() => {
    if (!thermalData) {
      thermalTexRef.current = null;
      const mat = materialRef.current;
      if (mat) {
        mat.uniforms.uThermalMap!.value = fallbackTexture;
        mat.uniforms.uThermalActive!.value = 0;
      }
      invalidate();
      return undefined;
    }

    const tex = new THREE.DataTexture(
      new Uint8Array(thermalData.rgba),
      thermalData.width,
      thermalData.height,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    tex.flipY = true;
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.NoColorSpace;
    tex.needsUpdate = true;

    thermalTexRef.current = tex;
    const mat = materialRef.current;
    if (mat) {
      mat.uniforms.uThermalMap!.value = tex;
      mat.uniforms.uThermalActive!.value = thermalEnabledRef.current ? 1 : 0;
    }
    invalidate();

    return () => {
      thermalTexRef.current = null;
      const currentMat = materialRef.current;
      if (currentMat) {
        currentMat.uniforms.uThermalMap!.value = fallbackTexture;
        currentMat.uniforms.uThermalActive!.value = 0;
      }
      tex.dispose();
    };
  }, [thermalData, fallbackTexture, invalidate]);

  useEffect(() => {
    thermalEnabledRef.current = thermalEnabled;
    thermalOpacityRef.current = thermalOpacity;
    surfaceModeRef.current = surfaceMode;
    const mat = materialRef.current;
    if (!mat) {
      return;
    }
    mat.uniforms.uThermalActive!.value =
      thermalEnabled && thermalTexRef.current !== null ? 1 : 0;
    mat.uniforms.uThermalOpacity!.value = thermalOpacity;
    mat.uniforms.uElevationMode!.value = surfaceMode === 'elevation' ? 1 : 0;
    invalidate();
  }, [thermalEnabled, thermalOpacity, surfaceMode, invalidate]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
    };
  }, []);

  const routeAnchorA = useMemo(() => {
    if (!drapedGeometry) return null;
    return samplePoseAlongDrapedPolyline(drapedGeometry.movements.routeA, 0.36);
  }, [drapedGeometry]);

  const routeAnchorB = useMemo(() => {
    if (!drapedGeometry) return null;
    return samplePoseAlongDrapedPolyline(drapedGeometry.movements.routeB, 0.64);
  }, [drapedGeometry]);

  // Project named POI & route HTML tags directly onto screen space without React state churn
  useFrame(({ camera, size }) => {
    const labelAnchors: Array<{
      readonly id: MapOverlayLabelId;
      readonly visible: boolean;
      readonly point: DrapedPoint | null;
      readonly liftY: number;
    }> = [
      { id: 'base', visible: poisVisible, point: drapedGeometry?.base ?? null, liftY: 16 },
      { id: 'science', visible: poisVisible, point: drapedGeometry?.science ?? null, liftY: 16 },
      {
        id: 'extra-stop',
        visible: poisVisible,
        point: drapedGeometry?.extraStop ?? null,
        liftY: 14,
      },
      { id: 'route-a', visible: routesVisible, point: routeAnchorA, liftY: 8 },
      { id: 'route-b', visible: routesVisible, point: routeAnchorB, liftY: 8 },
    ];

    const placed: Array<{ x: number; y: number }> = [];

    for (const item of labelAnchors) {
      const el = resolveLabelElement(item.id);
      if (!el) continue;
      if (!item.visible || !item.point) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        continue;
      }

      TEMP_VEC3.set(item.point.x, item.point.y + item.liftY, item.point.z).project(camera);
      const inFrustum =
        TEMP_VEC3.z >= -1 &&
        TEMP_VEC3.z <= 1 &&
        Math.abs(TEMP_VEC3.x) <= 0.94 &&
        Math.abs(TEMP_VEC3.y) <= 0.92;

      if (!inFrustum) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        continue;
      }

      let px = (TEMP_VEC3.x * 0.5 + 0.5) * size.width;
      let py = (-TEMP_VEC3.y * 0.5 + 0.5) * size.height;

      // De-overlap adjacent labels cleanly in screen pixels
      for (const prev of placed) {
        const dx = px - prev.x;
        const dy = py - prev.y;
        if (Math.abs(dx) < 138 && Math.abs(dy) < 28) {
          py = dy >= 0 ? prev.y + 30 : prev.y - 30;
        }
      }
      px = Math.max(82, Math.min(size.width - 82, px));
      py = Math.max(46, Math.min(size.height - 52, py));
      placed.push({ x: px, y: py });

      el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -100%)`;
      el.style.opacity = '1';
      el.style.pointerEvents = item.id.startsWith('route-') ? 'none' : 'auto';
    }
  });

  const activeBranch = mission.chosenBranch ?? inspectedOptionId;
  const isRouteASelected = selectedRouteId === 'A';
  const isDirectHighlighted = activeBranch === 'direct';
  const isExtraHighlighted = activeBranch === 'extra';

  const astronautState = useMemo(() => {
    if (!drapedGeometry) return null;
    return resolveAstronautPose(mission, playback, drapedGeometry);
  }, [drapedGeometry, mission, playback]);

  return (
    <group>
      <color attach="background" args={['#10191e']} />

      <ambientLight intensity={0.48} color="#d6dde6" />
      <directionalLight position={[190, 210, 95]} intensity={1.75} color="#fff1dc" />
      <directionalLight position={[-140, 120, -160]} intensity={0.55} color="#8fb6d9" />

      <mesh ref={meshRef} geometry={terrainGeometry} />

      {drapedGeometry ? (
        <group>
          {routesVisible ? (
            <group>
              {/* Outbound A and B routes: active bright cyan-turquoise, alt muted dashed */}
              <DrapedRouteRibbon
                polyline={drapedGeometry.movements.routeA}
                color={isRouteASelected ? '#00d9c2' : '#9fb1bd'}
                halfWidth={isRouteASelected ? 1.9 : 1.0}
                opacity={isRouteASelected ? 0.96 : 0.72}
                dashed={!isRouteASelected}
                renderOrder={isRouteASelected ? 3 : 2}
              />
              <DrapedRouteRibbon
                polyline={drapedGeometry.movements.routeB}
                color={!isRouteASelected ? '#00d9c2' : '#9fb1bd'}
                halfWidth={!isRouteASelected ? 1.9 : 1.0}
                opacity={!isRouteASelected ? 0.96 : 0.72}
                dashed={isRouteASelected}
                renderOrder={!isRouteASelected ? 3 : 2}
              />

              {/* Direct return branch */}
              <DrapedRouteRibbon
                polyline={drapedGeometry.movements.direct}
                color={isDirectHighlighted ? '#3fc07a' : '#3b7e64'}
                halfWidth={isDirectHighlighted ? 1.55 : 0.9}
                opacity={isDirectHighlighted ? 0.96 : 0.62}
                dashed={!isDirectHighlighted}
                renderOrder={isDirectHighlighted ? 3 : 2}
              />

              {/* Extra stop access + returnAfterExtra branch */}
              <DrapedRouteRibbon
                polyline={drapedGeometry.movements.extra}
                color={isExtraHighlighted ? '#e5a93b' : '#9b742d'}
                halfWidth={isExtraHighlighted ? 1.6 : 0.95}
                opacity={isExtraHighlighted ? 0.96 : 0.64}
                dashed={!isExtraHighlighted}
                renderOrder={isExtraHighlighted ? 3 : 2}
              />
              <DrapedRouteRibbon
                polyline={drapedGeometry.movements.returnAfterExtra}
                color={isExtraHighlighted ? '#e5a93b' : '#9b742d'}
                halfWidth={isExtraHighlighted ? 1.6 : 0.95}
                opacity={isExtraHighlighted ? 0.96 : 0.64}
                dashed={!isExtraHighlighted}
                renderOrder={isExtraHighlighted ? 3 : 2}
              />
            </group>
          ) : null}

          {poisVisible ? (
            <group>
              <PoiBeacon
                id="base"
                point={drapedGeometry.base}
                color="#f2f5f3"
                selected={selectedPoiId === 'base'}
                onSelect={onSelectPoi}
              />
              <PoiBeacon
                id="science"
                point={drapedGeometry.science}
                color="#00d9c2"
                selected={selectedPoiId === 'science'}
                onSelect={onSelectPoi}
              />
              <PoiBeacon
                id="extra-stop"
                point={drapedGeometry.extraStop}
                color="#e5a93b"
                selected={selectedPoiId === 'extra-stop'}
                onSelect={onSelectPoi}
              />
            </group>
          ) : null}

          {/* Enlarged articulated EVA astronaut marker following non-bridging draped paths */}
          {astronautState ? (
            <AstronautFigure
              pose={astronautState.pose}
              isWalking={astronautState.isWalking}
              isPaused={playback.isPaused}
              reducedMotion={reducedMotion}
            />
          ) : null}
        </group>
      ) : null}
    </group>
  );
}
