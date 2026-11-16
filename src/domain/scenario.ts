/**
 * Single source of simulated planning constants and route projections (APP-04).
 * All times are explicitly simulated scenario parameters — never derived from
 * 3D mesh geometry, telemetry, or NASA rover measurements.
 */

import {
  computeCheckpointAvailableMin,
  evaluateAutonomyDecision,
  sumPendingCostMin,
  type AutonomyEvaluationResult,
} from './autonomy.ts';

export type RouteId = 'A' | 'B';

export interface SimulatedRouteDefinition {
  readonly id: RouteId;
  readonly code: string;
  readonly name: string;
  readonly purpose: string;
  readonly outboundMin: number;
  readonly primaryObservationMin: number;
  readonly directReturnMin: number;
  readonly geographyStatus: 'pending_real_crop' | 'validated_crop';
}

export interface ExtraStopDefinition {
  readonly id: 'extra';
  readonly label: string;
  readonly accessAndObservationMin: number;
  readonly returnToBaseMin: number;
}

export interface MissionBaselineConstants {
  readonly productName: string;
  readonly missionTitle: string;
  readonly scientificContext: string;
  readonly initialBudgetMin: number;
  readonly reserveMin: number;
  readonly extraStop: ExtraStopDefinition;
  readonly routes: Readonly<Record<RouteId, SimulatedRouteDefinition>>;
}

export const SIMULATED_MISSION_BASELINE: MissionBaselineConstants = {
  productName: 'DeadHack',
  missionTitle: 'Una parada más',
  scientificContext: 'Jezero · parada científica simulada',
  initialBudgetMin: 120,
  reserveMin: 20,
  extraStop: {
    id: 'extra',
    label: 'Parada extra simulada',
    accessAndObservationMin: 15,
    returnToBaseMin: 35,
  },
  routes: {
    A: {
      id: 'A',
      code: 'Ruta A',
      name: 'Trayecto breve simulado',
      purpose:
        'Aproximación directa simulada al objetivo sedimentario con mayor margen restante.',
      outboundMin: 35,
      primaryObservationMin: 20,
      directReturnMin: 30,
      geographyStatus: 'pending_real_crop',
    },
    B: {
      id: 'B',
      code: 'Ruta B',
      name: 'Reconocimiento extendido simulado',
      purpose:
        'Variante didáctica de ida más larga al mismo objetivo (+10 min antes de decidir).',
      outboundMin: 45,
      primaryObservationMin: 20,
      directReturnMin: 30,
      geographyStatus: 'pending_real_crop',
    },
  },
};

export interface RouteProjection {
  readonly route: SimulatedRouteDefinition;
  readonly initialBudgetMin: number;
  readonly reserveMin: number;
  readonly consumedBeforeDecisionMin: number;
  readonly availableAtCheckpointMin: number | null;
  readonly mainRouteTotalMin: number;
  readonly extraAccessAndObsMin: number;
  readonly extraReturnToBaseMin: number;
  readonly extraPendingCostMin: number | null;
  readonly directPendingCostMin: number;
  readonly evaluation: AutonomyEvaluationResult;
}

export const DEFAULT_ROUTE_ID: RouteId = 'A';

export function buildRouteProjection(
  routeId: RouteId,
  baseline: MissionBaselineConstants = SIMULATED_MISSION_BASELINE,
): RouteProjection {
  const route = baseline.routes[routeId];
  const consumedBeforeDecisionMin = route.outboundMin + route.primaryObservationMin;
  const availableAtCheckpointMin = computeCheckpointAvailableMin(
    baseline.initialBudgetMin,
    consumedBeforeDecisionMin,
  );
  const mainRouteTotalMin = consumedBeforeDecisionMin + route.directReturnMin;
  const extraPendingCostMin = sumPendingCostMin([
    baseline.extraStop.accessAndObservationMin,
    baseline.extraStop.returnToBaseMin,
  ]);
  const directPendingCostMin = route.directReturnMin;

  const evaluation = evaluateAutonomyDecision({
    availableAtCheckpointMin,
    reserveMin: baseline.reserveMin,
    extraPendingCostMin,
    directPendingCostMin,
  });

  return {
    route,
    initialBudgetMin: baseline.initialBudgetMin,
    reserveMin: baseline.reserveMin,
    consumedBeforeDecisionMin,
    availableAtCheckpointMin,
    mainRouteTotalMin,
    extraAccessAndObsMin: baseline.extraStop.accessAndObservationMin,
    extraReturnToBaseMin: baseline.extraStop.returnToBaseMin,
    extraPendingCostMin,
    directPendingCostMin,
    evaluation,
  };
}
