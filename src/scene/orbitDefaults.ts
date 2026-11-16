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
  // ~54° oblique look looking ESE so Base sits bottom-left and simulated Science sits top-right.
  const pitchRad = (54 * Math.PI) / 180;
  const overviewDistance = span * 1.24;
  const overviewHoriz = overviewDistance * Math.cos(pitchRad);
  const overviewHeight = overviewDistance * Math.sin(pitchRad);
  const azX = -0.92;
  const azZ = -0.39;
  const overviewPosition: readonly [number, number, number] = [
    cx + azX * overviewHoriz,
    cy + overviewHeight,
    cz + azZ * overviewHoriz,
  ];

  const focusTarget: readonly [number, number, number] | null = sciencePoint
    ? [sciencePoint[0], sciencePoint[1] + 4, sciencePoint[2]]
    : null;
  const focusDistance = span * 0.42;
  const focusHoriz = focusDistance * Math.cos(pitchRad * 0.82);
  const focusHeight = focusDistance * Math.sin(pitchRad * 0.82);
  const focusPosition: readonly [number, number, number] | null = sciencePoint
    ? [
        sciencePoint[0] + azX * focusHoriz,
        sciencePoint[1] + focusHeight + 6,
        sciencePoint[2] + azZ * focusHoriz,
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
