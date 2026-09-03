import { parseMonthValue, tryOpenPicker } from "../lib/uiFormatting";

function CalendarGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M7.5 3.5v4M16.5 3.5v4M3.5 9.5h17" />
      <path d="M8 13h2M12 13h2M16 13h1M8 17h2M12 17h2" />
    </svg>
  );
}

export function MonthPicker({ year, month, onChange, ariaLabel = "Select month and year", className = "" }) {
  const value = `${year}-${String(month).padStart(2, "0")}`;

  const handleChange = (event) => {
    const period = parseMonthValue(event.target.value);
    if (period) onChange(period);
  };

  return (
    <label className={`period-picker ${className}`.trim()}>
      <CalendarGlyph />
      <input
        type="month"
        value={value}
        aria-label={ariaLabel}
        onChange={handleChange}
        onClick={(event) => tryOpenPicker(event.currentTarget)}
      />
    </label>
  );
}

export function YearPicker({ value, options, onChange, ariaLabel = "Select year", className = "" }) {
  return (
    <label className={`period-picker period-picker-year ${className}`.trim()}>
      <CalendarGlyph />
      <select value={value} aria-label={ariaLabel} onChange={(event) => onChange(event.target.value)}>
        {options.map((year) => <option key={year} value={year}>{year}</option>)}
      </select>
    </label>
  );
}
