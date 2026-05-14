/**
 * scheduling.mjs — Fixed slot scheduling for social media publishing.
 *
 * Replaces the legacy nextSlotISO (Tue/Thu/Sat 16:00 UTC) with platform-and-format
 * specific fixed slots in America/Chicago timezone with automatic DST handling.
 *
 * Approved by Jorge 2026-05-08.
 *
 * Slot inventory:
 *   FB: 3 Posts/day + 2 Reels/day + 1 Video Mon/Wed/Fri/Sun = 5.5/day average
 *   IG: 3 Posts/day + 2 Reels/day + 1 Video Mon/Wed/Fri/Sun = 5.5/day average
 *   Total: 11/day, 13/day on video days, ~77-85/week
 *
 * No external dependencies — uses Intl.DateTimeFormat for timezone math.
 */

const TZ = "America/Chicago";

// Weekday constants (JS Date standard: Sunday=0, Saturday=6).
const SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6;

// Days when Videos are published (Mon/Wed/Fri/Sun).
const VIDEO_DAYS = Object.freeze([MON, WED, FRI, SUN]);

/**
 * FIXED_SLOTS_CST — slots aprobados Jorge 2026-05-08.
 * All times in America/Chicago wall-clock (auto-DST). Order: chronological by hour.
 * `days` array (optional) restricts the slot to specific weekdays.
 */
export const FIXED_SLOTS_CST = Object.freeze([
  // Facebook
  { platform: "FB", format: "Post",  hour:  7, minute:  0 },
  { platform: "FB", format: "Post",  hour: 11, minute: 30 },
  { platform: "FB", format: "Reel",  hour: 12, minute: 30 },
  { platform: "FB", format: "Post",  hour: 17, minute: 50 },
  { platform: "FB", format: "Reel",  hour: 20, minute:  0 },
  { platform: "FB", format: "Video", hour: 21, minute:  0, days: VIDEO_DAYS },
  // Instagram
  { platform: "IG", format: "Post",  hour:  6, minute: 30 },
  { platform: "IG", format: "Post",  hour: 13, minute:  0 },
  { platform: "IG", format: "Reel",  hour: 16, minute:  0 },
  { platform: "IG", format: "Post",  hour: 19, minute:  0 },
  { platform: "IG", format: "Video", hour: 20, minute: 30, days: VIDEO_DAYS },
  { platform: "IG", format: "Reel",  hour: 21, minute:  0 },
]);

/**
 * Returns the offset in hours for America/Chicago at the given UTC date.
 * -6 for CST (winter), -5 for CDT (summer).
 */
export function cstOffsetHours(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    timeZoneName: "short",
  }).formatToParts(date);
  const tz = parts.find(p => p.type === "timeZoneName")?.value || "CST";
  return tz === "CDT" ? -5 : -6;
}

/**
 * Decomposes a UTC Date into America/Chicago wall-clock components.
 * Returns { year, month (1-12), day, hour (0-23), minute, weekday (0=Sun..6=Sat) }.
 */
export function dateInCST(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  const wkdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let hour = parseInt(map.hour, 10);
  if (hour === 24) hour = 0;  // Intl returns "24" for midnight in some locales
  return {
    year:    parseInt(map.year, 10),
    month:   parseInt(map.month, 10),
    day:     parseInt(map.day, 10),
    hour,
    minute:  parseInt(map.minute, 10),
    weekday: wkdays[map.weekday],
  };
}

/**
 * Convert CST wall-clock components to a UTC Date (handles DST automatically).
 * Skipped/ambiguous times during DST transitions resolve to the post-transition value.
 */
export function cstToUtc({ year, month, day, hour, minute }) {
  // First pass: probe a naive UTC at the wall-clock time.
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  // Determine the correct offset for that wall-clock moment in CST.
  const offset = cstOffsetHours(probe);
  // Adjust: actual UTC = wall-clock UTC - offset (offset is negative).
  return new Date(Date.UTC(year, month - 1, day, hour - offset, minute, 0));
}

/**
 * Returns the next future FIXED_SLOTS_CST entry matching platform+format,
 * as a UTC unix timestamp (seconds).
 *
 * @param {"FB"|"IG"} platform
 * @param {"Post"|"Reel"|"Video"} format
 * @param {Date} [now=new Date()] - reference time
 * @returns {number} unix seconds
 */
export function getNextFixedSlot(platform, format, now = new Date()) {
  const nowMs = now.getTime();
  // Search up to 14 days forward to cover Video slots (4 days/week → max 4d gap).
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const probe = new Date(nowMs + dayOffset * 86400000);
    const cstProbe = dateInCST(probe);
    for (const slot of FIXED_SLOTS_CST) {
      if (slot.platform !== platform) continue;
      if (slot.format !== format) continue;
      if (slot.days && !slot.days.includes(cstProbe.weekday)) continue;
      const candidate = cstToUtc({
        year:   cstProbe.year,
        month:  cstProbe.month,
        day:    cstProbe.day,
        hour:   slot.hour,
        minute: slot.minute,
      });
      // Strictly future (1s tolerance to avoid clock-skew false negatives).
      if (candidate.getTime() > nowMs + 1000) {
        return Math.floor(candidate.getTime() / 1000);
      }
    }
  }
  // Fallback: 7 days ahead at noon CST.
  const fallback = new Date(nowMs + 7 * 86400000);
  const cstFallback = dateInCST(fallback);
  const utc = cstToUtc({
    year:   cstFallback.year,
    month:  cstFallback.month,
    day:    cstFallback.day,
    hour:   12,
    minute:  0,
  });
  return Math.floor(utc.getTime() / 1000);
}

/**
 * Total slot count for a given day (for cron schedule planning).
 */
export function slotsCountForDay(date = new Date()) {
  const { weekday } = dateInCST(date);
  return FIXED_SLOTS_CST.filter(s => !s.days || s.days.includes(weekday)).length;
}
