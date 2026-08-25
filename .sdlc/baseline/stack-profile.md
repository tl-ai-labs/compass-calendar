# Stack profile — learned from repo scan

Built 2026-08-22 from run `20260822-125447-refactor-week-day-interaction`. Sampled `packages/web` (the package under active work). Triggered because the repo's stack (Bun + React + TypeScript) has no matching pre-authored adapter in `plugin/skills/pipeline/stacks/` (we ship `generic`, `nest`, `python`). **This profile is authoritative over any pre-authored adapter fragment on conflict.**

## Language & runtime

TypeScript on **Bun** (`bun@1.3.14`, pinned via `package.json#packageManager`). ESM throughout — no CJS `require` in app code. Type-check runs on a pinned `typescript@7.0.2` via `bunx`, across three projects: root, `packages/web/tsconfig.app.json`, `packages/web/tsconfig.test.json`. Bun workspaces (`packages/*`) alongside a `lerna.json`.

Lint and format are **Biome** (`biome.json`), not ESLint/Prettier. `bun run lint` also runs a custom `check-semantic-colors.ts` guard. Dead-code checks via `knip`.

## Framework

React (function components) + Zustand-style stores (`useDraftStore`) + TanStack Query (`@tanstack/react-query`) and `@tanstack/react-hotkeys`. Dates via a wrapped dayjs at `@core/util/date/dayjs` — **never import `dayjs` directly from node_modules**, always from `@core/util/date/dayjs`.

## Conventions detected

### File naming

Dot-segmented, lowercase-kebab for modules; PascalCase only for React components.

- modules: `week-interaction.adapter.ts`, `day-event.targeting.ts`, `all-day.commit.ts`, `view-event-registry.ts`, `layout.cache.ts`, `interaction.engine.ts`
- types split into a sibling file with a `.types.ts` suffix: `week-interaction.adapter.types.ts`, `timed-drag.types.ts`
- components: `DayInteractionCoordinator.tsx`, `PointerCaptureBoundary.tsx`
- tests sit **next to** the source: `event.registry.test.ts`, `DayInteractionCoordinator.test.tsx`. No `__tests__` dir for unit tests (there is a `src/__tests__/` but only for shared mocks/utils).

Feature folders group by concern, not by type: `interaction/{adapter,commit,targeting,registry,state,geometry}/`. No barrel `index.ts` files — modules are imported by full path.

### Imports

Path aliases, always. `@web/*` → `packages/web/src/*`, `@core/*` → `packages/core/src/*`. Relative imports only within the same directory or to an immediate parent (`./adapter/...`, `../day-interaction.adapter.types`).

Biome sorts imports and requires `import { type X }` inline type qualifiers rather than separate `import type` statements:

```ts
import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs from "@core/util/date/dayjs";
import { type GridLayoutCache } from "@web/grid/interaction/layout.cache";
import {
  createTimedDragVisual,
  updateTimedDragVisual,
} from "@web/grid/interaction/math/timed.drag";
import { type InteractionAdapter } from "@web/interaction/interaction.adapter.types";
```

Note the ordering: `@core` before `@web`, then relative. Named import members are alphabetized, and **object literal keys are alphabetized too** (see the commit-result objects below) — this is a strong repo-wide habit.

### Module shape — factories over classes

There are effectively **no classes**. The dominant pattern is a `create*` factory returning a frozen-ish object of closures, with the shared generic behaviour in `grid/interaction/` and a thin per-view specialization on top.

```ts
export const createViewInteractionRegistry = (viewName: string) => {
  const { idAttribute, typeAttribute } = viewInteractionAttributeNames(viewName);

  const createRegistry = (): ViewEventRegistry =>
    createEventRegistry<ViewInteractionEventType>({ ... });

  return {
    idAttribute,
    typeAttribute,
    createRegistry,
    registry,
    getInteractionTargetAttributes,
    useRegistrationRef,
  };
};
```

Per-view files then become re-export shims — this is the established way the repo de-duplicates:

```ts
const day = createViewInteractionRegistry("day");

export const DAY_INTERACTION_EVENT_ID_ATTRIBUTE = day.idAttribute;
export type DayEventRegistry = ViewEventRegistry;
export const createDayEventRegistry = day.createRegistry;
```

Factories take a **single destructured options object**, not positional args, whenever there is more than one parameter:

```ts
export const createGridEventTargeting = <TType extends string>({
  registry,
  targetSelector,
}: {
  registry: EventRegistry<TType>;
  targetSelector: string;
}) => { ... };
```

### React component shape

`FC<Props>` with a locally-declared `interface Props`, destructured params with defaults hoisted to module-level constants to keep referential identity stable:

