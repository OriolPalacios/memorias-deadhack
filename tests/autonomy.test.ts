import { describe, expect, it } from 'vitest';
import {
  computeCheckpointAvailableMin,
  evaluateAutonomyDecision,
  evaluateOptionAutonomy,
  sumPendingCostMin,
} from '../src/domain/autonomy.ts';
import {
  buildRouteProjection,
  DEFAULT_ROUTE_ID,
  SIMULATED_MISSION_BASELINE,
} from '../src/domain/scenario.ts';

describe('Simulated route scenarios from single constant source (APP-04)', () => {
  it('computes Route A reference projection: 120 initial -> 65 checkpoint -> 15 extra vs 35 direct', () => {
    const proj = buildRouteProjection('A', SIMULATED_MISSION_BASELINE);

    expect(proj.initialBudgetMin).toBe(120);
    expect(proj.reserveMin).toBe(20);
    expect(proj.consumedBeforeDecisionMin).toBe(55); // 35 + 20
    expect(proj.availableAtCheckpointMin).toBe(65);
    expect(proj.mainRouteTotalMin).toBe(85); // 35 + 20 + 30
    expect(proj.extraPendingCostMin).toBe(50); // 15 + 35
    expect(proj.directPendingCostMin).toBe(30);

    expect(proj.evaluation.options.extra).toMatchObject({
      id: 'extra',
      projectedAtBaseMin: 15,
      reserveDeltaMin: -5,
      reserveDeficitMin: 5,
      budgetDeficitMin: 0,
      status: 'below_reserve',
      atReserveLimit: false,
    });
    expect(proj.evaluation.options.direct).toMatchObject({
      id: 'direct',
      projectedAtBaseMin: 35,
      reserveDeltaMin: 15,
      reserveDeficitMin: 0,
      budgetDeficitMin: 0,
      status: 'meets_reserve',
      atReserveLimit: false,
    });
    expect(proj.evaluation.recommendedOptionId).toBe('direct');
    expect(proj.evaluation.reasonCode).toBe('direct_meets_reserve');
    expect(proj.evaluation.hasUncertainty).toBe(false);
  });

  it('computes Route B projection: 120 initial -> 55 checkpoint -> 5 extra vs 25 direct', () => {
    const proj = buildRouteProjection('B', SIMULATED_MISSION_BASELINE);

    expect(proj.consumedBeforeDecisionMin).toBe(65); // 45 + 20
    expect(proj.availableAtCheckpointMin).toBe(55);
    expect(proj.mainRouteTotalMin).toBe(95); // 45 + 20 + 30
    expect(proj.evaluation.options.extra).toMatchObject({
      projectedAtBaseMin: 5,
      reserveDeltaMin: -15,
      reserveDeficitMin: 15,
      budgetDeficitMin: 0,
      status: 'below_reserve',
    });
    expect(proj.evaluation.options.direct).toMatchObject({
      projectedAtBaseMin: 25,
      reserveDeltaMin: 5,
      reserveDeficitMin: 0,
      budgetDeficitMin: 0,
      status: 'meets_reserve',
    });
    expect(proj.evaluation.recommendedOptionId).toBe('direct');
    expect(proj.evaluation.reasonCode).toBe('direct_meets_reserve');
  });

  it('uses Route A as default baseline route', () => {
    expect(DEFAULT_ROUTE_ID).toBe('A');
  });
});

