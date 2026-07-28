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

type LocalDateTime = {
  date: string;
  time: string;
};

function parseLocalDateTime({ date, time }: LocalDateTime) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/u.exec(time);

  if (!match || !timeMatch) {
    throw new RangeError("Invalid local date or time");
  }

  return {
    day: Number(match[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    month: Number(match[2]),
    second: Number(timeMatch[3] ?? "0"),
    year: Number(match[1]),
  };
}

function timeZoneOffsetMilliseconds(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;

    if (!value) {
      throw new Error(`Missing ${type} while calculating timezone offset`);
    }

    return Number(value);
  };
  const representedAsUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );

  return representedAsUtc - Math.floor(instant.getTime() / 1_000) * 1_000;
}

export function localDateTimeToInstant(
  localDateTime: LocalDateTime,
  timezone: string,
): Date {
  if (!isValidIanaTimezone(timezone)) {
    throw new RangeError("Invalid IANA timezone");
  }

  const parsed = parseLocalDateTime(localDateTime);
  const utcGuess = Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute,
    parsed.second,
  );
  let candidate = new Date(utcGuess);

  for (let iteration = 0; iteration < 4; iteration += 1) {
    candidate = new Date(
      utcGuess - timeZoneOffsetMilliseconds(candidate, timezone),
    );
  }

  return candidate;
}

export function addDaysToDate(date: string, days: number): string {
  const parsed = parseLocalDateTime({ date, time: "00:00" });
  const instant = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day + days),
  );

  return instant.toISOString().slice(0, 10);
}

export function getHydrationDayRange(
  date: string,
  timezone: string,
): { end: Date; start: Date } {
  return {
    end: localDateTimeToInstant(
      { date: addDaysToDate(date, 1), time: "00:00" },
      timezone,
    ),
    start: localDateTimeToInstant({ date, time: "00:00" }, timezone),
  };
}

export function getLocalTimeInTimezone(
  timezone: string,
  instant = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    second: "2-digit",
    timeZone: timezone,
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find((part) => part.type === type)?.value;

    if (!value) {
      throw new Error(`Missing ${type} while formatting local time`);
    }

    return value;
  };

  return `${read("hour")}:${read("minute")}:${read("second")}`;
}
