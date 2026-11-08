# Contributing

## Getting started

Requires Node 20 or later (developed on Node 22).

```bash
npm ci
npx playwright install chromium
npm run dev
```

Husky installs the git hooks on `npm ci` (via `prepare`). Pre-commit runs lint-staged; pre-push runs the unit tests with coverage.

Useful commands:

| Command                | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Dev server on port 5173 (override with `PORT`) |
| `npm run build`        | Typecheck and production build                 |
| `npm run lint`         | ESLint, zero warnings allowed                  |
| `npm run format:check` | Prettier check                                 |
| `npm run test:ci`      | Unit tests with coverage (80% minimum)         |
| `npm run test:e2e`     | Playwright end-to-end tests                    |

## Definition of Done

- [ ] All acceptance criteria in the issue are met
- [ ] `npx tsc --noEmit`, `npm run lint` and `npm run format:check` pass
- [ ] Unit tests added; `npm run test:ci` passes with coverage thresholds met
- [ ] E2E tests added for user-facing flows; `npm run test:e2e` passes
- [ ] Every new component has a vitest-axe test, and pages are covered by an axe scan in light and dark mode
- [ ] Keyboard-only use works and focus is visible
- [ ] Both light and dark themes look right
- [ ] No new dependencies without a reason in the PR description

## Branch naming

`feat/<issue-number>-<short-slug>`, for example `feat/1-project-scaffolding`. Use `fix/` and `chore/` for other work.

## Pull requests

Fill in the PR template: Why, What changed, Anything surprising, Validation. Link the issue. Commit messages follow `type: Title (#issue)`.

## Code conventions

- TypeScript strict mode, no `any`
- Prettier decides formatting (single quotes, semicolons, 100 columns)
- Function components and hooks; one component per file
- Colors, spacing and radii come from CSS variables in `src/styles/tokens.css`, never hard-coded; see `docs/design-system.md`
- Component styles live next to the component and use the component name as a class prefix

## Testing conventions

- Test behavior through accessible queries (`getByRole`, `getByLabelText`), not class names or internals
- Test names are full sentences describing the expected behavior
- Use the factories and `renderWithProviders` in `src/test-utils`
- No fixed sleeps in E2E tests; rely on Playwright's auto-waiting assertions

## Issue spec layers

Issues are written in layers: acceptance criteria (what), interfaces (shape), and test requirements (proof). Implement every layer; if a layer is wrong or impossible, say so in the PR instead of silently deviating.
