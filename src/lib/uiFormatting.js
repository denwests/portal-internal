export function formatNumericDate(value) {
  if (!value) return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(String(value));
  if (!match) return "-";
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) ||
      date.getUTCMonth() + 1 !== Number(month) ||
      date.getUTCDate() !== Number(day)) return "-";
  return `${day}/${month}/${year}`;
}

export function parseMonthValue(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return year > 0 && month >= 1 && month <= 12 ? { year, month } : null;
}

export function tryOpenPicker(input) {
  try {
    input.showPicker?.();
  } catch {
    // Embedded browsers may forbid showPicker; native input remains usable.
  }
}
