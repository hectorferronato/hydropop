# External contracts

[API reference](../../docs/api-reference.md) · [Security](../../docs/security.md)

This directory contains Zod request schemas and typed response shapes. Validate
untrusted input at its boundary; TypeScript types alone do not validate requests.
Use `.strict()` where the contract requires unknown-field rejection, and preserve
backward-compatible defaults deliberately. Existing schemas differ: do not assume
every object is strict without reading its definition.

`api-response.ts` defines the normal session API envelope and safe codes.
`physical-device.ts` defines a separate unwrapped version-1 firmware protocol.
`push-notifications.ts` defines browser subscription/preferences and bounded service-worker payloads.
`change-hydration-recording.ts` separates edit/remove inputs from ordinary capture.

Request names use client-facing casing; adapters translate to SQL argument/column
names. Do not add caller-supplied ownership fields to convenience APIs. Update the
API reference and relevant integration guide when methods, fields, defaults or
response semantics change. Keep examples synthetic and credential-free.
