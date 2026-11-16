import type { ScenarioConfigAuthority } from '../data/jezeroLoader.ts';
import type { DecisionOptionId } from '../domain/autonomy.ts';
import {
  createInitialSimulatedMissionState,
  transitionSimulatedMission,
  type MissionBaselineConfig,
  type MissionEvent,
  type SimulatedMissionPhase,
} from '../domain/missionEngine.ts';
import {
  SIMULATED_MISSION_BASELINE,
  type RouteId,
} from '../domain/scenario.ts';
import {
  createInitialMissionState,
  missionShellReducer,
  type MissionShellState,
  type WebGLRenderStatus,
} from './missionState.ts';

export type PlaybackLeg = 'none' | 'outbound' | 'observing' | 'extra_stop' | 'returning';

export interface PlaybackState {
  readonly isPlaying: boolean;
  readonly isPaused: boolean;
  readonly executionGeneration: number;
  readonly activeLeg: PlaybackLeg;
  readonly legProgress01: number;
  readonly legDurationMs: number;
  readonly completedTransitionKeys: Readonly<Record<string, true>>;
}

export interface AuthoritativeMissionState {
  readonly shell: MissionShellState;
  readonly configAuthority: ScenarioConfigAuthority;
  readonly liveBaseline: MissionBaselineConfig | null;
  readonly lockedRunBaseline: MissionBaselineConfig | null;
  readonly playback: PlaybackState;
}

export type AuthoritativeMissionAction =
  | {
      type: 'sync_config';
      authority: ScenarioConfigAuthority;
      baseline: MissionBaselineConfig | null;
    }
  | { type: 'select_route'; routeId: RouteId }
  | { type: 'start_simulation'; reducedMotion: boolean }
  | { type: 'toggle_pause' }
  | {
      type: 'playback_tick';
      dtMs: number;
      reducedMotion: boolean;
      expectedGeneration: number;
      expectedPhase: SimulatedMissionPhase;
    }
  | {
      type: 'playback_complete_leg';
      expectedGeneration: number;
      expectedPhase: SimulatedMissionPhase;
      event: MissionEvent;
      reducedMotion: boolean;
    }
  | { type: 'choose_branch'; branch: DecisionOptionId; reducedMotion: boolean }
  | { type: 'mission_event'; event: MissionEvent; reducedMotion?: boolean }
  | { type: 'inspect_option'; optionId: DecisionOptionId | null }
  | { type: 'orbit_changed' }
  | { type: 'reset_camera' }
  | { type: 'reset_scenario' }
  | { type: 'set_webgl_status'; status: WebGLRenderStatus };

const STANDARD_LEG_MS: Readonly<Record<Exclude<PlaybackLeg, 'none'>, number>> = {
  outbound: 6000,
  observing: 900,
  extra_stop: 4200,
  returning: 4200,
};

const REDUCED_LEG_MS: Readonly<Record<Exclude<PlaybackLeg, 'none'>, number>> = {
  outbound: 180,
  observing: 100,
  extra_stop: 150,
  returning: 150,
};

export function getLegDurationMs(
  leg: Exclude<PlaybackLeg, 'none'>,
  reducedMotion: boolean,
): number {
  return reducedMotion ? REDUCED_LEG_MS[leg] : STANDARD_LEG_MS[leg];
}

function makeTransitionKey(
  generation: number,
  phase: SimulatedMissionPhase,
  event: MissionEvent,
): string {
  const detail =
    event.type === 'choose_branch' ? `${event.type}:${event.branch}` : event.type;
  return `${generation}:${phase}:${detail}`;
}

export function getAuthoritativeBaseline(
  state: AuthoritativeMissionState,
): MissionBaselineConfig {
  if (state.shell.mission.phase !== 'planning' && state.lockedRunBaseline !== null) {
    return state.lockedRunBaseline;
  }
  return state.liveBaseline ?? SIMULATED_MISSION_BASELINE;
}

export function canStartMissionRun(state: AuthoritativeMissionState): boolean {
  return (
    state.shell.mission.phase === 'planning' &&
    state.configAuthority !== 'loading' &&
    state.liveBaseline !== null
  );
}

export function isPlaybackActivelyAnimating(state: AuthoritativeMissionState): boolean {
  return (
    state.playback.isPlaying &&
    !state.playback.isPaused &&
    state.playback.activeLeg !== 'none'
  );
}

