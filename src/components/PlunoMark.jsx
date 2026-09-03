function PlunoMark({ size = 34, className = "" }) {
  return (
    <span
      className={`pluno-mark ${className}`.trim()}
      style={{ "--pluno-mark-size": `${size}px` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" role="presentation">
        <path d="M8.7 7.3c2.9-2.9 7.3-3.8 11.1-2.2-4.4.9-7.7 4.8-7.7 9.5 0 5.4 4.3 9.7 9.7 9.7 1.8 0 3.5-.5 4.9-1.3a11.2 11.2 0 1 1-18-15.7Z" />
        <path className="pluno-mark-glint" d="m22.8 7.2.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7.7-1.7Z" />
      </svg>
    </span>
  );
}

export default PlunoMark;
