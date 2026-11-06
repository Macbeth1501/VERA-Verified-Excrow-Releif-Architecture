/** "0x6590E3...90F7": enough to recognise an address without a wall of hex. */
export function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Indian Standard Time (UTC+05:30, no daylight saving), formatted by hand rather than with Intl:
 * month abbreviations differ between ICU versions, so an Intl format could render differently on
 * the server and in the browser and cause a hydration mismatch. Machine-readable data (API,
 * exports, database) stays in ISO 8601 UTC.
 */
export function formatIst(iso: string): string {
  const utc = new Date(iso);
  if (Number.isNaN(utc.getTime())) return iso;
  const date = new Date(utc.getTime() + 330 * 60_000);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${two(date.getUTCHours())}:${two(date.getUTCMinutes())} IST`;
}

/** Basis points as a percentage with two decimals: 2600 -> "26.00%". */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}
