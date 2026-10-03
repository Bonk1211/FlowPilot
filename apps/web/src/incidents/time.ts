export function displayTime(value?: string | null) {
  if (!value) return "Event time unavailable";
  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(value)) return `${value} (offset unknown)`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      });
}
