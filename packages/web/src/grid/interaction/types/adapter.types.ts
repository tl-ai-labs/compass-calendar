/**
 * Shared adapter contracts previously duplicated across Week and Day view adapters.
 * This is now the single source of truth for grid interaction types.
 */

import { type GridEvent } from "@web/common/types/web.event.types";
import { type AllDayDragVisual } from "./all-day-drag.types";
import {
  type AllDayResizeEdge,
  type AllDayResizeVisual,
} from "./all-day-resize.types";
import { type TimedDragVisual } from "./timed-drag.types";
import {
  type TimedResizeEdge,
  type TimedResizeVisual,
} from "./timed-resize.types";

export interface GridInteractionPointerOwnership {
  reason: string;
  shouldOwn: boolean;
}

export interface GridAllDayDragTarget<TRegistered> {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: TRegistered;
  type: "allDayDrag";
}

export interface GridAllDayResizeTarget<TRegistered> {
  edge: AllDayResizeEdge;
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: TRegistered;
  type: "allDayResize";
}

export interface GridTimedDragTarget<TRegistered> {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: TRegistered;
  type: "timedDrag";
}

export interface GridTimedResizeTarget<TRegistered> {
  edge: TimedResizeEdge;
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: TRegistered;
  type: "timedResize";
}

export type GridInteractionTarget<TRegistered> =
  | GridAllDayDragTarget<TRegistered>
  | GridAllDayResizeTarget<TRegistered>
  | GridTimedDragTarget<TRegistered>
  | GridTimedResizeTarget<TRegistered>;

export type GridResolvedEventTarget<TRegistered> = {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: TRegistered;
};

export interface GridAllDayDragCommitResult {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: "allDayDragEnd";
}

export interface GridAllDayResizeCommitResult {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: "allDayResizeEnd";
}

export interface GridTimedDragCommitResult {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: "timedDragEnd";
}

export interface GridTimedResizeCommitResult {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: "timedResizeEnd";
}

export type GridInteractionCommitResult =
  | GridAllDayDragCommitResult
  | GridAllDayResizeCommitResult
  | GridTimedDragCommitResult
  | GridTimedResizeCommitResult;

export type GridInteractionVisual<TColumnKey = string> =
  | AllDayDragVisual<TColumnKey>
  | AllDayResizeVisual
  | TimedDragVisual<TColumnKey>
  | TimedResizeVisual;
