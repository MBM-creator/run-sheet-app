import type { CutoffCategory } from "@/lib/types";
import { getDefaultCutoffUtcISOAtLocalNoon } from "@/lib/cutoff-rules";
import { DEFAULT_TZ } from "@/lib/timezone";
import type { ValidatedTaskRow } from "./import-csv";

const CUTOFF_PRIORITY: CutoffCategory[] = [
  "pump",
  "concrete",
  "pavers",
  "timber_nonstandard",
  "other",
];

function isDbCutoffCategory(
  s: string
): s is CutoffCategory {
  return CUTOFF_PRIORITY.includes(s as CutoffCategory);
}

export interface ScheduledDay {
  day_number: number;
  calendar_date: string;
  outcomes_text: string;
  logistics_text: string;
  cutoff_datetime: string | null;
  cutoff_category: CutoffCategory | null;
  cutoff_rule_applied: boolean;
  plannedLabourHours: number;
}

function addOutcomeLine(taskName: string, partLabel?: string, areaOrQuantity?: string): string {
  let line = `• ${taskName}`;
  if (partLabel) line += ` ${partLabel}`;
  if (areaOrQuantity) line += ` — ${areaOrQuantity}`;
  return line;
}

export function scheduleTasks(
  rows: ValidatedTaskRow[],
  startDate: string
): ScheduledDay[] {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return [];

  const sorted = [...rows].sort(
    (a, b) =>
      a.sequencing_group - b.sequencing_group
  );

  const DAY_CAPACITY = 1.0;
  const HOURS_PER_DAY = 8;

  const days: ScheduledDay[] = [];
  let currentDayNumber = 1;
  let currentOutcomeLines: string[] = [];
  let currentPlannedHours = 0;
  let currentCutoffCategories: string[] = [];
  let remainingCapacity = DAY_CAPACITY;

  function flushDay() {
    const calendarDate = new Date(start);
    calendarDate.setDate(start.getDate() + (currentDayNumber - 1));
    const calendarDateStr = calendarDate.toISOString().slice(0, 10);

    const outcomes_text = currentOutcomeLines.length > 0
      ? currentOutcomeLines.join("\n")
      : "—";
    const plannedLabourHours = Math.round(currentPlannedHours * 10) / 10;
    const logisticsLines = ["Logistics / Tool Notes", `Planned labour: ${plannedLabourHours} hours`];
    const logistics_text = logisticsLines.join("\n");

    let cutoff_category: CutoffCategory | null = null;
    let cutoff_datetime: string | null = null;
    for (const cat of CUTOFF_PRIORITY) {
      if (currentCutoffCategories.includes(cat)) {
        cutoff_category = cat;
        cutoff_datetime = getDefaultCutoffUtcISOAtLocalNoon(calendarDateStr, cat, DEFAULT_TZ);
        break;
      }
    }

    days.push({
      day_number: currentDayNumber,
      calendar_date: calendarDateStr,
      outcomes_text,
      logistics_text,
      cutoff_datetime,
      cutoff_category,
      cutoff_rule_applied: cutoff_datetime != null,
      plannedLabourHours,
    });

    currentDayNumber++;
    currentOutcomeLines = [];
    currentPlannedHours = 0;
    currentCutoffCategories = [];
    remainingCapacity = DAY_CAPACITY;
  }

  for (const row of sorted) {
    const taskDayEquivalent = row.labour_hours / (row.crew_size * HOURS_PER_DAY);
    let labourRemaining = row.labour_hours;
    let partIndex = 0;
    const totalParts = taskDayEquivalent > DAY_CAPACITY
      ? Math.ceil(taskDayEquivalent)
      : 1;

    while (labourRemaining > 0.0001) {
      const capacityNow = remainingCapacity * row.crew_size * HOURS_PER_DAY;
      const hoursThisPart = Math.min(labourRemaining, capacityNow);
      const dayEquivThisPart = hoursThisPart / (row.crew_size * HOURS_PER_DAY);

      if (dayEquivThisPart > remainingCapacity && currentOutcomeLines.length > 0) {
        flushDay();
      }

      const partLabel =
        totalParts > 1
          ? `(Part ${partIndex + 1}/${totalParts})`
          : undefined;
      currentOutcomeLines.push(
        addOutcomeLine(row.task_name, partLabel, row.area_or_quantity)
      );
      currentPlannedHours += hoursThisPart;
      if (row.requires_cutoff && isDbCutoffCategory(row.cutoff_category)) {
        currentCutoffCategories.push(row.cutoff_category);
      }
      remainingCapacity -= dayEquivThisPart;
      labourRemaining -= hoursThisPart;
      partIndex++;

      if (remainingCapacity <= 0.0001) {
        flushDay();
      }
    }
  }

  if (currentOutcomeLines.length > 0) {
    flushDay();
  }

  return days;
}
