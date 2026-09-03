import { useId, useState } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatCompact(value) {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function formatCurrency(value) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function smoothPath(points) {
  if (!points.length) return "";
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const midpoint = (previous.x + point.x) / 2;
    return `${path} C ${midpoint} ${previous.y}, ${midpoint} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function RevenueTrendChart({ current = [], comparison = [], currentLabel, comparisonLabel }) {
  const patternId = useId().replace(/:/g, "");
  const [activeIndex, setActiveIndex] = useState(null);
  const width = 920;
  const height = 300;
  const pad = { top: 24, right: 18, bottom: 42, left: 58 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  const chart = (() => {
    const values = [...current, ...comparison].map((value) => Number(value || 0));
    const rawMax = Math.max(...values, 1);
    const magnitude = 10 ** Math.floor(Math.log10(rawMax));
    const step = Math.max(magnitude, Math.ceil(rawMax / 4 / magnitude) * magnitude);
    const max = step * 4;
    const toPoints = (series) => MONTHS.map((_, index) => ({
      x: pad.left + (plotWidth / (MONTHS.length - 1)) * index,
      y: pad.top + plotHeight - (Number(series[index] || 0) / max) * plotHeight,
    }));
    return { max, currentPoints: toPoints(current), comparisonPoints: toPoints(comparison) };
  })();

  const currentPath = smoothPath(chart.currentPoints);
  const comparisonPath = smoothPath(chart.comparisonPoints);
  const areaPath = `${currentPath} L ${chart.currentPoints.at(-1).x} ${pad.top + plotHeight} L ${chart.currentPoints[0].x} ${pad.top + plotHeight} Z`;

  return (
    <div className="trend-chart-shell">
      <div className="trend-chart-legend" aria-label="Chart legend">
        <span><i className="legend-current" />{currentLabel}</span>
        <span><i className="legend-comparison" />{comparisonLabel}</span>
      </div>
      <div className="trend-chart-canvas">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Revenue trend ${currentLabel} compared with ${comparisonLabel}`}>
          <defs>
            <pattern id={patternId} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
              <line x1="0" y1="0" x2="0" y2="9" stroke="rgba(170, 170, 176, .16)" strokeWidth="2" />
            </pattern>
          </defs>

          {[0, 1, 2, 3, 4].map((line) => {
            const y = pad.top + (plotHeight / 4) * line;
            const label = chart.max - (chart.max / 4) * line;
            return <g key={line}><line className="trend-grid-line" x1={pad.left} y1={y} x2={width - pad.right} y2={y} /><text className="trend-axis-label" x={pad.left - 14} y={y + 4} textAnchor="end">{formatCompact(label)}</text></g>;
          })}

          <path d={areaPath} fill={`url(#${patternId})`} />
          <path className="trend-line-comparison" d={comparisonPath} />
          <path className="trend-line-current" d={currentPath} />

          {MONTHS.map((month, index) => (
            <g key={month}>
              <text className="trend-month-label" x={chart.currentPoints[index].x} y={height - 12} textAnchor="middle">{month}</text>
              <rect
                className="trend-hit-area"
                role="img"
                aria-label={`${month}: ${currentLabel} ${formatCurrency(current[index])}; ${comparisonLabel} ${formatCurrency(comparison[index])}`}
                x={chart.currentPoints[index].x - plotWidth / 24}
                y={pad.top}
                width={plotWidth / 12}
                height={plotHeight}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
                tabIndex="0"
              />
            </g>
          ))}

          {activeIndex !== null && (
            <g className="trend-focus">
              <line x1={chart.currentPoints[activeIndex].x} y1={pad.top} x2={chart.currentPoints[activeIndex].x} y2={pad.top + plotHeight} />
              <circle cx={chart.comparisonPoints[activeIndex].x} cy={chart.comparisonPoints[activeIndex].y} r="4" className="trend-comparison-dot" />
              <circle cx={chart.currentPoints[activeIndex].x} cy={chart.currentPoints[activeIndex].y} r="5" className="trend-current-dot" />
            </g>
          )}
        </svg>

        {activeIndex !== null && (
          <div className="trend-tooltip" style={{ left: `${(activeIndex / 11) * 100}%` }}>
            <strong>{MONTHS[activeIndex]}</strong>
            <span><i className="legend-current" />{currentLabel}<b>{formatCurrency(current[activeIndex])}</b></span>
            <span><i className="legend-comparison" />{comparisonLabel}<b>{formatCurrency(comparison[activeIndex])}</b></span>
          </div>
        )}
      </div>
    </div>
  );
}

export default RevenueTrendChart;
