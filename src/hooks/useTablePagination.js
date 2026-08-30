import { useState } from "react";

const DEFAULT_PAGE_SIZE = 10;

export default function useTablePagination(
  items,
  resetKey = "",
  pageSize = DEFAULT_PAGE_SIZE
) {
  const [pageState, setPageState] = useState({
    key: resetKey,
    page: 0,
  });
  const totalPages = Math.ceil(items.length / pageSize);
  const requestedPage = pageState.key === resetKey ? pageState.page : 0;
  const safeCurrentPage = totalPages === 0
    ? 0
    : Math.min(requestedPage, totalPages - 1);

  const setCurrentPage = (nextPage) => {
    setPageState((current) => {
      const currentPage = current.key === resetKey ? current.page : 0;
      const resolvedPage = typeof nextPage === "function"
        ? nextPage(currentPage)
        : nextPage;

      return {
        key: resetKey,
        page: resolvedPage,
      };
    });
  };

  const visibleItems = items.slice(
    safeCurrentPage * pageSize,
    safeCurrentPage * pageSize + pageSize
  );

  return {
    currentPage: safeCurrentPage,
    setCurrentPage,
    totalPages,
    visibleItems,
  };
}
