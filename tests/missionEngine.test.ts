import { describe, expect, it } from 'vitest';
import {
  createInitialSimulatedMissionState,
  getNextSimulatedStepInfo,
  getSimulatedMissionReserveOutcome,
  transitionSimulatedMission,
  type MissionEvent,
  type SimulatedMissionState,
} from '../src/domain/missionEngine.ts';
import type { RouteId } from '../src/domain/scenario.ts';

function runSequence(
  initial: SimulatedMissionState,
  events: readonly MissionEvent[],
): SimulatedMissionState {
  return events.reduce(
    (acc, event) => transitionSimulatedMission(acc, event),
    initial,
  );
}

function runRoutePrefixToDecision(routeId: RouteId): {
  readonly state: SimulatedMissionState;
  readonly balances: readonly number[];
} {
  let state = createInitialSimulatedMissionState('A');
  if (routeId !== 'A') {
    state = transitionSimulatedMission(state, { type: 'select_route', routeId });
  }
  const balances: number[] = [state.remainingMin];

  state = transitionSimulatedMission(state, { type: 'start_mission' });
  balances.push(state.remainingMin);

  state = transitionSimulatedMission(state, { type: 'complete_outbound' });
  balances.push(state.remainingMin);

  state = transitionSimulatedMission(state, { type: 'complete_observation' });
  balances.push(state.remainingMin);

  return { state, balances };
}

