import { describe, expect, it } from 'vitest';
import {
  createInitialMissionState,
  missionShellReducer,
} from '../src/app/missionState.ts';
import {
  createPendingDataPort,
  DATA_LAYER_ORDER,
  isLayerReady,
} from '../src/data/dataSeam.ts';
import { createInitialSimulatedMissionState } from '../src/domain/missionEngine.ts';

describe('Mission shell reducer and reset behavior (APP-04 & F001)', () => {
  it('initializes with Route A projection, planning mission phase and clean state', () => {
    const initial = createInitialMissionState('ready');
    expect(initial).toEqual({
      selectedRouteId: 'A',
      mission: createInitialSimulatedMissionState('A'),
      inspectedOptionId: null,
      cameraResetCount: 0,
      hasOrbitedView: false,
      webglStatus: 'ready',
    });
  });

  it('switches between Route A and B without altering unrelated view state', () => {
    let state = createInitialMissionState('ready');
    state = missionShellReducer(state, { type: 'select_route', routeId: 'B' });
    expect(state.selectedRouteId).toBe('B');
    expect(state.mission.selectedRouteId).toBe('B');
    expect(state.cameraResetCount).toBe(0);

    state = missionShellReducer(state, { type: 'inspect_option', optionId: 'extra' });
    expect(state.inspectedOptionId).toBe('extra');

    // Clicking the same inspected option toggles it off
    state = missionShellReducer(state, { type: 'inspect_option', optionId: 'extra' });
    expect(state.inspectedOptionId).toBeNull();
  });

  it('locks route selection while simulation is underway and resets simulation + camera together', () => {
    let state = createInitialMissionState('ready');
    state = missionShellReducer(state, { type: 'select_route', routeId: 'B' });
    state = missionShellReducer(state, {
      type: 'mission_event',
      event: { type: 'start_mission' },
    });
    expect(state.mission.phase).toBe('outbound');

    // Selecting Route A mid-run must be ignored cleanly
    const blockedSwitch = missionShellReducer(state, {
      type: 'select_route',
      routeId: 'A',
    });
    expect(blockedSwitch).toBe(state);
    expect(blockedSwitch.selectedRouteId).toBe('B');

    // Advance to completed extra branch on Route B -> remaining 5 min
    state = missionShellReducer(state, {
      type: 'mission_event',
      event: { type: 'complete_outbound' },
    });
    state = missionShellReducer(state, {
      type: 'mission_event',
      event: { type: 'complete_observation' },
    });
    state = missionShellReducer(state, {
      type: 'mission_event',
      event: { type: 'choose_branch', branch: 'extra' },
    });
    state = missionShellReducer(state, {
      type: 'mission_event',
      event: { type: 'complete_extra_stop' },
    });
    state = missionShellReducer(state, {
      type: 'mission_event',
      event: { type: 'complete_return' },
    });
    expect(state.mission.phase).toBe('completed');
    expect(state.mission.remainingMin).toBe(5);

    state = missionShellReducer(state, { type: 'inspect_option', optionId: 'extra' });
    state = missionShellReducer(state, { type: 'orbit_changed' });
    state = missionShellReducer(state, { type: 'reset_scenario' });

    expect(state.selectedRouteId).toBe('A');
    expect(state.inspectedOptionId).toBeNull();
    expect(state.hasOrbitedView).toBe(false);
    expect(state.cameraResetCount).toBe(1);
    expect(state.mission).toEqual(createInitialSimulatedMissionState('A'));
  });

  it('tracks camera orbit and resets view independently or via full scenario reset back to Route A', () => {
    let state = createInitialMissionState('ready');
    state = missionShellReducer(state, { type: 'select_route', routeId: 'B' });
    state = missionShellReducer(state, { type: 'inspect_option', optionId: 'direct' });
    state = missionShellReducer(state, { type: 'orbit_changed' });
    expect(state.hasOrbitedView).toBe(true);

    state = missionShellReducer(state, { type: 'reset_camera' });
    expect(state.hasOrbitedView).toBe(false);
    expect(state.cameraResetCount).toBe(1);
    expect(state.selectedRouteId).toBe('B');

    state = missionShellReducer(state, { type: 'orbit_changed' });
    state = missionShellReducer(state, { type: 'reset_scenario' });
    expect(state.selectedRouteId).toBe('A');
    expect(state.inspectedOptionId).toBeNull();
    expect(state.hasOrbitedView).toBe(false);
    expect(state.cameraResetCount).toBe(2);
  });

  it('handles WebGL unavailability state transitions cleanly', () => {
    let state = createInitialMissionState('unavailable');
    expect(state.webglStatus).toBe('unavailable');
    state = missionShellReducer(state, { type: 'select_route', routeId: 'B' });
    expect(state.selectedRouteId).toBe('B');

    state = missionShellReducer(state, { type: 'set_webgl_status', status: 'ready' });
    expect(state.webglStatus).toBe('ready');
  });
});

describe('Data integration seam defaults honestly to awaiting_contract (APP-06)', () => {
  it('exposes all required and optional slots with null payloads and explicit reasons', () => {
    const port = createPendingDataPort();
    expect(port.integrationStage).toBe('skeleton_awaiting_assets');

    for (const layerId of DATA_LAYER_ORDER) {
      const layer = port.layers[layerId];
      expect(layer.status).toBe('awaiting_contract');
      expect(layer.payload).toBeNull();
      expect(isLayerReady(layer)).toBe(false);
      expect(layer.unavailableReason.length).toBeGreaterThan(15);
    }
  });
});
