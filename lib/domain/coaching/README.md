# Coaching domain

[Hydration rules](../../../docs/hydration.md) · [Notifications](../../../docs/notifications.md)

Deterministic, framework-free calculations own numerical truth. No AI service is used.

| Module                                         | Responsibility                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `expected-intake.ts`                           | IANA-local wake/target instants and linear expected intake                               |
| `hydration-status.ts`                          | Goal reached, meaningful behind/on-track/ahead using `max(100 ml, 5% of goal)` tolerance |
| `pace-recommendation.ts`                       | None/half/full recommendation using the normal bottle fill                               |
| `coaching.ts`, `catch-up.ts`, `checkpoints.ts` | Combined coaching state, remaining rate and checkpoints                                  |
| `message.ts`                                   | Copy selection from numerical results                                                    |
| `pace-reminder.ts`                             | Bounded intensity, eligibility, suppression and next reminder estimate                   |

Today, physical-device status and notifications share these functions. Keep status
mapping at the transport boundary (for example `on-track` to firmware `on_track`).
Changing message copy must not create a second threshold or cadence implementation.
Tests should pass an explicit clock and cover local-date/DST behavior and threshold
boundaries. Read the notification guide for current policy; historical incident
reports may describe superseded cadence.
