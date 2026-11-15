import { type DecisionOptionId } from './autonomy.ts';
import {
  DEFAULT_ROUTE_ID,
  SIMULATED_MISSION_BASELINE,
  type RouteId,
} from './scenario.ts';

export type MissionBaselineConfig = typeof SIMULATED_MISSION_BASELINE;

export type SimulatedMissionPhase =
  | 'planning'
  | 'outbound'
  | 'observing'
  | 'deciding'
  | 'extra_stop'
  | 'returning'
  | 'completed';

export type MissionEventType =
  | 'select_route'
  | 'start_mission'
  | 'complete_outbound'
  | 'complete_observation'
  | 'choose_branch'
  | 'complete_extra_stop'
  | 'complete_return'
  | 'reset_mission';

export type MissionEvent =
  | { readonly type: 'select_route'; readonly routeId: RouteId; readonly eventId?: string }
  | { readonly type: 'start_mission'; readonly eventId?: string }
  | { readonly type: 'complete_outbound'; readonly eventId?: string }
  | { readonly type: 'complete_observation'; readonly eventId?: string }
  | {
      readonly type: 'choose_branch';
      readonly branch: DecisionOptionId;
      readonly eventId?: string;
    }
  | { readonly type: 'complete_extra_stop'; readonly eventId?: string }
  | { readonly type: 'complete_return'; readonly eventId?: string }
  | { readonly type: 'reset_mission'; readonly eventId?: string };

export interface AppliedMissionEvent {
  readonly eventId: string;
  readonly type: MissionEventType;
  readonly fromPhase: SimulatedMissionPhase;
  readonly toPhase: SimulatedMissionPhase;
  readonly costMin: number;
  readonly remainingAfterMin: number;
  readonly summary: string;
}

export interface SimulatedObservationRecord {
  readonly id: string;
  readonly phase: 'observing' | 'extra_stop';
  readonly title: string;
  readonly note: string;
  readonly durationMin: number;
  readonly simulatedOnly: true;
}

export interface SimulatedMissionState {
  readonly selectedRouteId: RouteId;
  readonly phase: SimulatedMissionPhase;
  readonly initialBudgetMin: number;
  readonly reserveMin: number;
  readonly consumedMin: number;
  readonly remainingMin: number;
  readonly chosenBranch: DecisionOptionId | null;
  readonly checkpointAvailableMin: number | null;
  readonly observations: readonly SimulatedObservationRecord[];
  readonly appliedEvents: readonly AppliedMissionEvent[];
}

export interface SimulatedMissionReserveOutcome {
  readonly status: 'pending' | 'meets_reserve' | 'below_reserve';
  readonly marginMin: number;
  readonly deficitMin: number;
}

export interface NextSimulatedStepInfo {
  readonly event: Exclude<MissionEvent, { type: 'select_route' | 'choose_branch' | 'reset_mission' }>;
  readonly label: string;
  readonly costMin: number;
}

export interface SimulatedPhaseMeta {
  readonly label: string;
  readonly stepCaption: string;
  readonly guidance: string;
}

interface PhaseTransitionResult {
  readonly nextPhase: SimulatedMissionPhase;
  readonly costMin: number;
  readonly chosenBranch?: DecisionOptionId | null;
  readonly checkpointAvailableMin?: number | null;
  readonly observation?: SimulatedObservationRecord;
  readonly summary: string;
}

/**
 * Creates a fresh discrete simulation state on the selected baseline route.
 * Pure time/phase budgeting only; geographic DEM and sensor telemetry remain pending.
 */
export function createInitialSimulatedMissionState(
  routeId: RouteId = DEFAULT_ROUTE_ID,
  baseline: MissionBaselineConfig = SIMULATED_MISSION_BASELINE,
): SimulatedMissionState {
  return {
    selectedRouteId: routeId,
    phase: 'planning',
    initialBudgetMin: baseline.initialBudgetMin,
    reserveMin: baseline.reserveMin,
    consumedMin: 0,
    remainingMin: baseline.initialBudgetMin,
    chosenBranch: null,
    checkpointAvailableMin: null,
    observations: [],
    appliedEvents: [],
  };
}

function hasAppliedEventId(
  state: SimulatedMissionState,
  eventId: string | undefined,
): boolean {
  if (!eventId) {
    return false;
  }
  return state.appliedEvents.some((entry) => entry.eventId === eventId);
}

function resolveEventId(event: MissionEvent): string | null {
  if (event.eventId) {
    return event.eventId;
  }
  if (event.type === 'select_route' || event.type === 'reset_mission') {
    return null;
  }
  return `phase:${event.type}`;
}

