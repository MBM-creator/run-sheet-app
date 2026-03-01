/**
 * Measurable-outcome rule: at least one of
 * - digit (regex)
 * - unit tokens: lm, m², m3, m³, units, mm
 * - phrases: ready for, checked, signed, set out, to level
 */
const UNIT_PATTERN =
  /\b(lm|m²|m2|m3|m³|units|mm)\b/i;
const PHRASE_PATTERN =
  /\b(ready for|checked|signed|set out|to level)\b/i;
const DIGIT_PATTERN = /\d/;

export function validateOutcomes(text: string | null | undefined): boolean {
  if (!text || !text.trim()) return false;
  const t = text.trim();
  if (DIGIT_PATTERN.test(t)) return true;
  if (UNIT_PATTERN.test(t)) return true;
  if (PHRASE_PATTERN.test(t)) return true;
  return false;
}

export function getOutcomesError(text: string | null | undefined): string | null {
  if (!text || !text.trim()) return "Outcomes are required.";
  if (validateOutcomes(text)) return null;
  return "Outcomes must include at least one measurable anchor: a number, unit (e.g. lm, m², m3, units, mm), or phrase (e.g. ready for, checked, signed, set out, to level).";
}
