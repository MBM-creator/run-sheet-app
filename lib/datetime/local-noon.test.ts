import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import { toUtcIsoAtLocalNoon } from "./local-noon";

describe("toUtcIsoAtLocalNoon", () => {
  it("returns UTC ISO for 12:00 local on date in Australia/Melbourne", () => {
    const dateStr = "2026-03-01";
    const tz = "Australia/Melbourne";
    const iso = toUtcIsoAtLocalNoon(dateStr, tz);
    const inMelbourne = DateTime.fromISO(iso, { zone: "utc" }).setZone(tz);
    expect(inMelbourne.year).toBe(2026);
    expect(inMelbourne.month).toBe(3);
    expect(inMelbourne.day).toBe(1);
    expect(inMelbourne.hour).toBe(12);
    expect(inMelbourne.minute).toBe(0);
    expect(inMelbourne.second).toBe(0);
  });
});
