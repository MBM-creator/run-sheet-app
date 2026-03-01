# Run sheet import from Excel (CSV)

Export your **RUN_SHEET_EXPORT** sheet from Excel as CSV and upload it in the app to generate a new **draft** run sheet with days, outcomes, and cutoffs pre-filled.

## CSV format

- **Encoding**: UTF-8 recommended.
- **Headers**: First row must be headers. Matching is **case-insensitive** and **trimmed** (spaces removed).
- **Required columns**: `task_name`, `labour_hours`, `crew_size`, `sequencing_group`, `requires_cutoff`, `cutoff_category`
- **Optional columns**: `description`, `area_or_quantity`, `trade_type`

### Required headers

| Header            | Type    | Validation / default |
|-------------------|---------|----------------------|
| task_name         | string  | Non-empty. |
| labour_hours       | number  | Must be > 0. |
| crew_size          | integer | ≥ 1. Default **2** if missing or blank. |
| sequencing_group   | integer | ≥ 0. Default **0** if missing or blank. |
| requires_cutoff    | boolean | `true`/`false`, `1`/`0`, `yes`/`no` (case-insensitive). |
| cutoff_category    | string  | One of: `concrete`, `pump`, `timber_nonstandard`, `pavers`, `other`, `none` (or empty). If `requires_cutoff` is true, `cutoff_category` cannot be `none` or empty (validation error). |

### Optional headers

- **description** – Free text; not currently mapped into run sheet (reserved).
- **area_or_quantity** – Appended to outcomes as “ — {value}” when present.
- **trade_type** – Reserved for future use.

## Validation rules

- **task_name**: Required, non-empty after trim.
- **labour_hours**: Required, numeric, strictly greater than 0.
- **crew_size**: Integer ≥ 1; default 2 if missing.
- **sequencing_group**: Integer ≥ 0; default 0 if missing.
- **requires_cutoff**: Parsed as boolean; if true, **cutoff_category** must be one of `concrete`, `pump`, `timber_nonstandard`, `pavers`, `other` (not `none` or empty) → else 400 with row/field message.
- **cutoff_category**: Must be one of the allowed values; `none` or empty means “no cutoff” for that task.

Invalid rows produce a **400** response with a list of `{ row, field, message }`.

## Mapping to run sheet days

1. **Task packing**  
   - `task_day_equivalent = labour_hours / (crew_size * 8)` (8-hour day).  
   - Tasks are sorted by `sequencing_group` ascending, then by row order.  
   - Tasks are packed into sequential days (1.0 day-equivalent per day).  
   - Tasks longer than one day are split across days with “(Part 1/N)”, “(Part 2/N)” in the outcome text.

2. **Outcomes**  
   - Per day: bullet list “• {task_name}” and, if present, “ — {area_or_quantity}”.

3. **Cutoffs**  
   - If any task in a day has `requires_cutoff` true and a valid `cutoff_category`, the day gets a cutoff.  
   - The **most critical** category for that day is chosen: `pump` > `concrete` > `pavers` > `timber_nonstandard` > `other`.  
   - Cutoff datetime: calendar rule (e.g. concrete −2 days, pavers −10 days) at **12:00** on the cutoff date.  
   - `cutoff_rule_applied = true` when set by import.

4. **Planned hours**  
   - Per day, sum of `labour_hours` for all tasks (or parts) in that day.  
   - Stored in `logistics_text` as “Planned labour: {X} hours” plus a placeholder line for “Logistics / Tool Notes”.

## Example CSV (minimal)

```csv
task_name,labour_hours,crew_size,sequencing_group,requires_cutoff,cutoff_category,area_or_quantity
Strip and pour pad,16,2,0,TRUE,concrete,50m²
Steel fix,8,2,1,FALSE,none,
Blockwork to DPC,24,2,2,TRUE,other,
```

## API

- **Endpoint**: `POST /api/run-sheet/import-csv`
- **Auth**: Run-sheet token, **owner** only.
- **Body**: `multipart/form-data` with:
  - `file`: CSV file (required)
  - `project_id`: UUID (required)
  - `start_date`: Optional ISO date (YYYY-MM-DD); defaults to project `start_date` or next Monday.
- **Success**: 200 with `{ run_sheet_id, version, redirect_url }`.
- **Validation failure**: 400 with `{ error: "Validation failed", details: [ { row, field, message } ] }`.