function resolvePhaseTransition(
  state: SimulatedMissionState,
  event: Exclude<MissionEvent, { type: 'select_route' | 'reset_mission' }>,
  baseline: MissionBaselineConfig,
): PhaseTransitionResult | null {
  const route = baseline.routes[state.selectedRouteId];

  switch (event.type) {
    case 'start_mission':
      if (state.phase !== 'planning') {
        return null;
      }
      return {
        nextPhase: 'outbound',
        costMin: 0,
        summary: `Inicio de simulación en ${route.code} (${state.initialBudgetMin} min iniciales).`,
      };

    case 'complete_outbound':
      if (state.phase !== 'outbound') {
        return null;
      }
      return {
        nextPhase: 'observing',
        costMin: route.outboundMin,
        summary: `Ida simulada en ${route.code} completada (-${route.outboundMin} min).`,
      };

    case 'complete_observation':
      if (state.phase !== 'observing') {
        return null;
      }
      return {
        nextPhase: 'deciding',
        costMin: route.primaryObservationMin,
        checkpointAvailableMin: state.remainingMin - route.primaryObservationMin,
        observation: {
          id: `${route.id}-primary-observation`,
          phase: 'observing',
          title: `Observación principal simulada (${route.code})`,
          note: 'Registro cronológico simulado; el contexto geomorfológico y térmico real sigue pendiente.',
          durationMin: route.primaryObservationMin,
          simulatedOnly: true,
        },
        summary: `Observación principal completada (-${route.primaryObservationMin} min). Punto de decisión alcanzado.`,
      };

    case 'choose_branch':
      if (state.phase !== 'deciding') {
        return null;
      }
      if (event.branch === 'direct') {
        return {
          nextPhase: 'returning',
          costMin: 0,
          chosenBranch: 'direct',
          summary: `Decisión registrada: Regreso directo hacia base (${route.directReturnMin} min estimados).`,
        };
      }
      return {
        nextPhase: 'extra_stop',
        costMin: 0,
        chosenBranch: 'extra',
        summary: `Decisión registrada: ${baseline.extraStop.label} (+${baseline.extraStop.accessAndObservationMin} min + ${baseline.extraStop.returnToBaseMin} min regreso).`,
      };

    case 'complete_extra_stop':
      if (state.phase !== 'extra_stop' || state.chosenBranch !== 'extra') {
        return null;
      }
      return {
        nextPhase: 'returning',
        costMin: baseline.extraStop.accessAndObservationMin,
        observation: {
          id: `${route.id}-extra-stop`,
          phase: 'extra_stop',
          title: `${baseline.extraStop.label} (${route.code})`,
          note: 'Parada simulada completada; fotografía Hazcam y contexto ambiental real siguen pendientes.',
          durationMin: baseline.extraStop.accessAndObservationMin,
          simulatedOnly: true,
        },
        summary: `Parada extra simulada completada (-${baseline.extraStop.accessAndObservationMin} min).`,
      };

    case 'complete_return': {
      if (state.phase !== 'returning' || state.chosenBranch === null) {
        return null;
      }
      const returnCostMin =
        state.chosenBranch === 'extra'
          ? baseline.extraStop.returnToBaseMin
          : route.directReturnMin;
      return {
        nextPhase: 'completed',
        costMin: returnCostMin,
        summary:
          state.chosenBranch === 'extra'
            ? `Regreso tras parada extra completado (-${returnCostMin} min).`
            : `Regreso directo a base completado (-${returnCostMin} min).`,
      };
    }
  }
}

/**
 * Pure discrete state-machine transition for the simulated EVA mission.
 * Ignores duplicate event IDs and invalid or out-of-order phase transitions with zero debit.
 */
export function transitionSimulatedMission(
  state: SimulatedMissionState,
  event: MissionEvent,
  baseline: MissionBaselineConfig = SIMULATED_MISSION_BASELINE,
): SimulatedMissionState {
  if (event.type === 'reset_mission') {
    return createInitialSimulatedMissionState(DEFAULT_ROUTE_ID, baseline);
  }

  if (hasAppliedEventId(state, event.eventId)) {
    return state;
  }

  if (event.type === 'select_route') {
    if (state.phase !== 'planning' || state.selectedRouteId === event.routeId) {
      return state;
    }
    const route = baseline.routes[event.routeId];
    const nextApplied =
      event.eventId === undefined
        ? state.appliedEvents
        : [
            ...state.appliedEvents,
            {
              eventId: event.eventId,
              type: 'select_route' as const,
              fromPhase: state.phase,
              toPhase: state.phase,
              costMin: 0,
              remainingAfterMin: state.remainingMin,
              summary: `Trayecto planificado actualizado a ${route.code}.`,
            },
          ];
    return {
      ...state,
      selectedRouteId: event.routeId,
      appliedEvents: nextApplied,
    };
  }

  const resolvedId = resolveEventId(event);
  if (resolvedId && hasAppliedEventId(state, resolvedId)) {
    return state;
  }

  const transition = resolvePhaseTransition(state, event, baseline);
  if (!transition) {
    return state;
  }

  const nextConsumedMin = state.consumedMin + transition.costMin;
  const nextRemainingMin = state.remainingMin - transition.costMin;
  const nextObservations = transition.observation
    ? [...state.observations, transition.observation]
    : state.observations;
  const nextAppliedEvents: readonly AppliedMissionEvent[] = resolvedId
    ? [
        ...state.appliedEvents,
        {
          eventId: resolvedId,
          type: event.type,
          fromPhase: state.phase,
          toPhase: transition.nextPhase,
          costMin: transition.costMin,
          remainingAfterMin: nextRemainingMin,
          summary: transition.summary,
        },
      ]
    : state.appliedEvents;

  return {
    ...state,
    phase: transition.nextPhase,
    consumedMin: nextConsumedMin,
    remainingMin: nextRemainingMin,
    chosenBranch:
      transition.chosenBranch !== undefined ? transition.chosenBranch : state.chosenBranch,
    checkpointAvailableMin:
      transition.checkpointAvailableMin !== undefined
        ? transition.checkpointAvailableMin
        : state.checkpointAvailableMin,
    observations: nextObservations,
    appliedEvents: nextAppliedEvents,
  };
}