```ts
interface Props extends PropsWithChildren {
  allDayEvents?: GridEvent[];
  /** Ordered calendar ids of the rendered per-calendar columns. */
  calendarColumnKeys?: string[];
  dateInView: Dayjs;
  getLayoutSources: () => GridLayoutCacheSources;
  onOpenEvent: (event: GridEvent) => void;
  timedEvents?: GridEvent[];
}

const EMPTY_GRID_EVENTS: GridEvent[] = [];

export const DayInteractionCoordinator: FC<Props> = ({
  allDayEvents = EMPTY_GRID_EVENTS,
  ...
}) => {
```

Props are alphabetized. Optional props marked with `?` and defaulted at the destructure, not via `defaultProps`.

### Test shape

`bun:test`, imported explicitly — there are no globals:

```ts
import { afterEach, describe, expect, it } from "bun:test";
```

`describe` names the unit in lowercase prose (`describe("event registry", ...)`); `it` states the behaviour as a full sentence (`it("drops registrations whose element left the document", ...)`). Setup is via small local helper factories (`const createRegistry = () => ...`, `const addEvent = () => ...`) declared above the `describe`, not `beforeEach` assignment to `let`. DOM cleanup via `afterEach(() => { document.body.innerHTML = ""; })`.

Assertions favour whole-object equality over field-by-field:

```ts
expect(registry.resolveFromTarget(child)).toEqual({
  element,
  eventId: "event-1",
  eventType: "timed",
});
```

Component tests use a shared wrapper at `packages/web/src/__tests__/__mocks__/mock.render.tsx`.

Run with `bun run test:web` (wraps `packages/scripts/src/testing/test-parallel.ts`). Do not invoke `bun test` on a bare path for web — the wrapper sets up the DOM environment.

### Comments

Prose comments explain **why**, especially around non-obvious domain semantics, and are written in full sentences. This is a strong repo norm and worth matching:

```ts
// Delta (not absolute) semantics: multi-day spans are clamped to the
// rendered window, so the initial column date is the clamped visible start,
// not necessarily the event's own start date.
```

JSDoc `/** ... */` is used on exported factories and on non-obvious props/fields.

### Config & data layer

No `.env` files exist in the repo. Constants live in dedicated modules (`@core/constants/date.constants`, `@web/common/constants/web.constants`, `@web/grid/grid.constants`) and are imported as `SCREAMING_SNAKE` names. There is no ORM in `packages/web`; persistence goes through mutation hooks (`useUpdateEvent`) over TanStack Query.

### Domain primitives

Branded types from `@core/types/domain-primitives` (e.g. `CalendarId`). Casts to these are deliberate and commented. Treat a `string` that flows into one of these as load-bearing.

## Sample files inspected

- `packages/web/src/grid/interaction/view-event-registry.ts` (kind: shared factory)
- `packages/web/src/grid/interaction/event.targeting.ts` (kind: shared factory)
- `packages/web/src/grid/interaction/event.registry.test.ts` (kind: test)
- `packages/web/src/views/Day/interaction/registry/day-event.registry.ts` (kind: per-view shim)
- `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts` (kind: adapter)
- `packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts` (kind: commit)
- `packages/web/src/views/Week/interaction/adapter/commit/all-day.commit.ts` (kind: commit)
- `packages/web/src/views/Day/interaction/DayInteractionCoordinator.tsx` (kind: component)
- `packages/web/src/interaction/interaction.adapter.types.ts` (kind: contract)
- `packages/web/tsconfig.json`, `package.json`, `biome.json` (kind: config)

## Notes for downstream codegen

- Alphabetize object literal keys, interface members, and named imports. Biome will not reorder these for you and reviewers notice.
- Use `import { type X }` inline qualifiers, never `import type { X }`.
- Reach for a `create*(options)` factory with closures. Do not introduce a class.
- Put new shared interaction logic in `packages/web/src/grid/interaction/`, not `packages/web/src/interaction/`. The latter is the view-agnostic pointer/engine layer; the former is the calendar-grid layer where Week and Day already converge.
- New types go in a sibling `*.types.ts`, not inline in the implementation file.
- Add the test file next to the source with a `.test.ts(x)` suffix and import `describe/it/expect` from `bun:test`.
- Import dayjs from `@core/util/date/dayjs`, and format dates with the shared `YEAR_MONTH_DAY_FORMAT` constant rather than a literal.
- When a value is semantically a domain id, use the branded type from `@core/types/domain-primitives` rather than `string`.
- After writing, run `bun run lint:fix` then `bun run test:web`; `bun run type-check` is a separate, slower gate.
