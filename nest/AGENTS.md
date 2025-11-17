# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds Nest modules, controllers (`*.controller.ts`), services (`*.service.ts`), and the bootstrap in `main.ts`. Group new features by domain (e.g., create `devices/` with its module) and wire providers through `AppModule`.
- `prisma/schema.prisma` defines the PostgreSQL schema; add migrations with `npx prisma migrate dev` once changes are staged.
- Tests live beside code as `*.spec.ts` for units and under `test/` for e2e flows (`app.e2e-spec.ts`). Keep fixtures close to the specs that consume them.

## Build, Test, and Development Commands
- `npm install` installs dependencies (Node ≥20, npm ≥10).
- `npm run start:dev` launches the Nest server with reload; set `MODBUS_MOCK=true` when working without PLC hardware.
- `npm run build` compiles to `dist/`; `npm run start:prod` runs the compiled bundle; `npm run start` starts in watchless dev mode.
- `npm run lint` and `npm run format` apply ESLint + Prettier; run both before committing to keep diffs clean.
- `npm run test`, `npm run test:watch`, `npm run test:cov`, and `npm run test:e2e` cover unit, watch, coverage, and e2e scenarios.

## Coding Style & Naming Conventions
- Use TypeScript with 2-space indentation, single quotes, and Nest naming (`feature.module.ts`, `FeatureService`, `feature.controller.ts`).
- Prefer dependency injection via constructors; resolve async flows with `await` to satisfy `@typescript-eslint/no-floating-promises`.
- Let Prettier handle formatting; ESLint runs with `--fix` and treats Prettier violations as errors. Avoid disabling rules without a documented reason.

## Testing Guidelines
- Add unit specs next to the source (`feature.service.spec.ts`) and mock external PLC/Prisma calls.
- Target meaningful coverage (`npm run test:cov`); review HTML output in `coverage/`.
- E2E specs belong in `test/`; seed the database with Prisma fixtures before hitting HTTP flows.

## Commit & Pull Request Guidelines
- Use concise, imperative commit subjects (`Add device control service`) with wrapped bodies (~72 chars) when more detail is needed.
- Reference issue IDs or task links in commit bodies, and squash trivial fixups locally.
- Pull requests should summarize scope, list verification steps (`npm run test`), call out schema updates (link migrations), and include screenshots for API or tooling output when helpful.

## Configuration Notes
- Store env vars in a local `.env` (not committed) and export `DATABASE_URL`, `PLC_PORT`, and `PLC_BAUD_RATE`.
- Run `npx prisma generate` after schema edits so the Nest layer receives updated Prisma types.
