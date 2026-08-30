import "./TablePagination.css";

export default function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
  label = "data",
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="table-pagination" aria-label={`Halaman ${label}`}>
      <button
        type="button"
        className="table-page-arrow"
        onClick={() => onPageChange(Math.max(currentPage - 1, 0))}
        disabled={currentPage === 0}
        aria-label={`Halaman ${label} sebelumnya`}
      >
        ←
      </button>

      <span className="table-page-indicator">
        {currentPage + 1}<span>/</span>{totalPages}
      </span>

      <button
        type="button"
        className="table-page-arrow"
        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages - 1))}
        disabled={currentPage >= totalPages - 1}
        aria-label={`Halaman ${label} berikutnya`}
      >
        →
      </button>
    </nav>
  );
}