describe('Discrete simulated mission engine (FUNC-01, FUNC-03)', () => {
  it('completes Route A direct branch with exact balances 120 -> 85 -> 65 -> 35 (meets reserve)', () => {
    const { state: deciding, balances } = runRoutePrefixToDecision('A');
    expect(balances).toEqual([120, 120, 85, 65]);
    expect(deciding.phase).toBe('deciding');
    expect(deciding.checkpointAvailableMin).toBe(65);
    expect(deciding.observations).toHaveLength(1);

    const returning = transitionSimulatedMission(deciding, {
      type: 'choose_branch',
      branch: 'direct',
    });
    expect(returning.phase).toBe('returning');
    expect(returning.chosenBranch).toBe('direct');
    expect(returning.remainingMin).toBe(65);

    const completed = transitionSimulatedMission(returning, { type: 'complete_return' });
    expect(completed.phase).toBe('completed');
    expect(completed.consumedMin).toBe(85);
    expect(completed.remainingMin).toBe(35);
    expect(completed.observations).toHaveLength(1);
    expect(getSimulatedMissionReserveOutcome(completed)).toEqual({
      status: 'meets_reserve',
      marginMin: 15,
      deficitMin: 0,
    });
    expect(getNextSimulatedStepInfo(completed)).toBeNull();
  });

  it('completes Route A extra branch with exact balances 120 -> 85 -> 65 -> 50 -> 15 (below reserve, deficit 5)', () => {
    const { state: deciding } = runRoutePrefixToDecision('A');
    const extraStop = transitionSimulatedMission(deciding, {
      type: 'choose_branch',
      branch: 'extra',
    });
    expect(extraStop.phase).toBe('extra_stop');
    expect(extraStop.chosenBranch).toBe('extra');
    expect(extraStop.remainingMin).toBe(65);

    const returning = transitionSimulatedMission(extraStop, {
      type: 'complete_extra_stop',
    });
    expect(returning.phase).toBe('returning');
    expect(returning.remainingMin).toBe(50);
    expect(returning.consumedMin).toBe(70);
    expect(returning.observations).toHaveLength(2);
    expect(returning.observations.every((obs) => obs.simulatedOnly)).toBe(true);

    const completed = transitionSimulatedMission(returning, { type: 'complete_return' });
    expect(completed.phase).toBe('completed');
    expect(completed.consumedMin).toBe(105);
    expect(completed.remainingMin).toBe(15);
    expect(getSimulatedMissionReserveOutcome(completed)).toEqual({
      status: 'below_reserve',
      marginMin: -5,
      deficitMin: 5,
    });
  });

  it('completes Route B direct branch with exact balances 120 -> 75 -> 55 -> 25 (meets reserve)', () => {
    const { state: deciding, balances } = runRoutePrefixToDecision('B');
    expect(balances).toEqual([120, 120, 75, 55]);
    expect(deciding.checkpointAvailableMin).toBe(55);

    const completed = runSequence(deciding, [
      { type: 'choose_branch', branch: 'direct' },
      { type: 'complete_return' },
    ]);
    expect(completed.phase).toBe('completed');
    expect(completed.consumedMin).toBe(95);
    expect(completed.remainingMin).toBe(25);
    expect(getSimulatedMissionReserveOutcome(completed)).toEqual({
      status: 'meets_reserve',
      marginMin: 5,
      deficitMin: 0,
    });
  });

  it('completes Route B extra branch with exact balances 120 -> 75 -> 55 -> 40 -> 5 (below reserve, deficit 15)', () => {
    const { state: deciding } = runRoutePrefixToDecision('B');
    const extraStop = transitionSimulatedMission(deciding, {
      type: 'choose_branch',
      branch: 'extra',
    });
    const returning = transitionSimulatedMission(extraStop, {
      type: 'complete_extra_stop',
    });
    expect(returning.remainingMin).toBe(40);

    const completed = transitionSimulatedMission(returning, { type: 'complete_return' });
    expect(completed.phase).toBe('completed');
    expect(completed.consumedMin).toBe(115);
    expect(completed.remainingMin).toBe(5);
    expect(getSimulatedMissionReserveOutcome(completed)).toEqual({
      status: 'below_reserve',
      marginMin: -15,
      deficitMin: 15,
    });
  });

  it('prevents duplicate event IDs and repeated phase steps without double-debiting', () => {
    let state = createInitialSimulatedMissionState('A');
    state = transitionSimulatedMission(state, {
      type: 'start_mission',
      eventId: 'evt-start-1',
    });
    const duplicateStart = transitionSimulatedMission(state, {
      type: 'start_mission',
      eventId: 'evt-start-1',
    });
    expect(duplicateStart).toBe(state);

    const afterOutbound = transitionSimulatedMission(state, {
      type: 'complete_outbound',
      eventId: 'evt-outbound-1',
    });
    expect(afterOutbound.remainingMin).toBe(85);

    // Same eventId AND repeated implicit step must both be no-ops
    expect(
      transitionSimulatedMission(afterOutbound, {
        type: 'complete_outbound',
        eventId: 'evt-outbound-1',
      }),
    ).toBe(afterOutbound);
    expect(
      transitionSimulatedMission(afterOutbound, {
        type: 'complete_outbound',
      }),
    ).toBe(afterOutbound);
    expect(afterOutbound.remainingMin).toBe(85);
    expect(afterOutbound.consumedMin).toBe(35);

    // Duplicate branch choice must not overwrite or allow double selection
    const atDecision = transitionSimulatedMission(afterOutbound, {
      type: 'complete_observation',
    });
    const chosenDirect = transitionSimulatedMission(atDecision, {
      type: 'choose_branch',
      branch: 'direct',
      eventId: 'evt-choice',
    });
    expect(
      transitionSimulatedMission(chosenDirect, {
        type: 'choose_branch',
        branch: 'extra',
        eventId: 'evt-choice-2',
      }),
    ).toBe(chosenDirect);
    expect(chosenDirect.chosenBranch).toBe('direct');
  });

  it('rejects out-of-order and invalid phase transitions without debits or phase skipping', () => {
    const planning = createInitialSimulatedMissionState('A');
    const invalidFromPlanning: readonly MissionEvent[] = [
      { type: 'complete_outbound' },
      { type: 'complete_observation' },
      { type: 'choose_branch', branch: 'direct' },
      { type: 'complete_extra_stop' },
      { type: 'complete_return' },
    ];
    for (const event of invalidFromPlanning) {
      expect(transitionSimulatedMission(planning, event)).toBe(planning);
    }

    const { state: deciding } = runRoutePrefixToDecision('A');
    expect(transitionSimulatedMission(deciding, { type: 'complete_return' })).toBe(
      deciding,
    );
    expect(transitionSimulatedMission(deciding, { type: 'complete_extra_stop' })).toBe(
      deciding,
    );

    const directReturning = transitionSimulatedMission(deciding, {
      type: 'choose_branch',
      branch: 'direct',
    });
    expect(
      transitionSimulatedMission(directReturning, { type: 'complete_extra_stop' }),
    ).toBe(directReturning);
  });

  it('allows route changes only in planning and fully restores initial Route A state on reset', () => {
    let state = createInitialSimulatedMissionState('A');
    state = transitionSimulatedMission(state, { type: 'select_route', routeId: 'B' });
    state = transitionSimulatedMission(state, { type: 'select_route', routeId: 'A' });
    state = transitionSimulatedMission(state, { type: 'select_route', routeId: 'B' });
    expect(state.selectedRouteId).toBe('B');
    expect(state.remainingMin).toBe(120);

    state = transitionSimulatedMission(state, { type: 'start_mission' });
    expect(
      transitionSimulatedMission(state, { type: 'select_route', routeId: 'A' }),
    ).toBe(state);
    expect(state.selectedRouteId).toBe('B');

    const completedExtra = runSequence(state, [
      { type: 'complete_outbound' },
      { type: 'complete_observation' },
      { type: 'choose_branch', branch: 'extra' },
      { type: 'complete_extra_stop' },
      { type: 'complete_return' },
    ]);
    expect(completedExtra.phase).toBe('completed');
    expect(completedExtra.remainingMin).toBe(5);

    const reset = transitionSimulatedMission(completedExtra, { type: 'reset_mission' });
    expect(reset).toEqual(createInitialSimulatedMissionState('A'));
    expect(reset.phase).toBe('planning');
    expect(reset.remainingMin).toBe(120);
    expect(reset.consumedMin).toBe(0);
    expect(reset.chosenBranch).toBeNull();
    expect(reset.checkpointAvailableMin).toBeNull();
    expect(reset.observations).toEqual([]);
    expect(reset.appliedEvents).toEqual([]);
  });
});
