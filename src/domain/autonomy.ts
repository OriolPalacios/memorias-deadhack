/**
 * Pure autonomy evaluation and deterministic recommendation module (APP-05).
 * Independent of React, Three.js, DOM APIs, and external producer file schemas.
 */

export type DecisionOptionId = 'extra' | 'direct';

export type OptionAutonomyStatus =
  | 'meets_reserve'
  | 'below_reserve'
  | 'exhausted'
  | 'unknown';

export type RecommendationReasonCode =
  | 'extra_meets_reserve'
  | 'direct_meets_reserve'
  | 'insufficient_data'
  | 'reserve_unmet';

export type InvalidAutonomyReason =
  | 'missing_available'
  | 'invalid_available'
  | 'missing_cost'
  | 'invalid_cost'
  | 'missing_reserve'
  | 'invalid_reserve';

export interface EvaluateDecisionInput {
  availableAtCheckpointMin: number | null | undefined;
  reserveMin: number | null | undefined;
  extraPendingCostMin: number | null | undefined;
  directPendingCostMin: number | null | undefined;
}

export interface OptionEvaluation {
  id: DecisionOptionId;
  pendingCostMin: number | null;
  projectedAtBaseMin: number | null;
  reserveMin: number | null;
  reserveDeltaMin: number | null;
  reserveDeficitMin: number | null;
  budgetDeficitMin: number | null;
  status: OptionAutonomyStatus;
  atReserveLimit: boolean;
  invalidReason: InvalidAutonomyReason | null;
}

