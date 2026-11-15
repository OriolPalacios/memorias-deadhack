/**
 * Pure React reducer state for the local planning shell (APP-04).
 */

import type { DecisionOptionId } from '../domain/autonomy.ts';
import {
  createInitialSimulatedMissionState,
  transitionSimulatedMission,
  type MissionBaselineConfig,
  type MissionEvent,
  type SimulatedMissionState,
} from '../domain/missionEngine.ts';
import {
  DEFAULT_ROUTE_ID,
  SIMULATED_MISSION_BASELINE,
  type RouteId,
} from '../domain/scenario.ts';

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
  | { type: 'select_route'; routeId: RouteId; baseline?: MissionBaselineConfig }
  | { type: 'mission_event'; event: MissionEvent; baseline?: MissionBaselineConfig }
  | { type: 'inspect_option'; optionId: DecisionOptionId | null }
  | { type: 'orbit_changed' }
  | { type: 'reset_camera' }
  | { type: 'reset_scenario'; baseline?: MissionBaselineConfig }
  | { type: 'sync_baseline'; baseline?: MissionBaselineConfig }
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
  fallbackBaseline: MissionBaselineConfig = SIMULATED_MISSION_BASELINE,
): MissionShellState {
  switch (action.type) {
    case 'select_route': {
      const baseline = action.baseline ?? fallbackBaseline;
      const nextMission = transitionSimulatedMission(
        state.mission,
        {
          type: 'select_route',
          routeId: action.routeId,
        },
        baseline,
      );
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
      const baseline = action.baseline ?? fallbackBaseline;
      const nextMission = transitionSimulatedMission(
        state.mission,
        action.event,
        baseline,
      );
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
      const baseline = action.baseline ?? fallbackBaseline;
      const resetMission = transitionSimulatedMission(
        state.mission,
        {
          type: 'reset_mission',
        },
        baseline,
      );
      return {
        ...state,
        selectedRouteId: resetMission.selectedRouteId,
        mission: resetMission,
        inspectedOptionId: null,
        cameraResetCount: state.cameraResetCount + 1,
        hasOrbitedView: false,
      };
    }
    case 'sync_baseline': {
      const baseline = action.baseline ?? fallbackBaseline;
      if (state.mission.phase !== 'planning' || state.mission.appliedEvents.length > 0) {
        return state;
      }
      if (
        state.mission.initialBudgetMin === baseline.initialBudgetMin &&
        state.mission.reserveMin === baseline.reserveMin &&
        state.mission.remainingMin === baseline.initialBudgetMin
      ) {
        return state;
      }
      return {
        ...state,
        mission: createInitialSimulatedMissionState(state.selectedRouteId, baseline),
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
