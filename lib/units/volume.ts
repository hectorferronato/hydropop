export const millilitersPerUsFluidOunce = 29.5735295625;

export type VolumeUnit = "ml" | "oz";

export function isVolumeUnit(value: unknown): value is VolumeUnit {
  return value === "ml" || value === "oz";
}

export function parseVolumeUnit(value: unknown): VolumeUnit {
  return isVolumeUnit(value) ? value : "oz";
}

export function millilitersToOunces(milliliters: number): number {
  return milliliters / millilitersPerUsFluidOunce;
}

export function ouncesToMilliliters(ounces: number): number {
  return ounces * millilitersPerUsFluidOunce;
}

export function toStoredMilliliters(
  displayedVolume: number,
  unit: VolumeUnit,
): number {
  const milliliters =
    unit === "oz" ? ouncesToMilliliters(displayedVolume) : displayedVolume;

  return Math.round(milliliters);
}

export function toDisplayVolume(milliliters: number, unit: VolumeUnit): number {
  if (unit === "ml") {
    return Math.round(milliliters);
  }

  return Math.round(millilitersToOunces(milliliters) * 10) / 10;
}

export function formatDisplayVolume(
  milliliters: number,
  unit: VolumeUnit,
): string {
  return String(toDisplayVolume(milliliters, unit));
}

export function convertDisplayVolume(
  displayedVolume: number,
  from: VolumeUnit,
  to: VolumeUnit,
): number {
  if (from === to) {
    return displayedVolume;
  }

  return toDisplayVolume(toStoredMilliliters(displayedVolume, from), to);
}