describe('Autonomy evaluation boundaries, deficits, and precedence (APP-05)', () => {
  it('treats exact equality with reserve as meets_reserve and marks atReserveLimit', () => {
    const result = evaluateAutonomyDecision({
      availableAtCheckpointMin: 50,
      reserveMin: 20,
      extraPendingCostMin: 30, // 50 - 30 = 20 === 20
      directPendingCostMin: 31, // 50 - 31 = 19 < 20
    });

    expect(result.options.extra).toMatchObject({
      projectedAtBaseMin: 20,
      reserveDeltaMin: 0,
      reserveDeficitMin: 0,
      budgetDeficitMin: 0,
      status: 'meets_reserve',
      atReserveLimit: true,
    });
    expect(result.options.direct).toMatchObject({
      projectedAtBaseMin: 19,
      reserveDeltaMin: -1,
      reserveDeficitMin: 1,
      budgetDeficitMin: 0,
      status: 'below_reserve',
      atReserveLimit: false,
    });
    expect(result.recommendedOptionId).toBe('extra');
    expect(result.reasonCode).toBe('extra_meets_reserve');
  });

  it('classifies exact 0 predicted at base as exhausted with budgetDeficit 0 and reserveDeficit equal to reserve', () => {
    const evalZero = evaluateOptionAutonomy('extra', 50, 20, 50);
    expect(evalZero).toMatchObject({
      projectedAtBaseMin: 0,
      reserveDeltaMin: -20,
      reserveDeficitMin: 20,
      budgetDeficitMin: 0,
      status: 'exhausted',
      atReserveLimit: false,
    });
  });

  it('preserves negative predictions and computes distinct budget and reserve deficits', () => {
    // QA-06: available 65, cost 70, reserve 20 => predicted -5, delta -25, budgetDeficit 5, reserveDeficit 25
    const evalNeg = evaluateOptionAutonomy('extra', 65, 20, 70);
    expect(evalNeg).toMatchObject({
      projectedAtBaseMin: -5,
      reserveDeltaMin: -25,
      reserveDeficitMin: 25,
      budgetDeficitMin: 5,
      status: 'exhausted',
      atReserveLimit: false,
    });
  });

  it('returns null recommendation with reserve_unmet when both options are known and below reserve (never picks lesser deficit)', () => {
    const result = evaluateAutonomyDecision({
      availableAtCheckpointMin: 50,
      reserveMin: 20,
      extraPendingCostMin: 31, // 19 predicted
      directPendingCostMin: 32, // 18 predicted
    });

    expect(result.options.extra.status).toBe('below_reserve');
    expect(result.options.direct.status).toBe('below_reserve');
    expect(result.recommendedOptionId).toBeNull();
    expect(result.reasonCode).toBe('reserve_unmet');
    expect(result.hasUncertainty).toBe(false);
  });

  it('applies Priority 1 precedence: recommends extra when extra meets reserve even if direct costs more or is unknown', () => {
    // QA-12: available 65, reserve 20, direct 50 (proj 15), extra 35 (proj 30) -> extra
    const bothKnown = evaluateAutonomyDecision({
      availableAtCheckpointMin: 65,
      reserveMin: 20,
      extraPendingCostMin: 35,
      directPendingCostMin: 50,
    });
    expect(bothKnown.recommendedOptionId).toBe('extra');
    expect(bothKnown.reasonCode).toBe('extra_meets_reserve');
    expect(bothKnown.options.extra.projectedAtBaseMin).toBe(30);
    expect(bothKnown.options.direct.projectedAtBaseMin).toBe(15);

    // extra valid & meets reserve, direct unknown/invalid -> extra recommended, direct stays unknown/null
    const directUnknown = evaluateAutonomyDecision({
      availableAtCheckpointMin: 65,
      reserveMin: 20,
      extraPendingCostMin: 35,
      directPendingCostMin: undefined,
    });
    expect(directUnknown.recommendedOptionId).toBe('extra');
    expect(directUnknown.reasonCode).toBe('extra_meets_reserve');
    expect(directUnknown.hasUncertainty).toBe(true);
    expect(directUnknown.options.direct).toMatchObject({
      status: 'unknown',
      pendingCostMin: null,
      projectedAtBaseMin: null,
      reserveDeltaMin: null,
      reserveDeficitMin: null,
      budgetDeficitMin: null,
      invalidReason: 'missing_cost',
    });
  });

  it('recommends direct with uncertainty flag when direct meets reserve and extra is unknown', () => {
    const result = evaluateAutonomyDecision({
      availableAtCheckpointMin: 65,
      reserveMin: 20,
      extraPendingCostMin: null,
      directPendingCostMin: 30,
    });

    expect(result.recommendedOptionId).toBe('direct');
    expect(result.reasonCode).toBe('direct_meets_reserve');
    expect(result.hasUncertainty).toBe(true);
    expect(result.options.extra.status).toBe('unknown');
    expect(result.options.extra.projectedAtBaseMin).toBeNull();
    expect(result.options.direct.projectedAtBaseMin).toBe(35);
  });

  it('returns insufficient_data when no known option meets reserve and at least one option is unknown', () => {
    const result = evaluateAutonomyDecision({
      availableAtCheckpointMin: 65,
      reserveMin: 20,
      extraPendingCostMin: null,
      directPendingCostMin: 50, // 15 -> below_reserve
    });

    expect(result.options.extra.status).toBe('unknown');
    expect(result.options.direct.status).toBe('below_reserve');
    expect(result.recommendedOptionId).toBeNull();
    expect(result.reasonCode).toBe('insufficient_data');
    expect(result.hasUncertainty).toBe(true);
  });

  it('rejects non-finite, negative, or zero-reserve invalid inputs without substituting zero', () => {
    const invalidInputs = [
      { available: 65, reserve: 0, extra: 10, direct: 10, expectedReason: 'invalid_reserve' },
      { available: 65, reserve: -5, extra: 10, direct: 10, expectedReason: 'invalid_reserve' },
      { available: 65, reserve: Number.NaN, extra: 10, direct: 10, expectedReason: 'invalid_reserve' },
      { available: Number.POSITIVE_INFINITY, reserve: 20, extra: 10, direct: 10, expectedReason: 'invalid_available' },
      { available: -1, reserve: 20, extra: 10, direct: 10, expectedReason: 'invalid_available' },
      { available: null, reserve: 20, extra: 10, direct: 10, expectedReason: 'missing_available' },
    ] as const;

    for (const c of invalidInputs) {
      const res = evaluateAutonomyDecision({
        availableAtCheckpointMin: c.available,
        reserveMin: c.reserve,
        extraPendingCostMin: c.extra,
        directPendingCostMin: c.direct,
      });
      expect(res.recommendedOptionId).toBeNull();
      expect(res.reasonCode).toBe('insufficient_data');
      expect(res.options.extra.status).toBe('unknown');
      expect(res.options.extra.projectedAtBaseMin).toBeNull();
      expect(res.options.extra.invalidReason).toBe(c.expectedReason);
    }

    const negCost = evaluateOptionAutonomy('extra', 65, 20, -10);
    expect(negCost.status).toBe('unknown');
    expect(negCost.pendingCostMin).toBeNull();
    expect(negCost.projectedAtBaseMin).toBeNull();
    expect(negCost.invalidReason).toBe('invalid_cost');
  });

  it('validates checkpoint available and cost summing helpers cleanly', () => {
    expect(computeCheckpointAvailableMin(120, 55)).toBe(65);
    expect(computeCheckpointAvailableMin(120, 120)).toBe(0);
    expect(computeCheckpointAvailableMin(120, Number.NaN)).toBeNull();
    expect(computeCheckpointAvailableMin(-1, 10)).toBeNull();

    expect(sumPendingCostMin([15, 35])).toBe(50);
    expect(sumPendingCostMin([0, 0])).toBe(0);
    expect(sumPendingCostMin([15, null])).toBeNull();
    expect(sumPendingCostMin([15, -5])).toBeNull();
  });
});
