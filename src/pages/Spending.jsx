import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import TablePagination from "../components/TablePagination";
import { MonthPicker } from "../components/PeriodPicker";
import { PLUNO_PRINT_CSS } from "../lib/printTheme";
import {
  SPENDING_CATEGORIES,
  calculateEvotoAmount,
  getSpendingCategory,
  normalizeSpendingCategory,
  summarizeSpendings,
} from "../lib/spendingFinance";
import useTablePagination from "../hooks/useTablePagination";

import "./Spending.css";

const normalizeDatabaseCategory = normalizeSpendingCategory;


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

function normalizeCreditInput(value) {
  const normalized = String(value ?? "")
    .replace(/,/g, ".")
    .replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = normalized.split(".");
  const decimal = decimalParts.join("").slice(0, 2);
  return normalized.includes(".") ? `${whole || "0"}.${decimal}` : whole;
}

function formatCreditInput(value) {
  return String(value ?? "").replace(".", ",");
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

  const [selectedCategory, setSelectedCategory] = useState("expense");
  const [evotoCreditRate, setEvotoCreditRate] = useState(0);
  const [creditRateInput, setCreditRateInput] = useState("");
  const [settingsAvailable, setSettingsAvailable] = useState(true);

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

    evoto_direction:
      "Out",

    evoto_credits:
      "",
  });


  /* =======================================================
     TABLE REFS
  ======================================================= */

  const spendingTableRef =
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
     DATABASE CATEGORY
  ======================================================= */

  const getDatabaseCategory =
    (category) => {

      return getSpendingCategory(category).key;
    };


  const getDisplayCategory =
    (category) => {

      return getSpendingCategory(category).label;
    };


  /* =======================================================
     FETCH
  ======================================================= */

  const fetchSpendings =
    useCallback(async () => {

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
    }, []);

  const fetchSpendingSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from("spending_settings")
      .select("evoto_credit_rate")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      const missingTable = error.code === "42P01" || error.code === "PGRST205";
      if (!missingTable) console.error("SPENDING SETTINGS ERROR:", error);
      setSettingsAvailable(!missingTable);
      return;
    }

    const rate = Number(data?.evoto_credit_rate || 0);
    setEvotoCreditRate(rate);
    setCreditRateInput(rate ? String(rate) : "");
    setSettingsAvailable(true);
  }, []);


  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchSpendings();
      void fetchSpendingSettings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchSpendings, fetchSpendingSettings]);


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

  const attireSpendings = filteredSpendings.filter(
    (item) => normalizeDatabaseCategory(item.category) === "attire"
  );

  const evotoSpendings = filteredSpendings.filter(
    (item) => normalizeDatabaseCategory(item.category) === "evoto"
  );

  const categoryRows = {
    expense: studioExpenses,
    cash: cashSpendings,
    attire: attireSpendings,
    evoto: evotoSpendings,
  };

  const spendingSummary = summarizeSpendings(filteredSpendings, evotoCreditRate);

  const spendingPeriodKey = `${activeMonth}-${activeYear}`;
  const studioPagination = useTablePagination(studioExpenses, spendingPeriodKey);
  const cashPagination = useTablePagination(cashSpendings, spendingPeriodKey);
  const attirePagination = useTablePagination(attireSpendings, spendingPeriodKey);
  const evotoPagination = useTablePagination(evotoSpendings, spendingPeriodKey);


  /* =======================================================
     TOTALS
  ======================================================= */

  const totalStudioExpenses =
    spendingSummary.expense;


  const totalCashIn =
    spendingSummary.cashIn;


  const totalCashOut =
    spendingSummary.cashOut;


  const totalCashBalance =
    spendingSummary.cashBalance;

  const isSupplementalCategory = selectedCategory === "attire" || selectedCategory === "evoto";
  const supplementalRows = selectedCategory === "evoto" ? evotoSpendings : attireSpendings;
  const supplementalPagination = selectedCategory === "evoto" ? evotoPagination : attirePagination;
  const supplementalCategory = getSpendingCategory(selectedCategory);


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

        evoto_direction:
          "Out",

        evoto_credits:
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

        evoto_direction:
          item.evoto_direction ||
          "Out",

        evoto_credits:
          item.evoto_credits
            ? String(item.evoto_credits)
            : "",
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

      const evotoCredits = Number(formData.evoto_credits || 0);
      const isEvoto = activeCategory === "Evoto Balance";
      const calculatedEvotoAmount = calculateEvotoAmount(
        evotoCredits,
        evotoCreditRate
      );


      /* STUDIO */

      if (
        activeCategory ===
          "Studio Expenses" ||
        activeCategory ===
          "Attire / Background"
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

      if (isEvoto) {
        if (evotoCreditRate <= 0) {
          setErrorMessage("Atur harga per Evoto credit melalui tombol gear terlebih dahulu.");
          setSaving(false);
          return;
        }

        if (evotoCredits <= 0) {
          setErrorMessage("Jumlah Evoto credit wajib lebih dari 0.");
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
        databaseCategory === "expense" ||
        databaseCategory === "attire" ||
        databaseCategory === "evoto"
          ? 0
          : amountIn;

      const safeAmountOut = isEvoto
        ? calculatedEvotoAmount
        : amountOut;

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
          safeAmountOut,

        amount_in:
          safeAmountIn,

        amount_out:
          safeAmountOut,

        information:
          formData.information.trim() ||
          null,

        evoto_direction:
          isEvoto ? formData.evoto_direction : null,

        evoto_credits:
          isEvoto ? evotoCredits : 0,

        evoto_credit_rate:
          isEvoto ? evotoCreditRate : 0,
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

  const handleCreditChange = (event) => {
    setFormData((current) => ({
      ...current,
      evoto_credits: normalizeCreditInput(event.target.value),
    }));
  };

  const handleSaveCreditRate = async (event) => {
    event.preventDefault();
    const rate = Number(String(creditRateInput || "").replace(/\D/g, ""));

    if (rate <= 0) {
      setErrorMessage("Harga per Evoto credit wajib lebih dari 0.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    const { error } = await supabase
      .from("spending_settings")
      .upsert({ id: 1, evoto_credit_rate: rate }, { onConflict: "id" });

    if (error) {
      setErrorMessage(
        settingsAvailable
          ? `Gagal menyimpan Evoto credit rate: ${error.message}`
          : "Jalankan supabase/spending-four-panels.sql terlebih dahulu."
      );
      setSaving(false);
      return;
    }

    setEvotoCreditRate(rate);
    setSettingsAvailable(true);
    setSaving(false);
    setModalType(null);
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
        categoryRows[getDatabaseCategory(category)] || [];


      if (rows.length === 0) {

        setErrorMessage(
          `Tidak ada data ${category.toLowerCase()} untuk periode ini.`
        );

        return;
      }


      setErrorMessage("");


      const title =
        category.toUpperCase();


      const monthLabel =
        monthNames[
          Number(
            activeMonth
          ) - 1
        ];


      const total =
        category === "Studio Expenses"
          ? totalStudioExpenses
          : category === "Cash Spending"
          ? totalCashBalance
          : category === "Attire / Background"
          ? spendingSummary.attire
          : spendingSummary.evotoUsageValue;


      const isCash =
        category ===
        "Cash Spending";

      const isEvoto = category === "Evoto Balance";


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
                          : isEvoto
                          ? `
                            <td>${escapeHTML(item.evoto_direction || "Out")}</td>
                            <td>${Number(item.evoto_credits || 0).toLocaleString("id-ID")}</td>
                            <td>${formatRupiah(item.amount_out)}</td>
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
          : isEvoto
          ? `
              <th>TRANSACTION DATE</th>
              <th>DESCRIPTION</th>
              <th>TYPE</th>
              <th>CREDITS</th>
              <th>VALUE</th>
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

            ${PLUNO_PRINT_CSS}

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

              <div class="document-type">
                ${title}
              </div>

            </div>

            <div class="header-right">
              <div class="label">PERIOD</div>
              <div class="value">${monthLabel} ${activeYear}</div>
            </div>

          </div>

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
            <MonthPicker
              year={activeYear}
              month={activeMonth}
              ariaLabel="Spending month and year"
              onChange={({ year, month }) => {
                setSelectedYear(String(year));
                setSelectedMonth(String(month).padStart(2, "0"));
              }}
            />
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

        <div className="spending-overview-grid">
          {SPENDING_CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category.key;
            const cardContent =
              category.key === "expense"
                ? { value: formatRupiah(spendingSummary.expense), detail: `${studioExpenses.length} transactions` }
                : category.key === "cash"
                ? { value: formatRupiah(spendingSummary.cashBalance), detail: `In ${formatRupiah(totalCashIn)} · Out ${formatRupiah(totalCashOut)}` }
                : category.key === "attire"
                ? { value: formatRupiah(spendingSummary.attire), detail: `${attireSpendings.length} transactions` }
                : { value: `${spendingSummary.evotoBalance.toLocaleString("id-ID")} credits`, detail: `In ${spendingSummary.evotoIn.toLocaleString("id-ID")} · Out ${spendingSummary.evotoOut.toLocaleString("id-ID")}` };

            return (
              <button
                key={category.key}
                type="button"
                className={`spending-overview-card${isSelected ? " is-active" : ""}`}
                onClick={() => setSelectedCategory(category.key)}
                aria-pressed={isSelected}
              >
                <span className="spending-overview-kicker">{category.kicker}</span>
                <strong>{category.label}</strong>
                <b>{cardContent.value}</b>
                <small>{cardContent.detail}</small>
                {category.key === "evoto" && (
                  <span
                    role="button"
                    tabIndex="0"
                    className="spending-settings-trigger"
                    aria-label="Open Evoto credit settings"
                    title="Evoto credit settings"
                    onClick={(event) => {
                      event.stopPropagation();
                      setCreditRateInput(evotoCreditRate ? String(evotoCreditRate) : "");
                      setErrorMessage("");
                      setModalType("settings");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        setModalType("settings");
                      }
                    }}
                  >
                    ⚙
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {!settingsAvailable && (
          <div className="spending-setup-note">
            Run <strong>supabase/spending-four-panels.sql</strong> to activate Attire / Background and Evoto settings.
          </div>
        )}

        <div className="spending-columns">


          {/* =================================================
              STUDIO EXPENSES
          ================================================= */}

          {selectedCategory === "expense" && <section className="spending-card">


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
                      spendingTableRef,
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
                      spendingTableRef,
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
                spendingTableRef
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

          </section>}


          {/* =================================================
              CASH SPENDING
          ================================================= */}

          {selectedCategory === "cash" && <section className="spending-card">


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
                      spendingTableRef,
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
                      spendingTableRef,
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
                spendingTableRef
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

          </section>}

          {isSupplementalCategory && (
            <section className="spending-card">
              <div className="spending-card-header">
                <div className="spending-card-title">
                  <div className="spending-card-kicker">{supplementalCategory.kicker}</div>
                  <h2>{supplementalCategory.label}</h2>
                </div>
                <div className="spending-section-actions">
                  {selectedCategory === "evoto" && (
                    <button
                      type="button"
                      className="spending-settings-button"
                      onClick={() => {
                        setCreditRateInput(evotoCreditRate ? String(evotoCreditRate) : "");
                        setErrorMessage("");
                        setModalType("settings");
                      }}
                    >
                      ⚙ Credit Rate
                    </button>
                  )}
                  <button
                    type="button"
                    className="spending-pdf-button"
                    onClick={() => downloadPDF(supplementalCategory.label)}
                    disabled={loading || supplementalRows.length === 0}
                  >
                    Download PDF
                  </button>
                  <button
                    type="button"
                    className="spending-add-button"
                    onClick={() => openAddForm(supplementalCategory.label)}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="spending-toolbar">
                <div className="spending-count">{supplementalRows.length} TRANSACTION</div>
                <div className="spending-table-navigation">
                  <button type="button" aria-label="Scroll table left" onClick={() => scrollTable(spendingTableRef, "left")}>←</button>
                  <button type="button" aria-label="Scroll table right" onClick={() => scrollTable(spendingTableRef, "right")}>→</button>
                </div>
              </div>

              <div className="spending-table-scroll" ref={spendingTableRef}>
                <table className={`spending-table${selectedCategory === "evoto" ? " spending-table-evoto" : ""}`}>
                  <thead>
                    <tr>
                      <th>DATE</th>
                      <th>DESCRIPTION</th>
                      {selectedCategory === "evoto" ? (
                        <>
                          <th>TYPE</th>
                          <th>CREDITS</th>
                          <th>VALUE</th>
                        </>
                      ) : (
                        <>
                          <th>OUT</th>
                          <th>TOTAL</th>
                          <th>INFORMATION</th>
                        </>
                      )}
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="6" className="spending-empty table-empty-cell"><span className="table-empty-viewport">Loading...</span></td></tr>
                    ) : supplementalRows.length === 0 ? (
                      <tr><td colSpan="6" className="spending-empty table-empty-cell"><span className="table-empty-viewport">No {supplementalCategory.label.toLowerCase()} found.</span></td></tr>
                    ) : supplementalPagination.visibleItems.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDate(item.transaction_date)}</td>
                        <td><div className="spending-description">{item.description}</div></td>
                        {selectedCategory === "evoto" ? (
                          <>
                            <td><span className={`spending-direction is-${String(item.evoto_direction || "Out").toLowerCase()}`}>{item.evoto_direction || "Out"}</span></td>
                            <td>{Number(item.evoto_credits || 0).toLocaleString("id-ID")}</td>
                            <td className="money-cell money-out">{formatRupiah(item.amount_out)}</td>
                          </>
                        ) : (
                          <>
                            <td className="money-cell money-out">{formatRupiah(item.amount_out)}</td>
                            <td className="money-cell money-out">{formatRupiah(item.amount_out)}</td>
                            <td><span className="spending-information">{item.information || "-"}</span></td>
                          </>
                        )}
                        <td>
                          <div className="spending-actions">
                            <button type="button" onClick={() => openEditForm(item)}>Edit</button>
                            <button type="button" className="danger" onClick={() => handleDelete(item)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <TablePagination
                currentPage={supplementalPagination.currentPage}
                totalPages={supplementalPagination.totalPages}
                onPageChange={supplementalPagination.setCurrentPage}
                label={supplementalCategory.label.toLowerCase()}
              />

              <div className={`spending-summary${selectedCategory === "evoto" ? " spending-summary-evoto" : ""}`}>
                {selectedCategory === "evoto" ? (
                  <>
                    <div><span>CREDIT RATE</span><strong>{formatRupiah(evotoCreditRate)}</strong></div>
                    <div><span>USAGE VALUE</span><strong>{formatRupiah(spendingSummary.evotoUsageValue)}</strong></div>
                    <div><span>BALANCE</span><strong>{spendingSummary.evotoBalance.toLocaleString("id-ID")} credits</strong></div>
                  </>
                ) : (
                  <div><span>TOTAL</span><strong>{formatRupiah(spendingSummary.attire)}</strong></div>
                )}
              </div>
            </section>
          )}

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

      {modalType === "settings" && (
        <div className="spending-overlay">
          <div className="spending-form-box spending-settings-modal">
            <div className="spending-form-header">
              <div>
                <div className="spending-form-kicker">EVOTO SETTINGS</div>
                <h2>Credit Conversion</h2>
                <p>Set the Rupiah value of one Evoto credit.</p>
              </div>
              <button type="button" className="spending-close" onClick={closeModal}>×</button>
            </div>
            <form onSubmit={handleSaveCreditRate}>
              <div className="spending-field">
                <label>1 CREDIT VALUE</label>
                <div className="spending-money-input">
                  <span>Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatInputNumber(creditRateInput)}
                    placeholder="0"
                    onChange={(event) => setCreditRateInput(event.target.value.replace(/\D/g, ""))}
                    autoFocus
                  />
                </div>
                <small>Every Evoto Out entry is converted automatically using this rate.</small>
              </div>
              {errorMessage && <div className="spending-form-error">{errorMessage}</div>}
              <div className="spending-form-footer">
                <button type="button" className="spending-cancel" onClick={closeModal}>Cancel</button>
                <button type="submit" className="spending-save" disabled={saving}>{saving ? "Saving..." : "Save Rate"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalType && modalType !== "settings" && (

        <div className="spending-overlay">


          <div className="spending-form-box">


            <div className="spending-form-header">

              <div>

                <div className="spending-form-kicker">

                  {modalType ===
                  "edit"
                    ? "EDIT TRANSACTION"
                    : getSpendingCategory(activeCategory).kicker}

                </div>


                <h2>

                  {modalType ===
                  "edit"
                    ? "Edit Transaction"
                    : "Add Transaction"}

                </h2>


                <p>

                  Add or update a {activeCategory.toLowerCase()} transaction.

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


                {activeCategory === "Evoto Balance" && (
                  <div className="spending-field">
                    <label>TYPE</label>
                    <select name="evoto_direction" value={formData.evoto_direction} onChange={handleChange}>
                      <option value="In">Credit In</option>
                      <option value="Out">Credit Out</option>
                    </select>
                  </div>
                )}

                {activeCategory === "Evoto Balance" && (
                  <div className="spending-field">
                    <label>CREDITS</label>
                    <input
                      type="text"
                      name="evoto_credits"
                      inputMode="decimal"
                      pattern="[0-9]+([,.][0-9]{0,2})?"
                      placeholder="0"
                      value={formatCreditInput(formData.evoto_credits)}
                      onChange={handleCreditChange}
                      required
                    />
                  </div>
                )}

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


                {activeCategory !== "Evoto Balance" ? (
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
                        "Studio Expenses" ||
                      activeCategory ===
                        "Attire / Background"
                    }
                  />

                </div>
                ) : (
                  <div className="spending-field spending-calculated-value">
                    <label>AUTOMATIC VALUE</label>
                    <strong>{formatRupiah(calculateEvotoAmount(formData.evoto_credits, evotoCreditRate))}</strong>
                    <small>{formatRupiah(evotoCreditRate)} per credit</small>
                  </div>
                )}


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
