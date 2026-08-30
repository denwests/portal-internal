import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import TablePagination from "../components/TablePagination";
import useTablePagination from "../hooks/useTablePagination";

import "./Spending.css";


/* =========================================================
   FORMAT RUPIAH
========================================================= */

function formatRupiah(value) {
  return `Rp ${Number(
    value || 0
  ).toLocaleString("id-ID")}`;
}


/* =========================================================
   FORMAT INPUT NUMBER
========================================================= */

function formatInputNumber(value) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const numericValue = String(value).replace(
    /\D/g,
    ""
  );

  if (!numericValue) {
    return "";
  }

  return Number(
    numericValue
  ).toLocaleString("id-ID");
}


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(date) {
  if (!date) return "-";

  const [
    year,
    month,
    day,
  ] = date.split("-");

  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  return `${day} ${
    months[Number(month) - 1]
  } ${year}`;
}


/* =========================================================
   TODAY
========================================================= */

function getTodayString() {
  const today = new Date();

  return `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(
    2,
    "0"
  )}-${String(
    today.getDate()
  ).padStart(
    2,
    "0"
  )}`;
}


/* =========================================================
   CURRENT MONTH
========================================================= */

function getCurrentMonth() {
  return String(
    new Date().getMonth() + 1
  ).padStart(
    2,
    "0"
  );
}


/* =========================================================
   CURRENT YEAR
========================================================= */

