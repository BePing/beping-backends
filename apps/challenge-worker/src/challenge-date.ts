export function dateInBrussels(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

export function deriveChampionshipDates(sunday: Date): {
  sunday: string;
  monday: string;
  thursday: string;
} {
  return {
    sunday: dateOnly(sunday),
    monday: dateOnly(addUtcDays(sunday, 1)),
    thursday: dateOnly(addUtcDays(sunday, 4)),
  };
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