export interface AutonomyEvaluationResult {
  availableAtCheckpointMin: number | null;
  reserveMin: number | null;
  options: Record<DecisionOptionId, OptionEvaluation>;
  recommendedOptionId: DecisionOptionId | null;
  reasonCode: RecommendationReasonCode;
  hasUncertainty: boolean;
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

/** Validates finite, non-negative quantities (budgets, costs, consumed time). */
export function isValidNonNegativeMin(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Validates finite, strictly positive reserve thresholds. */
export function isValidPositiveReserveMin(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Computes remaining minutes at a checkpoint from initial budget and consumed time.
 * Returns null if either input is absent or invalid (never substitutes 0).
 */
export function computeCheckpointAvailableMin(
  initialBudgetMin: number | null | undefined,
  consumedMin: number | null | undefined,
): number | null {
  if (!isValidNonNegativeMin(initialBudgetMin) || !isValidNonNegativeMin(consumedMin)) {
    return null;
  }
  return normalizeZero(initialBudgetMin - consumedMin);
}

/**
 * Sums non-negative finite cost components, returning null if any component is missing or invalid.
 */
export function sumPendingCostMin(
  parts: ReadonlyArray<number | null | undefined>,
): number | null {
  let total = 0;
  for (const part of parts) {
    if (!isValidNonNegativeMin(part)) {
      return null;
    }
    total += part;
  }
  return normalizeZero(total);
}

function classifyInvalidReason(
  availableAtCheckpointMin: number | null | undefined,
  reserveMin: number | null | undefined,
  pendingCostMin: number | null | undefined,
): InvalidAutonomyReason | null {
  if (reserveMin === null || reserveMin === undefined) {
    return 'missing_reserve';
  }
  if (!isValidPositiveReserveMin(reserveMin)) {
    return 'invalid_reserve';
  }
  if (availableAtCheckpointMin === null || availableAtCheckpointMin === undefined) {
    return 'missing_available';
  }
  if (!isValidNonNegativeMin(availableAtCheckpointMin)) {
    return 'invalid_available';
  }
  if (pendingCostMin === null || pendingCostMin === undefined) {
    return 'missing_cost';
  }
  if (!isValidNonNegativeMin(pendingCostMin)) {
    return 'invalid_cost';
  }
  return null;
}

/** Evaluates a single decision alternative against checkpoint budget and reserve threshold. */
export function evaluateOptionAutonomy(
  id: DecisionOptionId,
  availableAtCheckpointMin: number | null | undefined,
  reserveMin: number | null | undefined,
  pendingCostMin: number | null | undefined,
): OptionEvaluation {
  const validCost = isValidNonNegativeMin(pendingCostMin)
    ? normalizeZero(pendingCostMin)
    : null;
  const validReserve = isValidPositiveReserveMin(reserveMin)
    ? normalizeZero(reserveMin)
    : null;
  const invalidReason = classifyInvalidReason(
    availableAtCheckpointMin,
    reserveMin,
    pendingCostMin,
  );

  if (
    invalidReason !== null ||
    !isValidNonNegativeMin(availableAtCheckpointMin) ||
    !isValidPositiveReserveMin(reserveMin) ||
    !isValidNonNegativeMin(pendingCostMin)
  ) {
    return {
      id,
      pendingCostMin: validCost,
      projectedAtBaseMin: null,
      reserveMin: validReserve,
      reserveDeltaMin: null,
      reserveDeficitMin: null,
      budgetDeficitMin: null,
      status: 'unknown',
      atReserveLimit: false,
      invalidReason,
    };
  }

  const projectedAtBaseMin = normalizeZero(availableAtCheckpointMin - pendingCostMin);
  const reserveDeltaMin = normalizeZero(projectedAtBaseMin - reserveMin);
  const reserveDeficitMin = normalizeZero(Math.max(0, reserveMin - projectedAtBaseMin));
  const budgetDeficitMin = normalizeZero(Math.max(0, -projectedAtBaseMin));

  let status: OptionAutonomyStatus;
  if (projectedAtBaseMin <= 0) {
    status = 'exhausted';
  } else if (projectedAtBaseMin < reserveMin) {
    status = 'below_reserve';
  } else {
    status = 'meets_reserve';
  }

  return {
    id,
    pendingCostMin: normalizeZero(pendingCostMin),
    projectedAtBaseMin,
    reserveMin: normalizeZero(reserveMin),
    reserveDeltaMin,
    reserveDeficitMin,
    budgetDeficitMin,
    status,
    atReserveLimit: projectedAtBaseMin === reserveMin,
    invalidReason: null,
  };
}

/**
 * Evaluates both alternatives ('extra' and 'direct') and determines the deterministic
 * recommendation using the accepted SPEC 0.3 precedence table:
 * 1. extra meets_reserve => recommend 'extra' ('extra_meets_reserve'), even if direct is unknown
 * 2. direct meets_reserve => recommend 'direct' ('direct_meets_reserve')
 * 3. any option is unknown => null ('insufficient_data')
 * 4. both known below/exhausted => null ('reserve_unmet'), never choosing lesser deficit
 */
export function evaluateAutonomyDecision(
  input: EvaluateDecisionInput,
): AutonomyEvaluationResult {
  const validAvailable = isValidNonNegativeMin(input.availableAtCheckpointMin)
    ? normalizeZero(input.availableAtCheckpointMin)
    : null;
  const validReserve = isValidPositiveReserveMin(input.reserveMin)
    ? normalizeZero(input.reserveMin)
    : null;

  const extra = evaluateOptionAutonomy(
    'extra',
    input.availableAtCheckpointMin,
    input.reserveMin,
    input.extraPendingCostMin,
  );
  const direct = evaluateOptionAutonomy(
    'direct',
    input.availableAtCheckpointMin,
    input.reserveMin,
    input.directPendingCostMin,
  );

  let recommendedOptionId: DecisionOptionId | null;
  let reasonCode: RecommendationReasonCode;

  if (extra.status === 'meets_reserve') {
    recommendedOptionId = 'extra';
    reasonCode = 'extra_meets_reserve';
  } else if (direct.status === 'meets_reserve') {
    recommendedOptionId = 'direct';
    reasonCode = 'direct_meets_reserve';
  } else if (extra.status === 'unknown' || direct.status === 'unknown') {
    recommendedOptionId = null;
    reasonCode = 'insufficient_data';
  } else {
    recommendedOptionId = null;
    reasonCode = 'reserve_unmet';
  }

  return {
    availableAtCheckpointMin: validAvailable,
    reserveMin: validReserve,
    options: { extra, direct },
    recommendedOptionId,
    reasonCode,
    hasUncertainty: extra.status === 'unknown' || direct.status === 'unknown',
  };
}
