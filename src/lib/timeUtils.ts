/**
 * Time utility functions for 12-hour time validation, formatting, and ISO conversion.
 */

export interface Time12Hour {
  hour: string; // "01" - "12"
  minute: string; // "00" - "59"
  period: "AM" | "PM";
}

/**
 * Strict regex for 12-hour format: "HH:MM AM/PM"
 */
const TIME_12HR_REGEX = /^(0[1-9]|1[0-2]):([0-5][0-9])\s+(AM|PM)$/i;

/**
 * Validate a 12-hour time string strictly.
 * Valid examples: "02:00 AM", "02:05 AM", "10:30 AM", "12:00 PM", "11:45 PM"
 * Invalid examples: "2:5 AM", "25:10 AM", "13:20 PM", "00:30 AM", "2:60 PM"
 */
export function validate12HourTime(timeStr: string): boolean {
  if (!timeStr) return false;
  return TIME_12HR_REGEX.test(timeStr.trim());
}

/**
 * Normalize and parse a 12-hour time string into a structured object.
 * Returns null if invalid.
 */
export function parse12HourTime(timeStr: string): Time12Hour | null {
  if (!timeStr) return null;
  const trimmed = timeStr.trim().toUpperCase();
  const match = trimmed.match(TIME_12HR_REGEX);
  if (!match) return null;

  return {
    hour: match[1].padStart(2, "0"),
    minute: match[2].padStart(2, "0"),
    period: match[3] as "AM" | "PM",
  };
}

/**
 * Format a Time12Hour object to normalized "HH:MM AM/PM" string.
 */
export function format12HourTime(t: Time12Hour): string {
  const hr = t.hour.padStart(2, "0");
  const min = t.minute.padStart(2, "0");
  return `${hr}:${min} ${t.period}`;
}

/**
 * Convert 12-hour time ("02:05 PM") to 24-hour time ("14:05").
 * Returns null if invalid input.
 */
export function convert12HourTo24Hour(time12Str: string): string | null {
  const parsed = parse12HourTime(time12Str);
  if (!parsed) return null;

  let hrInt = parseInt(parsed.hour, 10);
  if (parsed.period === "AM") {
    if (hrInt === 12) hrInt = 0;
  } else {
    if (hrInt !== 12) hrInt += 12;
  }

  const hr24 = hrInt.toString().padStart(2, "0");
  return `${hr24}:${parsed.minute}`;
}

/**
 * Convert 24-hour time ("14:05") or Date object to 12-hour time ("02:05 PM").
 */
export function convert24HourTo12Hour(time24Str: string): string {
  if (!time24Str) return "12:00 PM";
  
  const parts = time24Str.split(":");
  if (parts.length < 2) return "12:00 PM";

  let hrInt = parseInt(parts[0], 10);
  const minInt = parseInt(parts[1], 10);

  if (isNaN(hrInt) || isNaN(minInt)) return "12:00 PM";

  const period: "AM" | "PM" = hrInt >= 12 ? "PM" : "AM";
  if (hrInt === 0) hrInt = 12;
  else if (hrInt > 12) hrInt -= 12;

  const hrStr = hrInt.toString().padStart(2, "0");
  const minStr = Math.min(59, Math.max(0, minInt)).toString().padStart(2, "0");

  return `${hrStr}:${minStr} ${period}`;
}

/**
 * Convert ISO date string ("2026-08-20T14:05:00.000Z") to 12-hour time string ("02:05 PM").
 */
export function isoTo12HourTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "12:00 PM";
  try {
    const d = new Date(isoStr);
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const period: "AM" | "PM" = hours >= 12 ? "PM" : "AM";

    if (hours === 0) hours = 12;
    else if (hours > 12) hours -= 12;

    const hrStr = hours.toString().padStart(2, "0");
    const minStr = minutes.toString().padStart(2, "0");
    return `${hrStr}:${minStr} ${period}`;
  } catch {
    return "12:00 PM";
  }
}

/**
 * Convert ISO date string to date input format ("YYYY-MM-DD").
 */
export function isoToDateInput(isoStr: string | null | undefined): string {
  if (!isoStr) return new Date().toISOString().split("T")[0];
  try {
    const d = new Date(isoStr);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}