function getCurrentYear() {
  return String(
    new Date().getFullYear()
  );
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {
  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/* =========================================================
   COMPONENT
========================================================= */

function Spending() {

  /* =======================================================
     STATE
  ======================================================= */

  const [
    spendings,
    setSpendings,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState(
    getCurrentMonth()
  );

  const [
    selectedYear,
    setSelectedYear,
  ] = useState(
    getCurrentYear()
  );

  const [
    modalType,
    setModalType,
  ] = useState(null);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    editingTransaction,
    setEditingTransaction,
  ] = useState(null);

  const [
    activeCategory,
    setActiveCategory,
  ] = useState(
    "Studio Expenses"
  );

  const [
    formData,
    setFormData,
  ] = useState({
    transaction_date:
      getTodayString(),

    description:
      "",

    amount_in:
      "",

    amount_out:
      "",

    information:
      "",
  });


  /* =======================================================
     TABLE REFS
  ======================================================= */

  const studioTableRef =
    useRef(null);

  const cashTableRef =
    useRef(null);


  /* =======================================================
     MONTH NAMES
  ======================================================= */

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];


  /* =======================================================
     YEAR OPTIONS
  ======================================================= */

  const currentYear =
    new Date().getFullYear();

  const yearOptions = [];

  for (
    let year =
      currentYear - 5;
    year <=
      currentYear + 5;
    year++
  ) {
    yearOptions.push(
      String(year)
    );
  }


  /* =======================================================
     DATABASE CATEGORY
  ======================================================= */

  const normalizeDatabaseCategory =
    (category) => {

      const normalized =
        String(
          category || ""
        )
          .trim()
          .toLowerCase();

      if (
        normalized === "expense" ||
        normalized === "studio expense" ||
        normalized === "studio expenses"
      ) {
        return "expense";
      }

      if (
        normalized === "cash" ||
        normalized === "cash spending" ||
        normalized === "cash movement"
      ) {
        return "cash";
      }

      return normalized;
    };


  const getDatabaseCategory =
    (category) => {

      return category ===
        "Studio Expenses"
        ? "expense"
        : "cash";
    };


  const getDisplayCategory =
    (category) => {

      return normalizeDatabaseCategory(
        category
      ) === "expense"
        ? "Studio Expenses"
        : "Cash Spending";
    };


  /* =======================================================
     FETCH
  ======================================================= */

  const fetchSpendings =
    async () => {

      setLoading(true);
      setErrorMessage("");

      const {
        data,
        error,
      } =
        await supabase
          .from("spendings")
          .select("*")
          .order(
            "date",
            {
              ascending:
                true,
            }
          )
          .order(
            "created_at",
            {
              ascending:
                true,
            }
          );


      if (error) {

        console.error(
          "SPENDING FETCH ERROR:",
          error
        );

        setErrorMessage(
          `Gagal mengambil data spending: ${error.message}`
        );

        setSpendings([]);

        setLoading(false);

        return;
      }


      const normalizedData =
        (data || []).map(
          (item) => ({
            ...item,

            category:
              normalizeDatabaseCategory(
                item.category
              ),

            transaction_date:
              item.transaction_date ||
              item.date ||
              "",
          })
        );


      setSpendings(
        normalizedData
      );

      setLoading(false);
    };


  useEffect(() => {
    fetchSpendings();
  }, []);


  /* =======================================================
     ACTIVE MONTH / YEAR
  ======================================================= */

  const activeMonth =
    selectedMonth;

  const activeYear =
    selectedYear;


  /* =======================================================
     FILTER BY PERIOD
  ======================================================= */

  const filteredSpendings =
    useMemo(() => {

      return spendings
        .filter(
          (item) => {

            if (
              !item.transaction_date
            ) {
              return false;
            }

            return (
              item.transaction_date.slice(
                0,
                4
              ) ===
                activeYear &&
              item.transaction_date.slice(
                5,
                7
              ) ===
                activeMonth
            );
          }
        )
        .sort(
          (a, b) => {

            const dateA =
              a.transaction_date ||
              "";

            const dateB =
              b.transaction_date ||
              "";

            if (
              dateA !==
              dateB
            ) {
              return dateA.localeCompare(
                dateB
              );
            }

            return String(
              a.created_at ||
                ""
            ).localeCompare(
              String(
                b.created_at ||
                  ""
              )
            );
          }
        );

    }, [
      spendings,
      activeMonth,
      activeYear,
    ]);


  /* =======================================================
     CATEGORIES
  ======================================================= */

  const studioExpenses =
    filteredSpendings.filter(
      (item) =>
        normalizeDatabaseCategory(
          item.category
        ) === "expense"
    );


  const cashSpendings =
    filteredSpendings.filter(
      (item) =>
        normalizeDatabaseCategory(
          item.category
        ) === "cash"
    );

  const spendingPeriodKey = `${activeMonth}-${activeYear}`;
  const studioPagination = useTablePagination(
    studioExpenses,
    spendingPeriodKey
  );
  const cashPagination = useTablePagination(
    cashSpendings,
    spendingPeriodKey
  );


  /* =======================================================
     TOTALS
  ======================================================= */

  const totalStudioExpenses =
    studioExpenses.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.amount_out ||
            0
        ),
      0
    );


  const totalCashIn =
    cashSpendings.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.amount_in ||
            0
        ),
      0
    );


  const totalCashOut =
    cashSpendings.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.amount_out ||
            0
        ),
      0
    );


  const totalCashBalance =
    totalCashIn -
    totalCashOut;


  /* =======================================================
     TABLE SCROLL
  ======================================================= */

  const scrollTable = (
    tableRef,
    direction
  ) => {

    if (
      !tableRef.current
    ) {
      return;
    }

    const amount =
      Math.max(
        220,
        tableRef.current
          .clientWidth *
          0.7
      );

    tableRef.current.scrollBy({
      left:
        direction ===
        "left"
          ? -amount
          : amount,

      behavior:
        "smooth",
    });
  };


  /* =======================================================
     RESET FORM
  ======================================================= */

  const resetForm =
    () => {

      setFormData({
        transaction_date:
          getTodayString(),

        description:
          "",

        amount_in:
          "",

        amount_out:
          "",

        information:
          "",
      });

      setEditingTransaction(
        null
      );
    };


  /* =======================================================
     ADD
  ======================================================= */

  const openAddForm =
    (category) => {

      resetForm();

      setActiveCategory(
        category
      );

      setErrorMessage("");

      setModalType(
        "add"
      );
    };


  /* =======================================================
     EDIT
  ======================================================= */

  const openEditForm =
    (item) => {

      setEditingTransaction(
        item
      );

      setActiveCategory(
        getDisplayCategory(
          item.category
        )
      );

      setFormData({

        transaction_date:
          item.transaction_date ||
          item.date ||
          getTodayString(),

        description:
          item.description ||
          "",

        amount_in:
          item.amount_in
            ? String(
                item.amount_in
              )
            : "",

        amount_out:
          item.amount_out
            ? String(
                item.amount_out
              )
            : "",

        information:
          item.information ||
          "",
      });

      setErrorMessage("");

      setModalType(
        "edit"
      );
    };


  /* =======================================================
     CLOSE MODAL
  ======================================================= */

  const closeModal =
    () => {

      setModalType(
        null
      );

      setEditingTransaction(
        null
      );

      resetForm();
    };


  /* =======================================================
     FORM CHANGE
  ======================================================= */

  const handleChange =
    (event) => {

      const {
        name,
        value,
      } = event.target;

      setFormData(
        (current) => ({
          ...current,
          [name]:
            value,
        })
      );
    };


  /* =======================================================
     MONEY CHANGE
  ======================================================= */

  const handleMoneyChange =
    (event) => {

      const {
        name,
        value,
      } = event.target;

      const numericValue =
        value.replace(
          /\D/g,
          ""
        );

      setFormData(
        (current) => ({
          ...current,
          [name]:
            numericValue,
        })
      );
    };


  /* =======================================================
     SAVE
  ======================================================= */

  const handleSubmit =
    async (event) => {

      event.preventDefault();

      setSaving(true);
      setErrorMessage("");


      if (
        !formData.transaction_date ||
        !formData.description.trim()
      ) {

        setErrorMessage(
          "Tanggal dan deskripsi wajib diisi."
        );

        setSaving(false);

        return;
      }


      const amountIn =
        Number(
          formData.amount_in ||
            0
        );

      const amountOut =
        Number(
          formData.amount_out ||
            0
        );


      /* STUDIO */

      if (
        activeCategory ===
        "Studio Expenses"
      ) {

        if (
          amountOut <= 0
        ) {

          setErrorMessage(
            "Nominal pengeluaran wajib diisi."
          );

          setSaving(false);

          return;
        }
      }


      /* CASH */

      if (
        activeCategory ===
        "Cash Spending"
      ) {

        if (
          amountIn <= 0 &&
          amountOut <= 0
        ) {

          setErrorMessage(
            "Masukkan nominal In atau Out."
          );

          setSaving(false);

          return;
        }


        if (
          amountIn > 0 &&
          amountOut > 0
        ) {

          setErrorMessage(
            "Satu transaksi Cash Spending hanya boleh memiliki In atau Out."
          );

          setSaving(false);

          return;
        }
      }


      const databaseCategory =
        getDatabaseCategory(
          activeCategory
        );


      /*
       * Studio Expenses adalah sumber expense untuk Bookkeeping.
       * Cash Spending hanya cash movement dan tidak dihitung sebagai
       * expense oleh Bookkeeping.
       *
       * Untuk menjaga data konsisten:
       * - Studio Expenses selalu amount_in = 0
       * - amount selalu merepresentasikan outgoing amount
       * - date dan transaction_date dibuat sama untuk kompatibilitas
       *   dengan data lama.
       */
      const safeAmountIn =
        databaseCategory === "expense"
          ? 0
          : amountIn;

      const databaseData = {

        category:
          databaseCategory,

        date:
          formData.transaction_date,

        transaction_date:
          formData.transaction_date,

        description:
          formData.description.trim(),

        amount:
          amountOut,

        amount_in:
          safeAmountIn,

        amount_out:
          amountOut,

        information:
          formData.information.trim() ||
          null,
      };


      /* EDIT */

      if (
        modalType ===
          "edit" &&
        editingTransaction
      ) {

        const {
          data,
          error,
        } =
          await supabase
            .from(
              "spendings"
            )
            .update(
              databaseData
            )
            .eq(
              "id",
              editingTransaction.id
            )
            .select()
            .single();


        if (error) {

          console.error(
            "UPDATE SPENDING ERROR:",
            error
          );

          setErrorMessage(
            `Gagal memperbarui transaksi: ${error.message}`
          );

          setSaving(false);

          return;
        }


        const normalizedData =
          {
            ...data,

            category:
              normalizeDatabaseCategory(
                data.category
              ),

            transaction_date:
              data.transaction_date ||
              data.date ||
              "",
          };


        setSpendings(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                editingTransaction.id
                  ? normalizedData
                  : item
            )
        );
      }


      /* ADD */

      else {

        const {
          data,
          error,
        } =
          await supabase
            .from(
              "spendings"
            )
            .insert([
              databaseData,
            ])
            .select()
            .single();


        if (error) {

          console.error(
            "INSERT SPENDING ERROR:",
            error
          );

          setErrorMessage(
            `Gagal menyimpan transaksi: ${error.message}`
          );

          setSaving(false);

          return;
        }


        const normalizedData =
          {
            ...data,

            category:
              normalizeDatabaseCategory(
                data.category
              ),

            transaction_date:
              data.transaction_date ||
              data.date ||
              "",
          };


        setSpendings(
          (current) => [
            ...current,
            normalizedData,
          ]
        );
      }


      setSaving(false);

      closeModal();
    };


  /* =======================================================
     DELETE
  ======================================================= */

  const handleDelete =
    async (item) => {

      const confirmed =
        window.confirm(
          `Hapus transaksi "${item.description}"?`
        );


      if (!confirmed) {
        return;
      }


      setErrorMessage("");


      const {
        error,
      } =
        await supabase
          .from(
            "spendings"
          )
          .delete()
          .eq(
            "id",
            item.id
          );


      if (error) {

        console.error(
          "DELETE SPENDING ERROR:",
          error
        );

        setErrorMessage(
          `Gagal menghapus transaksi: ${error.message}`
        );

        return;
      }


      setSpendings(
        (current) =>
          current.filter(
            (
              transaction
            ) =>
              transaction.id !==
              item.id
          )
      );
    };


  /* =======================================================
     PDF
  ======================================================= */

  const downloadPDF =
    (category) => {

      const rows =
        category ===
        "Studio Expenses"
          ? studioExpenses
          : cashSpendings;


      if (rows.length === 0) {

        setErrorMessage(
          `Tidak ada data ${category.toLowerCase()} untuk periode ini.`
        );

        return;
      }


      setErrorMessage("");


      const title =
        category ===
        "Studio Expenses"
          ? "STUDIO EXPENSES"
          : "CASH SPENDING";


      const monthLabel =
        monthNames[
          Number(
            activeMonth
          ) - 1
        ];


      const total =
        category ===
        "Studio Expenses"
          ? totalStudioExpenses
          : totalCashBalance;


      const isCash =
        category ===
        "Cash Spending";


      const tableRows =
        rows.length > 0
          ? rows
              .map(
                (item) => {

                  return `
                    <tr>

                      <td>
                        ${formatDate(
                          item.transaction_date
                        )}
                      </td>

                      <td>
                        ${escapeHTML(
                          item.description
                        )}
                      </td>

                      ${
                        isCash
                          ? `
                            <td>
                              ${formatRupiah(
                                item.amount_in
                              )}
                            </td>

                            <td>
                              ${formatRupiah(
                                item.amount_out
                              )}
                            </td>

                            <td>
                              ${escapeHTML(
                                item.information ||
                                  "-"
                              )}
                            </td>
                          `
                          : `
                            <td>
                              ${formatRupiah(
                                item.amount_out
                              )}
                            </td>

                            <td>
                              ${formatRupiah(
                                item.amount_out
                              )}
                            </td>

                            <td>
                              ${escapeHTML(
                                item.information ||
                                  "-"
                              )}
                            </td>
                          `
                      }

                    </tr>
                  `;
                }
              )
              .join("")
          : `
              <tr>

                <td
                  colspan="5"
                  style="
                    text-align:center;
                    padding:40px;
                    color:#777;
                  "
                >
                  Tidak ada transaksi.
                </td>

              </tr>
            `;


      const columns =
        isCash
          ? `
              <th>TRANSACTION DATE</th>
              <th>DESCRIPTION</th>
              <th>IN</th>
              <th>OUT</th>
              <th>INFORMATION</th>
            `
          : `
              <th>TRANSACTION DATE</th>
              <th>DESCRIPTION</th>
              <th>OUT</th>
              <th>TOTAL</th>
              <th>INFORMATION</th>
            `;


      const html = `
        <!DOCTYPE html>

        <html>

        <head>

          <meta charset="UTF-8">

          <title>
            ${title} - ${monthLabel} ${activeYear}
          </title>

          <style>

            @page {
              size: A4 landscape;
              margin: 18mm;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              font-family:
                "Helvetica Neue",
                Helvetica,
                Arial,
                sans-serif;
              color: #111;
              background: #fff;
            }

            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              padding-bottom: 15px;
              margin-bottom: 20px;
              border-bottom: 2px solid #111;
            }

            .brand {
              font-size: 24px;
              letter-spacing: 4px;
              font-weight: 500;
            }

            .subtitle {
              margin-top: 5px;
              font-size: 8px;
              letter-spacing: 2px;
              color: #777;
            }

            .period {
              font-size: 10px;
              color: #666;
            }

            h1 {
              margin: 0 0 14px;
              font-size: 19px;
              font-weight: 400;
              letter-spacing: 1px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 9px;
            }

            th {
              padding: 10px 8px;
              text-align: left;
              background: #111;
              color: #fff;
              font-size: 7px;
              letter-spacing: 1.5px;
              font-weight: 400;
            }

            td {
              padding: 9px 8px;
              border-bottom: 1px solid #ddd;
              vertical-align: top;
            }

            tbody tr:nth-child(even) td {
              background: #f7f7f7;
            }

            .total {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 14px;
              padding-top: 14px;
              border-top: 2px solid #111;
            }

            .total-label {
              font-size: 8px;
              letter-spacing: 2px;
              color: #666;
            }

            .total-value {
              font-size: 18px;
              font-weight: 400;
            }

            .footer {
              margin-top: 25px;
              padding-top: 12px;
              border-top: 1px solid #ddd;
              display: flex;
              justify-content: space-between;
              font-size: 7px;
              color: #999;
              letter-spacing: 1px;
            }

          </style>

        </head>

        <body>

          <div class="header">

            <div>

              <div class="brand">
                PLUNO
              </div>

              <div class="subtitle">
                INTERNAL FINANCIAL SYSTEM
              </div>

            </div>

            <div class="period">
              ${monthLabel} ${activeYear}
            </div>

          </div>

          <h1>
            ${title}
          </h1>

          <table>

            <thead>

              <tr>
                ${columns}
              </tr>

            </thead>

            <tbody>
              ${tableRows}
            </tbody>

          </table>

          <div class="total">

            <div class="total-label">
              TOTAL
            </div>

            <div class="total-value">
              ${formatRupiah(total)}
            </div>

          </div>

          <div class="footer">

            <span>
              PLUNO INTERNAL SYSTEM
            </span>

            <span>
              ${monthLabel} ${activeYear}
            </span>

          </div>

          <script>

            window.onload =
              function () {
                window.print();
              };

          </script>

        </body>

        </html>
      `;


      const printWindow =
        window.open(
          "",
          "_blank"
        );


      if (!printWindow) {

        setErrorMessage(
          "Popup diblokir browser. Izinkan popup untuk Download PDF."
        );

        return;
      }


      printWindow.document.open();

      printWindow.document.write(
        html
      );

      printWindow.document.close();
    };


  /* =======================================================
     RENDER
  ======================================================= */

  return (

    <div className="spending-page">


      {/* =================================================
          SIDEBAR
      ================================================= */}

      <Sidebar
        activePage="spending"
      />


      {/* =================================================
          MAIN
      ================================================= */}

      <main className="spending-main">


        {/* =================================================
            OVERVIEW
        ================================================= */}

        <div className="spending-section-heading">

          <div>

            <div className="spending-section-label">
              PLUNO STUDIO / FINANCE
            </div>

            <h2>
              Spending Performance
            </h2>

          </div>


          <div className="spending-performance-filter">


            {/* MONTH */}

            <select
              value={
                activeMonth
              }
              onChange={(
                event
              ) =>
                setSelectedMonth(
                  event.target.value
                )
              }
            >

              {monthNames.map(
                (
                  month,
                  index
                ) => (

                  <option
                    key={
                      month
                    }
                    value={String(
                      index + 1
                    ).padStart(
                      2,
                      "0"
                    )}
                  >
                    {month}
                  </option>

                )
              )}

            </select>


            {/* YEAR */}

            <select
              value={
                activeYear
              }
              onChange={(
                event
              ) =>
                setSelectedYear(
                  event.target.value
                )
              }
            >

              {yearOptions.map(
                (
                  year
                ) => (

                  <option
                    key={
                      year
                    }
                    value={
                      year
                    }
                  >
                    {year}
                  </option>

                )
              )}

            </select>

          </div>

        </div>


        {/* =================================================
            ERROR
        ================================================= */}

        {errorMessage && (

          <div className="spending-error">
            {errorMessage}
          </div>

        )}


        {/* =================================================
            COLUMNS
        ================================================= */}

        <div className="spending-columns">


          {/* =================================================
              STUDIO EXPENSES
          ================================================= */}

          <section className="spending-card">


            <div className="spending-card-header">

              <div className="spending-card-title">

                <div className="spending-card-kicker">
                  STUDIO EXPENSES
                </div>

                <h2>
                  Studio Expenses
                </h2>

              </div>


              <div className="spending-section-actions">

                <button
                  type="button"
                  className="spending-pdf-button"
                  onClick={() =>
                    downloadPDF(
                      "Studio Expenses"
                    )
                  }
                  disabled={
                    loading ||
                    studioExpenses.length === 0
                  }
                  title={
                    studioExpenses.length === 0
                      ? "Tidak ada data untuk diekspor"
                      : "Download studio expenses PDF"
                  }
                >
                  Download PDF
                </button>


                <button
                  type="button"
                  className="spending-add-button"
                  onClick={() =>
                    openAddForm(
                      "Studio Expenses"
                    )
                  }
                >
                  Add
                </button>

              </div>

            </div>


            <div className="spending-toolbar">

              <div className="spending-count">
                {
                  studioExpenses.length
                }{" "}
                TRANSACTION
              </div>


              <div className="spending-table-navigation">

                <button
                  type="button"
                  aria-label="Scroll table left"
                  onClick={() =>
                    scrollTable(
                      studioTableRef,
                      "left"
                    )
                  }
                >
                  ←
                </button>


                <button
                  type="button"
                  aria-label="Scroll table right"
                  onClick={() =>
                    scrollTable(
                      studioTableRef,
                      "right"
                    )
                  }
                >
                  →
                </button>

              </div>

            </div>


            <div
              className="spending-table-scroll"
              ref={
                studioTableRef
              }
            >

              <table className="spending-table">

                <thead>

                  <tr>

                    <th>
                      DATE
                    </th>

                    <th>
                      DESCRIPTION
                    </th>

                    <th>
                      OUT
                    </th>

                    <th>
                      TOTAL
                    </th>

                    <th>
                      INFORMATION
                    </th>

                    <th>
                      ACTION
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {loading ? (

                    <tr>

                      <td
                        colSpan="6"
                        className="spending-empty table-empty-cell"
                      >
                        <span className="table-empty-viewport">
                          Loading...
                        </span>
                      </td>

                    </tr>

                  ) : studioExpenses.length === 0 ? (

                    <tr>

                      <td
                        colSpan="6"
                        className="spending-empty table-empty-cell"
                      >
                        <span className="table-empty-viewport">
                          No studio expenses found.
                        </span>
                      </td>

                    </tr>

                  ) : (

                    studioPagination.visibleItems.map(
                      (
                        item
                      ) => (

                        <tr
                          key={
                            item.id
                          }
                        >

                          <td>
                            {formatDate(
                              item.transaction_date
                            )}
                          </td>


                          <td>

                            <div className="spending-description">
                              {
                                item.description
                              }
                            </div>

                          </td>


                          <td className="money-cell money-out">
                            {formatRupiah(
                              item.amount_out
                            )}
                          </td>


                          <td className="money-cell money-out">
                            {formatRupiah(
                              item.amount_out
                            )}
                          </td>


                          <td>

                            <span className="spending-information">
                              {
                                item.information ||
                                "-"
                              }
                            </span>

                          </td>


                          <td>

                            <div className="spending-actions">

                              <button
                                type="button"
                                onClick={() =>
                                  openEditForm(
                                    item
                                  )
                                }
                              >
                                Edit
                              </button>


                              <button
                                type="button"
                                className="danger"
                                onClick={() =>
                                  handleDelete(
                                    item
                                  )
                                }
                              >
                                Delete
                              </button>

                            </div>

                          </td>

                        </tr>

                      )
                    )

                  )}

                </tbody>

              </table>

            </div>

            <TablePagination
              currentPage={studioPagination.currentPage}
              totalPages={studioPagination.totalPages}
              onPageChange={studioPagination.setCurrentPage}
              label="studio spending"
            />


            <div className="spending-summary">

              <div>

                <span>
                  TOTAL
                </span>

                <strong className="total-expense-value">

                  {formatRupiah(
                    totalStudioExpenses
                  )}

                </strong>

              </div>

            </div>

          </section>


          {/* =================================================
              CASH SPENDING
          ================================================= */}

          <section className="spending-card">


            <div className="spending-card-header">

              <div className="spending-card-title">

                <div className="spending-card-kicker">
                  CASH SPENDING
                </div>

                <h2>
                  Cash Spending
                </h2>

              </div>


              <div className="spending-section-actions">

                <button
                  type="button"
                  className="spending-pdf-button"
                  onClick={() =>
                    downloadPDF(
                      "Cash Spending"
                    )
                  }
                  disabled={
                    loading ||
                    cashSpendings.length === 0
                  }
                  title={
                    cashSpendings.length === 0
                      ? "Tidak ada data untuk diekspor"
                      : "Download cash spending PDF"
                  }
                >
                  Download PDF
                </button>


                <button
                  type="button"
                  className="spending-add-button"
                  onClick={() =>
                    openAddForm(
                      "Cash Spending"
                    )
                  }
                >
                  Add
                </button>

              </div>

            </div>


            <div className="spending-toolbar">

              <div className="spending-count">
                {
                  cashSpendings.length
                }{" "}
                TRANSACTION
              </div>


              <div className="spending-table-navigation">

                <button
                  type="button"
                  aria-label="Scroll table left"
                  onClick={() =>
                    scrollTable(
                      cashTableRef,
                      "left"
                    )
                  }
                >
                  ←
                </button>


                <button
                  type="button"
                  aria-label="Scroll table right"
                  onClick={() =>
                    scrollTable(
                      cashTableRef,
                      "right"
                    )
                  }
                >
                  →
                </button>

              </div>

            </div>


            <div
              className="spending-table-scroll"
              ref={
                cashTableRef
              }
            >

              <table className="spending-table">

                <thead>

                  <tr>

                    <th>
                      DATE
                    </th>

                    <th>
                      DESCRIPTION
                    </th>

                    <th>
                      IN
                    </th>

                    <th>
                      OUT
                    </th>

                    <th>
                      INFORMATION
                    </th>

                    <th>
                      ACTION
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {loading ? (

                    <tr>

                      <td
                        colSpan="6"
                        className="spending-empty table-empty-cell"
                      >
                        <span className="table-empty-viewport">
                          Loading...
                        </span>
                      </td>

                    </tr>

                  ) : cashSpendings.length === 0 ? (

                    <tr>

                      <td
                        colSpan="6"
                        className="spending-empty table-empty-cell"
                      >
                        <span className="table-empty-viewport">
                          No cash spending found.
                        </span>
                      </td>

                    </tr>

                  ) : (

                    cashPagination.visibleItems.map(
                      (
                        item
                      ) => (

                        <tr
                          key={
                            item.id
                          }
                        >

                          <td>
                            {formatDate(
                              item.transaction_date
                            )}
                          </td>


                          <td>

                            <div className="spending-description">
                              {
                                item.description
                              }
                            </div>

                          </td>


                          <td className="money-cell money-in">
                            {formatRupiah(
                              item.amount_in
                            )}
                          </td>


                          <td className="money-cell money-out">
                            {formatRupiah(
                              item.amount_out
                            )}
                          </td>


                          <td>

                            <span className="spending-information">
                              {
                                item.information ||
                                "-"
                              }
                            </span>

                          </td>


                          <td>

                            <div className="spending-actions">

                              <button
                                type="button"
                                onClick={() =>
                                  openEditForm(
                                    item
                                  )
                                }
                              >
                                Edit
                              </button>


                              <button
                                type="button"
                                className="danger"
                                onClick={() =>
                                  handleDelete(
                                    item
                                  )
                                }
                              >
                                Delete
                              </button>

                            </div>

                          </td>

                        </tr>

                      )
                    )

                  )}

                </tbody>

              </table>

            </div>

            <TablePagination
              currentPage={cashPagination.currentPage}
              totalPages={cashPagination.totalPages}
              onPageChange={cashPagination.setCurrentPage}
              label="cash spending"
            />


            <div className="spending-summary">

              <div>

                <span>
                  TOTAL
                </span>


                <strong
                  className={
                    totalCashBalance <
                    0
                      ? "negative"
                      : totalCashBalance >
                        0
                      ? "positive"
                      : ""
                  }
                >

                  {formatRupiah(
                    totalCashBalance
                  )}

                </strong>

              </div>

            </div>

          </section>

        </div>


        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="spending-footer">

          <span>
            PLUNO INTERNAL SYSTEM
          </span>

          <span>
            v1.0 · 2026
          </span>

        </footer>

      </main>


      {/* =====================================================
          MODAL
      ===================================================== */}

      {modalType && (

        <div className="spending-overlay">


          <div className="spending-form-box">


            <div className="spending-form-header">

              <div>

                <div className="spending-form-kicker">

                  {modalType ===
                  "edit"
                    ? "EDIT TRANSACTION"
                    : activeCategory ===
                      "Studio Expenses"
                    ? "STUDIO EXPENSES"
                    : "CASH SPENDING"}

                </div>


                <h2>

                  {modalType ===
                  "edit"
                    ? "Edit Transaction"
                    : "Add Transaction"}

                </h2>


                <p>

                  {activeCategory ===
                  "Studio Expenses"
                    ? "Add studio expense transaction."
                    : "Add cash movement transaction."}

                </p>

              </div>


              <button
                type="button"
                className="spending-close"
                onClick={
                  closeModal
                }
              >
                ×
              </button>

            </div>


            <form
              onSubmit={
                handleSubmit
              }
            >

              <div className="spending-form-grid">


                <div className="spending-field">

                  <label>
                    TRANSACTION DATE
                  </label>

                  <input
                    type="date"
                    name="transaction_date"
                    value={
                      formData.transaction_date
                    }
                    onChange={
                      handleChange
                    }
                    required
                  />

                </div>


                <div className="spending-field">

                  <label>
                    DESCRIPTION
                  </label>

                  <input
                    type="text"
                    name="description"
                    placeholder="Transaction description"
                    value={
                      formData.description
                    }
                    onChange={
                      handleChange
                    }
                    required
                  />

                </div>


                {activeCategory ===
                  "Cash Spending" && (

                  <div className="spending-field">

                    <label>
                      IN
                    </label>

                    <input
                      type="text"
                      name="amount_in"
                      inputMode="numeric"
                      placeholder="0"
                      value={formatInputNumber(
                        formData.amount_in
                      )}
                      onChange={
                        handleMoneyChange
                      }
                    />

                  </div>

                )}


                <div className="spending-field">

                  <label>
                    OUT
                  </label>

                  <input
                    type="text"
                    name="amount_out"
                    inputMode="numeric"
                    placeholder="0"
                    value={formatInputNumber(
                      formData.amount_out
                    )}
                    onChange={
                      handleMoneyChange
                    }
                    required={
                      activeCategory ===
                      "Studio Expenses"
                    }
                  />

                </div>


                <div className="spending-field spending-field-wide">

                  <label>
                    INFORMATION
                  </label>

                  <textarea
                    name="information"
                    rows="4"
                    placeholder="Additional information..."
                    value={
                      formData.information
                    }
                    onChange={
                      handleChange
                    }
                  />

                </div>

              </div>


              {errorMessage && (

                <div className="spending-form-error">
                  {
                    errorMessage
                  }
                </div>

              )}


              <div className="spending-form-footer">

                <button
                  type="button"
                  className="spending-cancel"
                  onClick={
                    closeModal
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="spending-save"
                  disabled={
                    saving
                  }
                >

                  {saving
                    ? "Saving..."
                    : "Save Transaction"}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}


export default Spending;