export function createAuthoritativeMissionState(
  webglStatus: WebGLRenderStatus = 'ready',
  authority: ScenarioConfigAuthority = 'loading',
  initialBaseline: MissionBaselineConfig | null = null,
): AuthoritativeMissionState {
  const effectiveBaseline =
    authority === 'loading' ? null : (initialBaseline ?? SIMULATED_MISSION_BASELINE);
  const baseShell = createInitialMissionState(webglStatus);
  const shell =
    effectiveBaseline === null
      ? baseShell
      : {
          ...baseShell,
          mission: createInitialSimulatedMissionState(
            baseShell.selectedRouteId,
            effectiveBaseline,
          ),
        };
  return {
    shell,
    configAuthority: authority,
    liveBaseline: effectiveBaseline,
    lockedRunBaseline: null,
    playback: {
      isPlaying: false,
      isPaused: false,
      executionGeneration: 0,
      activeLeg: 'none',
      legProgress01: 0,
      legDurationMs: 0,
      completedTransitionKeys: {},
    },
  };
}

function syncPlaybackForPhase(
  prevPlayback: PlaybackState,
  nextPhase: SimulatedMissionPhase,
  reducedMotion: boolean,
  nextKeys: Readonly<Record<string, true>>,
): PlaybackState {
  switch (nextPhase) {
    case 'planning':
      return {
        ...prevPlayback,
        isPlaying: false,
        isPaused: false,
        activeLeg: 'none',
        legProgress01: 0,
        legDurationMs: 0,
        completedTransitionKeys: nextKeys,
      };
    case 'outbound':
      return {
        ...prevPlayback,
        isPlaying: true,
        isPaused: false,
        activeLeg: 'outbound',
        legProgress01: 0,
        legDurationMs: getLegDurationMs('outbound', reducedMotion),
        completedTransitionKeys: nextKeys,
      };
    case 'observing':
      return {
        ...prevPlayback,
        isPlaying: true,
        isPaused: false,
        activeLeg: 'observing',
        legProgress01: 0,
        legDurationMs: getLegDurationMs('observing', reducedMotion),
        completedTransitionKeys: nextKeys,
      };
    case 'deciding':
      return {
        ...prevPlayback,
        isPlaying: false,
        isPaused: false,
        activeLeg: 'none',
        legProgress01: 1,
        legDurationMs: 0,
        completedTransitionKeys: nextKeys,
      };
    case 'extra_stop':
      return {
        ...prevPlayback,
        isPlaying: true,
        isPaused: false,
        activeLeg: 'extra_stop',
        legProgress01: 0,
        legDurationMs: getLegDurationMs('extra_stop', reducedMotion),
        completedTransitionKeys: nextKeys,
      };
    case 'returning':
      return {
        ...prevPlayback,
        isPlaying: true,
        isPaused: false,
        activeLeg: 'returning',
        legProgress01: 0,
        legDurationMs: getLegDurationMs('returning', reducedMotion),
        completedTransitionKeys: nextKeys,
      };
    case 'completed':
      return {
        ...prevPlayback,
        isPlaying: false,
        isPaused: false,
        activeLeg: 'none',
        legProgress01: 1,
        legDurationMs: 0,
        completedTransitionKeys: nextKeys,
      };
  }
}

function applyGuardedMissionEvent(
  state: AuthoritativeMissionState,
  event: MissionEvent,
  reducedMotion: boolean,
  expectedGeneration?: number,
  expectedPhase?: SimulatedMissionPhase,
): AuthoritativeMissionState {
  if (
    expectedGeneration !== undefined &&
    expectedGeneration !== state.playback.executionGeneration
  ) {
    return state;
  }
  const currentPhase = state.shell.mission.phase;
  if (expectedPhase !== undefined && expectedPhase !== currentPhase) {
    return state;
  }

  if (event.type === 'start_mission' && !canStartMissionRun(state)) {
    return state;
  }

  const key = makeTransitionKey(
    state.playback.executionGeneration,
    currentPhase,
    event,
  );
  if (state.playback.completedTransitionKeys[key]) {
    return state;
  }

  const runBaseline =
    currentPhase === 'planning'
      ? state.liveBaseline ?? SIMULATED_MISSION_BASELINE
      : getAuthoritativeBaseline(state);

  const nextMission = transitionSimulatedMission(
    state.shell.mission,
    event,
    runBaseline,
  );
  if (nextMission === state.shell.mission) {
    return state;
  }

  const nextKeys: Readonly<Record<string, true>> = {
    ...state.playback.completedTransitionKeys,
    [key]: true,
  };

  return {
    ...state,
    shell: {
      ...state.shell,
      selectedRouteId: nextMission.selectedRouteId,
      mission: nextMission,
    },
    lockedRunBaseline:
      currentPhase === 'planning' && nextMission.phase !== 'planning'
        ? runBaseline
        : state.lockedRunBaseline,
    playback: syncPlaybackForPhase(
      state.playback,
      nextMission.phase,
      reducedMotion,
      nextKeys,
    ),
  };
}

