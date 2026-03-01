import Papa from "papaparse";
import type { CutoffCategory } from "@/lib/types";

const REQUIRED_HEADERS = [
  "task_name",
  "labour_hours",
  "crew_size",
  "sequencing_group",
  "requires_cutoff",
  "cutoff_category",
] as const;

const OPTIONAL_HEADERS = ["description", "area_or_quantity", "trade_type"] as const;

const CUTOFF_CATEGORIES: (CutoffCategory | "none")[] = [
  "concrete",
  "pump",
  "timber_nonstandard",
  "pavers",
  "other",
  "none",
];

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ValidatedTaskRow {
  task_name: string;
  labour_hours: number;
  crew_size: number;
  sequencing_group: number;
  requires_cutoff: boolean;
  cutoff_category: string;
  area_or_quantity?: string;
  description?: string;
  trade_type?: string;
}

export interface ParseResult {
  valid: boolean;
  rows: ValidatedTaskRow[];
  errors: ValidationError[];
}

function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseBoolean(val: string | undefined): boolean {
  if (val == null || val === "") return false;
  const v = String(val).trim().toLowerCase();
  if (["true", "1", "yes"].includes(v)) return true;
  if (["false", "0", "no"].includes(v)) return false;
  return false;
}

function parseCutoffCategory(val: string | undefined): string {
  if (val == null || val === "") return "none";
  const v = String(val).trim().toLowerCase();
  if (CUTOFF_CATEGORIES.includes(v as CutoffCategory | "none")) return v;
  return v;
}

export function parseAndValidateCsv(csvText: string): ParseResult {
  const errors: ValidationError[] = [];
  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
  const dataRows = parsed.data as string[][];
  if (dataRows.length < 2) {
    return {
      valid: false,
      rows: [],
      errors: [{ row: 1, field: "_", message: "CSV must have a header row and at least one data row." }],
    };
  }

  const headerRow = dataRows[0];
  const headers = headerRow.map((h) => normaliseHeader(h));
  const headerIndex: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerIndex[h] = i;
  });

  const missing = REQUIRED_HEADERS.filter((h) => headerIndex[h] === undefined);
  if (missing.length > 0) {
    return {
      valid: false,
      rows: [],
      errors: [{ row: 1, field: "headers", message: `Missing required columns: ${missing.join(", ")}` }],
    };
  }

  const get = (row: string[], key: string): string =>
    (row[headerIndex[key]] ?? "").trim();

  const rows: ValidatedTaskRow[] = [];
  for (let i = 1; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 1;

    const taskName = get(row, "task_name");
    if (!taskName) {
      errors.push({ row: rowNum, field: "task_name", message: "task_name is required and must be non-empty." });
    }

    const labourHoursStr = get(row, "labour_hours");
    const labourHours = labourHoursStr === "" ? NaN : parseFloat(labourHoursStr);
    if (Number.isNaN(labourHours) || labourHours <= 0) {
      errors.push({ row: rowNum, field: "labour_hours", message: "labour_hours must be a number greater than 0." });
    }

    const crewSizeStr = get(row, "crew_size");
    const crewSizeParsed = crewSizeStr === "" ? 2 : parseInt(crewSizeStr, 10);
    const crewSize = Number.isNaN(crewSizeParsed) || crewSizeParsed < 1 ? 2 : crewSizeParsed;
    if (crewSize < 1) {
      errors.push({ row: rowNum, field: "crew_size", message: "crew_size must be an integer >= 1." });
    }

    const seqStr = get(row, "sequencing_group");
    const seqParsed = seqStr === "" ? 0 : parseInt(seqStr, 10);
    const sequencingGroup = Number.isNaN(seqParsed) || seqParsed < 0 ? 0 : seqParsed;
    if (sequencingGroup < 0) {
      errors.push({ row: rowNum, field: "sequencing_group", message: "sequencing_group must be an integer >= 0." });
    }

    const requiresCutoff = parseBoolean(get(row, "requires_cutoff"));
    const cutoffCategoryRaw = parseCutoffCategory(get(row, "cutoff_category"));
    const cutoffCategory = cutoffCategoryRaw === "" ? "none" : cutoffCategoryRaw;
    if (requiresCutoff && (cutoffCategory === "none" || cutoffCategory === "")) {
      errors.push({
        row: rowNum,
        field: "cutoff_category",
        message: "cutoff_category is required when requires_cutoff is true (cannot be none or empty).",
      });
    }

    const areaOrQuantity = get(row, "area_or_quantity") || undefined;
    const description = get(row, "description") || undefined;
    const tradeType = get(row, "trade_type") || undefined;

    if (errors.some((e) => e.row === rowNum)) continue;

    rows.push({
      task_name: taskName,
      labour_hours: labourHours,
      crew_size: crewSize,
      sequencing_group: sequencingGroup,
      requires_cutoff: requiresCutoff,
      cutoff_category: cutoffCategory,
      area_or_quantity: areaOrQuantity,
      description,
      trade_type: tradeType,
    });
  }

  return {
    valid: errors.length === 0,
    rows,
    errors,
  };
}
