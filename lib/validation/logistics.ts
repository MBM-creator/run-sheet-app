/**
 * Require at least one of the headings: "Tools/Plant:", "Materials:", "Bookings/Access:"
 */
const HEADINGS = [
  "Tools/Plant:",
  "Materials:",
  "Bookings/Access:",
];

export function validateLogistics(text: string | null | undefined): boolean {
  if (!text || !text.trim()) return false;
  const t = text.trim();
  return HEADINGS.some((h) =>
    t.toLowerCase().includes(h.toLowerCase())
  );
}

export function getLogisticsError(text: string | null | undefined): string | null {
  if (!text || !text.trim()) return "Logistics are required.";
  if (validateLogistics(text)) return null;
  return 'Logistics must include at least one of: "Tools/Plant:", "Materials:", "Bookings/Access:".';
}
