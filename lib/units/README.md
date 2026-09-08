# Volume units

[Hydration rules](../../docs/hydration.md) · [Implementation](volume.ts)

Persist integer milliliters. `oz` means **US fluid ounces**, with
`millilitersPerUsFluidOunce = 29.5735295625`.

- `toStoredMilliliters`: convert displayed volume, then round to integer ml.
- `toDisplayVolume` / `formatDisplayVolume`: integer ml display or ounces rounded to one decimal.
- `parseVolumeUnit`: accept `ml`/`oz`; current fallback is `oz`.
- `convertDisplayVolume`: presentation conversion; do not use repeated display round trips as stored history.

For example, 700 ml displays as 23.7 oz. API fields explicitly named `*Ml` remain
milliliters even when a response also contains `unit: "oz"`. Validate magnitude
and sign in the relevant input contract; a conversion helper is not authorization
or a complete request validator.
