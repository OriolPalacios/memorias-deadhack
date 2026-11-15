export const DEFAULT_ORBIT_CAMERA_POSITION: readonly [number, number, number] = [4.6, 3.2, 5.2];
export const DEFAULT_ORBIT_TARGET: readonly [number, number, number] = [0, 0.15, 0];

export interface CameraRigPreset {
  readonly modeKey: string;
  readonly overviewPosition: readonly [number, number, number];
  readonly overviewTarget: readonly [number, number, number];
  readonly focusPosition: readonly [number, number, number] | null;
  readonly focusTarget: readonly [number, number, number] | null;
  readonly near: number;
  readonly far: number;
  readonly minDistance: number;
  readonly maxDistance: number;
  readonly keyPanSpeed: number;
}

export const REFERENCE_CAMERA_PRESET: CameraRigPreset = {
  modeKey: 'reference',
  overviewPosition: DEFAULT_ORBIT_CAMERA_POSITION,
  overviewTarget: DEFAULT_ORBIT_TARGET,
  focusPosition: null,
  focusTarget: null,
  near: 0.1,
  far: 100,
  minDistance: 2.6,
  maxDistance: 14,
  keyPanSpeed: 12,
};

export function createTerrainCameraPreset(
  terrainId: string,
  boundsMin: readonly [number, number, number],
  boundsMax: readonly [number, number, number],
  sciencePoint: readonly [number, number, number] | null,
): CameraRigPreset {
  const cx = (boundsMin[0] + boundsMax[0]) * 0.5;
  const cy = (boundsMin[1] + boundsMax[1]) * 0.5;
  const cz = (boundsMin[2] + boundsMax[2]) * 0.5;

  const sizeX = Math.max(10, boundsMax[0] - boundsMin[0]);
  const sizeZ = Math.max(10, boundsMax[2] - boundsMin[2]);
  const span = Math.max(sizeX, sizeZ);

  const overviewTarget: readonly [number, number, number] = [cx, cy, cz];
  const overviewPosition: readonly [number, number, number] = [
    cx + span * 0.48,
    cy + span * 0.62,
    cz + span * 0.84,
  ];

  const focusTarget: readonly [number, number, number] | null = sciencePoint
    ? [sciencePoint[0], sciencePoint[1], sciencePoint[2]]
    : null;
  const focusPosition: readonly [number, number, number] | null = sciencePoint
    ? [
        sciencePoint[0] + span * 0.18,
        sciencePoint[1] + span * 0.18,
        sciencePoint[2] + span * 0.24,
      ]
    : null;

  return {
    modeKey: `terrain:${terrainId}:${Math.round(span)}`,
    overviewPosition,
    overviewTarget,
    focusPosition,
    focusTarget,
    near: Math.max(0.5, span * 0.002),
    far: Math.max(2000, span * 12),
    minDistance: Math.max(12, span * 0.08),
    maxDistance: Math.max(200, span * 3.0),
    keyPanSpeed: Math.max(12, span * 0.06),
  };
}