/**
 * Evaluates whether the simulated remaining balance meets the 20-minute safety reserve.
 */
export function getSimulatedMissionReserveOutcome(
  state: SimulatedMissionState,
): SimulatedMissionReserveOutcome {
  const marginMin = state.remainingMin - state.reserveMin;
  const deficitMin = Math.max(0, state.reserveMin - state.remainingMin);

  if (state.phase !== 'completed') {
    return { status: 'pending', marginMin, deficitMin };
  }

  return {
    status: state.remainingMin >= state.reserveMin ? 'meets_reserve' : 'below_reserve',
    marginMin,
    deficitMin,
  };
}

/**
 * Returns the next deterministic progression action for phases that advance linearly.
 * Returns null in `deciding` (requires explicit branch choice) and `completed`.
 */
export function getNextSimulatedStepInfo(
  state: SimulatedMissionState,
  baseline: MissionBaselineConfig = SIMULATED_MISSION_BASELINE,
): NextSimulatedStepInfo | null {
  const route = baseline.routes[state.selectedRouteId];

  switch (state.phase) {
    case 'planning':
      return {
        event: { type: 'start_mission' },
        label: 'Iniciar simulación',
        costMin: 0,
      };
    case 'outbound':
      return {
        event: { type: 'complete_outbound' },
        label: `Completar ida (${route.code})`,
        costMin: route.outboundMin,
      };
    case 'observing':
      return {
        event: { type: 'complete_observation' },
        label: 'Completar observación principal',
        costMin: route.primaryObservationMin,
      };
    case 'extra_stop':
      return {
        event: { type: 'complete_extra_stop' },
        label: 'Completar parada extra',
        costMin: baseline.extraStop.accessAndObservationMin,
      };
    case 'returning': {
      const costMin =
        state.chosenBranch === 'extra'
          ? baseline.extraStop.returnToBaseMin
          : route.directReturnMin;
      return {
        event: { type: 'complete_return' },
        label:
          state.chosenBranch === 'extra'
            ? 'Completar regreso tras parada extra'
            : 'Completar regreso directo',
        costMin,
      };
    }
    case 'deciding':
    case 'completed':
      return null;
  }
}

export function getMissionPhaseMeta(phase: SimulatedMissionPhase): SimulatedPhaseMeta {
  switch (phase) {
    case 'planning':
      return {
        label: 'Planificación previa',
        stepCaption: 'Antes de salir · trayecto editable',
        guidance:
          'Elige Ruta A o Ruta B y pulsa Iniciar simulación para recorrer la línea temporal discreta.',
      };
    case 'outbound':
      return {
        label: 'Trayecto de ida',
        stepCaption: 'Fase 1 · ida simulada',
        guidance:
          'Esperar o inspeccionar la vista orbital consume 0 min; avanza manualmente al completar la ida.',
      };
    case 'observing':
      return {
        label: 'Observación principal',
        stepCaption: 'Fase 2 · estación principal',
        guidance:
          'Completa la ventana fija de observación (20 min) para alcanzar el punto de decisión.',
      };
    case 'deciding':
      return {
        label: 'Punto de decisión',
        stepCaption: 'Fase 3 · bifurcación activa',
        guidance:
          'Elige Regreso directo o Parada extra simulada; ninguna opción se impone automáticamente.',
      };
    case 'extra_stop':
      return {
        label: 'Parada extra simulada',
        stepCaption: 'Fase 4A · desvío adicional',
        guidance:
          'Trayecto adicional activo (+15 min). Completa la parada antes de iniciar el regreso.',
      };
    case 'returning':
      return {
        label: 'Regreso a base',
        stepCaption: 'Fase 4B · retorno simulado',
        guidance:
          'Completa el tramo de retorno seleccionado para cerrar el balance final frente a la reserva.',
      };
    case 'completed':
      return {
        label: 'Simulación completada',
        stepCaption: 'Cierre de balance simulado',
        guidance:
          'Ciclo cerrado con parámetros simulados. Usa Reiniciar a Ruta A para evaluar otra rama.',
      };
  }
}
