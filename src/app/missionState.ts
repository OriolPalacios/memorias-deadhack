/**
 * Pure React reducer state for the local planning shell (APP-04).
 */

import type { DecisionOptionId } from '../domain/autonomy.ts';
import {
  createInitialSimulatedMissionState,
  transitionSimulatedMission,
  type MissionEvent,
  type SimulatedMissionState,
} from '../domain/missionEngine.ts';
import { DEFAULT_ROUTE_ID, type RouteId } from '../domain/scenario.ts';

export type WebGLRenderStatus = 'ready' | 'unavailable' | 'context-lost';

export interface MissionShellState {
  readonly selectedRouteId: RouteId;
  readonly mission: SimulatedMissionState;
  readonly inspectedOptionId: DecisionOptionId | null;
  readonly cameraResetCount: number;
  readonly hasOrbitedView: boolean;
  readonly webglStatus: WebGLRenderStatus;
}

export type MissionShellAction =
  | { type: 'select_route'; routeId: RouteId }
  | { type: 'mission_event'; event: MissionEvent }
  | { type: 'inspect_option'; optionId: DecisionOptionId | null }
  | { type: 'orbit_changed' }
  | { type: 'reset_camera' }
  | { type: 'reset_scenario' }
  | { type: 'set_webgl_status'; status: WebGLRenderStatus };

export function createInitialMissionState(
  webglStatus: WebGLRenderStatus = 'ready',
): MissionShellState {
  const mission = createInitialSimulatedMissionState(DEFAULT_ROUTE_ID);
  return {
    selectedRouteId: mission.selectedRouteId,
    mission,
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
    case 'select_route': {
      const nextMission = transitionSimulatedMission(state.mission, {
        type: 'select_route',
        routeId: action.routeId,
      });
      if (nextMission === state.mission) {
        return state;
      }
      return {
        ...state,
        selectedRouteId: nextMission.selectedRouteId,
        mission: nextMission,
      };
    }
    case 'mission_event': {
      const nextMission = transitionSimulatedMission(state.mission, action.event);
      if (nextMission === state.mission) {
        return state;
      }
      return {
        ...state,
        selectedRouteId: nextMission.selectedRouteId,
        mission: nextMission,
      };
    }
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
    case 'reset_scenario': {
      const resetMission = transitionSimulatedMission(state.mission, {
        type: 'reset_mission',
      });
      return {
        ...state,
        selectedRouteId: resetMission.selectedRouteId,
        mission: resetMission,
        inspectedOptionId: null,
        cameraResetCount: state.cameraResetCount + 1,
        hasOrbitedView: false,
      };
    }
    case 'set_webgl_status':
      return {
        ...state,
        webglStatus: action.status,
      };
    default:
      return state;
  }
}
