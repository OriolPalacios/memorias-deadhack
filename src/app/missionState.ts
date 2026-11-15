/**
 * Pure React reducer state for the local planning shell (APP-04).
 */

import type { DecisionOptionId } from '../domain/autonomy.ts';
import { DEFAULT_ROUTE_ID, type RouteId } from '../domain/scenario.ts';

export type WebGLRenderStatus = 'ready' | 'unavailable' | 'context-lost';

export interface MissionShellState {
  readonly selectedRouteId: RouteId;
  readonly inspectedOptionId: DecisionOptionId | null;
  readonly cameraResetCount: number;
  readonly hasOrbitedView: boolean;
  readonly webglStatus: WebGLRenderStatus;
}

export type MissionShellAction =
  | { type: 'select_route'; routeId: RouteId }
  | { type: 'inspect_option'; optionId: DecisionOptionId | null }
  | { type: 'orbit_changed' }
  | { type: 'reset_camera' }
  | { type: 'reset_scenario' }
  | { type: 'set_webgl_status'; status: WebGLRenderStatus };

export function createInitialMissionState(
  webglStatus: WebGLRenderStatus = 'ready',
): MissionShellState {
  return {
    selectedRouteId: DEFAULT_ROUTE_ID,
    inspectedOptionId: null,
    cameraResetCount: 0,
    hasOrbitedView: false,
    webglStatus,
  };
}

export function missionShellReducer(
  state: MissionShellState,
  action: MissionShellAction,
): MissionShellState {
  switch (action.type) {
    case 'select_route':
      if (state.selectedRouteId === action.routeId) {
        return state;
      }
      return {
        ...state,
        selectedRouteId: action.routeId,
      };
    case 'inspect_option':
      return {
        ...state,
        inspectedOptionId:
          state.inspectedOptionId === action.optionId ? null : action.optionId,
      };
    case 'orbit_changed':
      if (state.hasOrbitedView) {
        return state;
      }
      return {
        ...state,
        hasOrbitedView: true,
      };
    case 'reset_camera':
      return {
        ...state,
        cameraResetCount: state.cameraResetCount + 1,
        hasOrbitedView: false,
      };
    case 'reset_scenario':
      return {
        ...state,
        selectedRouteId: DEFAULT_ROUTE_ID,
        inspectedOptionId: null,
        cameraResetCount: state.cameraResetCount + 1,
        hasOrbitedView: false,
      };
    case 'set_webgl_status':
      return {
        ...state,
        webglStatus: action.status,
      };
    default:
      return state;
  }
}
