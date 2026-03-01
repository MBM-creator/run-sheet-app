import { describe, it, expect } from "vitest";
import { scheduleTasks } from "./schedule-tasks";
import type { ValidatedTaskRow } from "./import-csv";

function row(overrides: Partial<ValidatedTaskRow>): ValidatedTaskRow {
  return {
    task_name: "Task",
    labour_hours: 8,
    crew_size: 1,
    sequencing_group: 1,
    requires_cutoff: false,
    cutoff_category: "other",
    ...overrides,
  };
}

describe("scheduleTasks", () => {
  it("sums planned hours for multiple tasks in one day (8h + 4h = 12h)", () => {
    const rows: ValidatedTaskRow[] = [
      row({ task_name: "A", labour_hours: 8, crew_size: 2, sequencing_group: 1 }),
      row({ task_name: "B", labour_hours: 4, crew_size: 2, sequencing_group: 2 }),
    ];
    const days = scheduleTasks(rows, "2026-03-01");
    expect(days).toHaveLength(1);
    expect(days[0].plannedLabourHours).toBe(12);
  });

  it("splits a task across two days (20h crew 2 -> 16h + 4h)", () => {
    const rows: ValidatedTaskRow[] = [
      row({
        task_name: "Big task",
        labour_hours: 20,
        crew_size: 2,
        sequencing_group: 1,
      }),
    ];
    const days = scheduleTasks(rows, "2026-03-01");
    expect(days).toHaveLength(2);
    expect(days[0].plannedLabourHours).toBe(16);
    expect(days[1].plannedLabourHours).toBe(4);
  });
});