function completeCurrentLeg(
  state: AuthoritativeMissionState,
  reducedMotion: boolean,
): AuthoritativeMissionState {
  const phase = state.shell.mission.phase;
  let completionEvent: MissionEvent | null = null;
  if (phase === 'outbound' && state.playback.activeLeg === 'outbound') {
    completionEvent = { type: 'complete_outbound' };
  } else if (phase === 'observing' && state.playback.activeLeg === 'observing') {
    completionEvent = { type: 'complete_observation' };
  } else if (phase === 'extra_stop' && state.playback.activeLeg === 'extra_stop') {
    completionEvent = { type: 'complete_extra_stop' };
  } else if (phase === 'returning' && state.playback.activeLeg === 'returning') {
    completionEvent = { type: 'complete_return' };
  }

  if (!completionEvent) {
    return state;
  }

  return applyGuardedMissionEvent(
    state,
    completionEvent,
    reducedMotion,
    state.playback.executionGeneration,
    phase,
  );
}

export function authoritativeMissionReducer(
  state: AuthoritativeMissionState,
  action: AuthoritativeMissionAction,
): AuthoritativeMissionState {
  switch (action.type) {
    case 'sync_config': {
      const nextLiveBaseline =
        action.authority === 'loading'
          ? null
          : (action.baseline ?? SIMULATED_MISSION_BASELINE);

      // Never touch or mix configuration on an underway or completed run (FIX-01).
      if (state.shell.mission.phase !== 'planning' || state.lockedRunBaseline !== null) {
        return {
          ...state,
          configAuthority: action.authority,
          liveBaseline: nextLiveBaseline,
        };
      }

      const baselineForPlanning = nextLiveBaseline ?? SIMULATED_MISSION_BASELINE;
      const nextShell = missionShellReducer(
        state.shell,
        { type: 'sync_baseline', baseline: baselineForPlanning },
        baselineForPlanning,
      );
      return {
        ...state,
        shell: nextShell,
        configAuthority: action.authority,
        liveBaseline: nextLiveBaseline,
      };
    }

    case 'select_route': {
      const baseline = getAuthoritativeBaseline(state);
      const nextShell = missionShellReducer(
        state.shell,
        { type: 'select_route', routeId: action.routeId, baseline },
        baseline,
      );
      if (nextShell === state.shell) {
        return state;
      }
      return {
        ...state,
        shell: nextShell,
      };
    }

    case 'start_simulation':
      return applyGuardedMissionEvent(
        state,
        { type: 'start_mission' },
        action.reducedMotion,
      );

    case 'toggle_pause': {
      if (!state.playback.isPlaying || state.playback.activeLeg === 'none') {
        return state;
      }
      return {
        ...state,
        playback: {
          ...state.playback,
          isPaused: !state.playback.isPaused,
        },
      };
    }

    case 'playback_tick': {
      if (
        action.expectedGeneration !== state.playback.executionGeneration ||
        action.expectedPhase !== state.shell.mission.phase ||
        !state.playback.isPlaying ||
        state.playback.isPaused ||
        state.playback.activeLeg === 'none'
      ) {
        return state;
      }
      const duration = Math.max(16, state.playback.legDurationMs);
      const delta = Math.max(0, action.dtMs) / duration;
      const nextProgress = state.playback.legProgress01 + delta;
      if (nextProgress < 1) {
        return {
          ...state,
          playback: {
            ...state.playback,
            legProgress01: nextProgress,
          },
        };
      }
      return completeCurrentLeg(state, action.reducedMotion);
    }

    case 'playback_complete_leg':
      return applyGuardedMissionEvent(
        state,
        action.event,
        action.reducedMotion,
        action.expectedGeneration,
        action.expectedPhase,
      );

    case 'choose_branch':
      return applyGuardedMissionEvent(
        state,
        { type: 'choose_branch', branch: action.branch },
        action.reducedMotion,
      );

    case 'mission_event':
      if (action.event.type === 'reset_mission') {
        return authoritativeMissionReducer(state, { type: 'reset_scenario' });
      }
      return applyGuardedMissionEvent(
        state,
        action.event,
        action.reducedMotion ?? false,
      );

    case 'reset_scenario': {
      const baseline = state.liveBaseline ?? SIMULATED_MISSION_BASELINE;
      const nextShell = missionShellReducer(
        state.shell,
        { type: 'reset_scenario', baseline },
        baseline,
      );
      return {
        ...state,
        shell: nextShell,
        lockedRunBaseline: null,
        playback: {
          isPlaying: false,
          isPaused: false,
          executionGeneration: state.playback.executionGeneration + 1,
          activeLeg: 'none',
          legProgress01: 0,
          legDurationMs: 0,
          completedTransitionKeys: {},
        },
      };
    }

    case 'inspect_option':
    case 'orbit_changed':
    case 'reset_camera':
    case 'set_webgl_status': {
      const nextShell = missionShellReducer(
        state.shell,
        action,
        getAuthoritativeBaseline(state),
      );
      if (nextShell === state.shell) {
        return state;
      }
      return {
        ...state,
        shell: nextShell,
      };
    }
  }
}
