# HydroPOP engineering instructions

- Use TypeScript strict mode and avoid `any`.
- Never commit secrets or local environment files.
- Never expose server secrets to the browser. Only variables explicitly prefixed
  with `NEXT_PUBLIC_` may be included in client code.
- Store volumes internally as milliliters.
- Store timestamps in PostgreSQL as `timestamptz`.
- Use each user's IANA timezone for hydration-day calculations.
- Hydration events are immutable.
- Never mutate data through HTTP `GET`.
- Device events require idempotency keys.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` after every
  task.
- Do not add AI, payments, Bluetooth, push notifications, or native apps unless
  explicitly requested.
