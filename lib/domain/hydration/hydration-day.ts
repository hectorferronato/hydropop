export function isValidIanaTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function getDateInTimezone(
  timezone: string,
  instant = new Date(),
): string {
  if (!isValidIanaTimezone(timezone)) {
    throw new RangeError("Invalid IANA timezone");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(instant);
  const partValue = (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find((part) => part.type === type)?.value;

    if (!value) {
      throw new Error(`Missing ${type} while formatting hydration date`);
    }

    return value;
  };

  return `${partValue("year")}-${partValue("month")}-${partValue("day")}`;
}
