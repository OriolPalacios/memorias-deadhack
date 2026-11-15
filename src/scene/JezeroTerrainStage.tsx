import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DecisionOptionId } from '../domain/autonomy.ts';
import type { SimulatedMissionState } from '../domain/missionEngine.ts';
import type { RouteId } from '../domain/scenario.ts';
import {
  buildTerrainMeshData,
  samplePointAlongDrapedPolyline,
  type DrapedPoint,
  type DrapedPolylineResult,
  type DrapedScenarioGeometry,
  type TerrainGridData,
} from '../data/jezeroContracts.ts';

export type InspectablePoiId = 'base' | 'science' | 'extra-stop';

interface JezeroTerrainStageProps {
  readonly terrainGrid: TerrainGridData;
  readonly thermalObjectUrl: string | null;
  readonly thermalEnabled: boolean;
  readonly thermalOpacity: number;
  readonly drapedGeometry: DrapedScenarioGeometry | null;
  readonly selectedRouteId: RouteId;
  readonly inspectedOptionId: DecisionOptionId | null;
  readonly mission: SimulatedMissionState;
  readonly selectedPoiId: InspectablePoiId;
  readonly reducedMotion: boolean;
  readonly onSelectPoi: (poiId: InspectablePoiId) => void;
}

const TERRAIN_VERTEX_SHADER = /* glsl */ `
attribute vec3 color;
varying vec3 vElevColor;
varying vec3 vWorldNormal;
varying vec2 vThermalUv;

void main() {
  vElevColor = color;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vThermalUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const TERRAIN_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uThermalMap;
uniform float uThermalActive;
uniform float uThermalOpacity;
uniform vec3 uSunDir;
uniform vec3 uFillDir;
varying vec3 vElevColor;
varying vec3 vWorldNormal;
varying vec2 vThermalUv;

vec3 srgbToLinearVec(vec3 c) {
  vec3 lo = c / 12.92;
  vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(lo, hi, step(vec3(0.04045), c));
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

void main() {
  vec3 n = normalize(vWorldNormal);
  float sunDiff = max(dot(n, normalize(uSunDir)), 0.0);
  float fillDiff = max(dot(n, normalize(uFillDir)), 0.0);
  float shade = 0.34 + 0.62 * sunDiff + 0.16 * fillDiff;
  vec3 litTerrain = vElevColor * shade;

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

function buildRibbonGeometryFromRuns(
  runs: readonly (readonly DrapedPoint[])[],
  halfWidth: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const run of runs) {
    if (run.length < 2) {
      continue;
    }

    for (let i = 0; i < run.length; i += 1) {
      const prev = run[Math.max(0, i - 1)]!;
      const next = run[Math.min(run.length - 1, i + 1)]!;
      const curr = run[i]!;
      const tx = next.x - prev.x;
      const tz = next.z - prev.z;
      const len = Math.hypot(tx, tz) || 1;
      const nx = -tz / len;
      const nz = tx / len;

      positions.push(
        curr.x + nx * halfWidth,
        curr.y + 0.35,
        curr.z + nz * halfWidth,
        curr.x - nx * halfWidth,
        curr.y + 0.35,
        curr.z - nz * halfWidth,
      );
    }

    for (let i = 0; i < run.length - 1; i += 1) {
      const a = vertexOffset + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }

    vertexOffset += run.length * 2;
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
  readonly renderOrder?: number;
}

function DrapedRouteRibbon({
  polyline,
  color,
  halfWidth,
  opacity,
  renderOrder = 2,
}: DrapedRouteRibbonProps) {
  const geometry = useMemo(
    () => buildRibbonGeometryFromRuns(polyline.runs, halfWidth),
    [polyline, halfWidth],
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.8, 0]} renderOrder={4}>
        <ringGeometry args={[selected ? 4.5 : 3.2, selected ? 7.2 : 5.2, 32]} />
        <meshBasicMaterial
          color={selected ? '#ffffff' : color}
          side={THREE.DoubleSide}
          transparent
          opacity={selected ? 0.96 : 0.78}
        />
      </mesh>

      <mesh position={[0, 6.2, 0]} renderOrder={4}>
        <cylinderGeometry args={[0.75, 0.75, 10.8, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>

      <mesh position={[0, 12.2, 0]} renderOrder={4}>
        <sphereGeometry args={[selected ? 3.2 : 2.5, 16, 16]} />
        <meshBasicMaterial color={selected ? '#ffffff' : color} />
      </mesh>

      {/* Invisible pickable hit volume */}
      <mesh
        position={[0, 8, 0]}
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

function resolveMarkerPosition(
  mission: SimulatedMissionState,
  geometry: DrapedScenarioGeometry,
): DrapedPoint {
  switch (mission.phase) {
    case 'planning':
    case 'completed':
      return geometry.base;
    case 'outbound': {
      const outbound =
        mission.selectedRouteId === 'B'
          ? geometry.movements.routeB
          : geometry.movements.routeA;
      return samplePointAlongDrapedPolyline(outbound, 0.5) ?? geometry.base;
    }
    case 'observing':
    case 'deciding':
      return geometry.science;
    case 'extra_stop':
      return geometry.extraStop;
    case 'returning': {
      const returnLeg =
        mission.chosenBranch === 'extra'
          ? geometry.movements.returnAfterExtra
          : geometry.movements.direct;
      return samplePointAlongDrapedPolyline(returnLeg, 0.5) ?? geometry.science;
    }
  }
}

interface PhaseMarkerProps {
  readonly point: DrapedPoint;
  readonly reducedMotion: boolean;
}

function PhaseMarker({ point, reducedMotion }: PhaseMarkerProps) {
  const diamondRef = useRef<THREE.Mesh | null>(null);
  const haloRef = useRef<THREE.Mesh | null>(null);

  useFrame(({ clock }) => {
    if (reducedMotion) {
      if (diamondRef.current) {
        diamondRef.current.position.y = 17.5;
        diamondRef.current.rotation.y = 0;
      }
      if (haloRef.current) {
        haloRef.current.scale.setScalar(1);
      }
      return;
    }
    const t = clock.getElapsedTime();
    if (diamondRef.current) {
      diamondRef.current.position.y = 17.5 + Math.sin(t * 2.4) * 1.4;
      diamondRef.current.rotation.y = t * 0.9;
    }
    if (haloRef.current) {
      const s = 1 + Math.sin(t * 2.4) * 0.14;
      haloRef.current.scale.set(s, s, 1);
    }
  });

  return (
    <group position={[point.x, point.y, point.z]}>
      <mesh
        ref={haloRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 1.3, 0]}
        renderOrder={5}
      >
        <ringGeometry args={[6.4, 9.2, 32]} />
        <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.92} />
      </mesh>
      <mesh ref={diamondRef} position={[0, 17.5, 0]} renderOrder={5}>
        <octahedronGeometry args={[4.0, 0]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
    </group>
  );
}

export function JezeroTerrainStage({
  terrainGrid,
  thermalObjectUrl,
  thermalEnabled,
  thermalOpacity,
  drapedGeometry,
  selectedRouteId,
  inspectedOptionId,
  mission,
  selectedPoiId,
  reducedMotion,
  onSelectPoi,
}: JezeroTerrainStageProps) {
  const { invalidate } = useThree();
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const thermalTexRef = useRef<THREE.Texture | null>(null);
  const thermalEnabledRef = useRef(thermalEnabled);
  const thermalOpacityRef = useRef(thermalOpacity);

  // Build indexed terrain geometry with exact mask holes and elevation color ramp
  const terrainGeometry = useMemo(() => {
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
    return geometry;
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
        uSunDir: { value: new THREE.Vector3(0.58, 0.72, 0.38).normalize() },
        uFillDir: { value: new THREE.Vector3(-0.55, 0.45, -0.5).normalize() },
      },
    });

    materialRef.current = material;
    mesh.material = material;
    invalidate();

    return () => {
      materialRef.current = null;
      material.dispose();
    };
  }, [fallbackTexture, invalidate]);

  // Load verified thermal PNG through Three.js TextureLoader (flipY=true, NearestFilter, no mipmaps)
  useEffect(() => {
    if (!thermalObjectUrl) {
      thermalTexRef.current = null;
      const mat = materialRef.current;
      if (mat) {
        mat.uniforms.uThermalMap!.value = fallbackTexture;
        mat.uniforms.uThermalActive!.value = 0;
      }
      invalidate();
      return undefined;
    }

    let cancelled = false;
    let loadedTex: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();

    loader.load(
      thermalObjectUrl,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.flipY = true;
        tex.minFilter = THREE.NearestFilter;
        tex.magFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.colorSpace = THREE.NoColorSpace;
        tex.needsUpdate = true;
        loadedTex = tex;
        thermalTexRef.current = tex;

        const mat = materialRef.current;
        if (mat) {
          mat.uniforms.uThermalMap!.value = tex;
          mat.uniforms.uThermalActive!.value = thermalEnabledRef.current ? 1 : 0;
        }
        invalidate();
      },
      undefined,
      () => {
        if (!cancelled) {
          thermalTexRef.current = null;
          const mat = materialRef.current;
          if (mat) {
            mat.uniforms.uThermalMap!.value = fallbackTexture;
            mat.uniforms.uThermalActive!.value = 0;
          }
          invalidate();
        }
      },
    );

    return () => {
      cancelled = true;
      thermalTexRef.current = null;
      const mat = materialRef.current;
      if (mat) {
        mat.uniforms.uThermalMap!.value = fallbackTexture;
        mat.uniforms.uThermalActive!.value = 0;
      }
      if (loadedTex) {
        loadedTex.dispose();
      }
    };
  }, [thermalObjectUrl, fallbackTexture, invalidate]);

  useEffect(() => {
    thermalEnabledRef.current = thermalEnabled;
    thermalOpacityRef.current = thermalOpacity;
    const mat = materialRef.current;
    if (!mat) {
      return;
    }
    mat.uniforms.uThermalActive!.value =
      thermalEnabled && thermalTexRef.current !== null ? 1 : 0;
    mat.uniforms.uThermalOpacity!.value = thermalOpacity;
    invalidate();
  }, [thermalEnabled, thermalOpacity, invalidate]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
    };
  }, []);

  const activeBranch = mission.chosenBranch ?? inspectedOptionId;
  const isRouteASelected = selectedRouteId === 'A';
  const isDirectHighlighted = activeBranch === 'direct';
  const isExtraHighlighted = activeBranch === 'extra';

  const markerPoint = useMemo(() => {
    if (!drapedGeometry) return null;
    return resolveMarkerPosition(mission, drapedGeometry);
  }, [mission, drapedGeometry]);

  return (
    <group>
      <color attach="background" args={['#080809']} />

      <mesh ref={meshRef} geometry={terrainGeometry} />

      {drapedGeometry ? (
        <group>
          {/* Outbound A and B routes */}
          <DrapedRouteRibbon
            polyline={drapedGeometry.movements.routeA}
            color={isRouteASelected ? '#d4a373' : '#7a828e'}
            halfWidth={isRouteASelected ? 1.65 : 0.85}
            opacity={isRouteASelected ? 0.98 : 0.55}
            renderOrder={isRouteASelected ? 3 : 2}
          />
          <DrapedRouteRibbon
            polyline={drapedGeometry.movements.routeB}
            color={!isRouteASelected ? '#d4a373' : '#7a828e'}
            halfWidth={!isRouteASelected ? 1.65 : 0.85}
            opacity={!isRouteASelected ? 0.98 : 0.55}
            renderOrder={!isRouteASelected ? 3 : 2}
          />

          {/* Direct return branch */}
          <DrapedRouteRibbon
            polyline={drapedGeometry.movements.direct}
            color={isDirectHighlighted ? '#3fc07a' : '#2d7a53'}
            halfWidth={isDirectHighlighted ? 1.55 : 0.9}
            opacity={isDirectHighlighted ? 0.98 : 0.72}
            renderOrder={isDirectHighlighted ? 3 : 2}
          />

          {/* Extra stop access + returnAfterExtra branch */}
          <DrapedRouteRibbon
            polyline={drapedGeometry.movements.extra}
            color={isExtraHighlighted ? '#e5a93b' : '#966d26'}
            halfWidth={isExtraHighlighted ? 1.55 : 0.9}
            opacity={isExtraHighlighted ? 0.98 : 0.68}
            renderOrder={isExtraHighlighted ? 3 : 2}
          />
          <DrapedRouteRibbon
            polyline={drapedGeometry.movements.returnAfterExtra}
            color={isExtraHighlighted ? '#e5a93b' : '#966d26'}
            halfWidth={isExtraHighlighted ? 1.55 : 0.9}
            opacity={isExtraHighlighted ? 0.98 : 0.68}
            renderOrder={isExtraHighlighted ? 3 : 2}
          />

          {/* Simulated POIs */}
          <PoiBeacon
            id="base"
            point={drapedGeometry.base}
            color="#ffffff"
            selected={selectedPoiId === 'base'}
            onSelect={onSelectPoi}
          />
          <PoiBeacon
            id="science"
            point={drapedGeometry.science}
            color="#d4a373"
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

          {/* Phase-based simulated position marker */}
          {markerPoint ? (
            <PhaseMarker point={markerPoint} reducedMotion={reducedMotion} />
          ) : null}
        </group>
      ) : null}
    </group>
  );
}
