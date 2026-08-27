import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import "./Bookkeeping.css";


/* =========================================================
   FORMAT RUPIAH
========================================================= */

function formatRupiah(value) {
  const number = Number(value || 0);

  return `Rp ${number.toLocaleString("id-ID")}`;
}


/* =========================================================
   FORMAT NUMBER INPUT
========================================================= */

function formatNumberInput(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  const numericValue = String(value)
    .replace(/\D/g, "");

  if (!numericValue) {
    return "";
  }

  return Number(
    numericValue
  ).toLocaleString("id-ID");
}


/* =========================================================
   PARSE NUMBER INPUT
========================================================= */

function parseNumberInput(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  return Number(
    String(value).replace(/\D/g, "")
  ) || 0;
}


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(date) {
  if (!date) return "-";

  const parts = date.split("-");

  if (parts.length !== 3) {
    return date;
  }

  const [
    year,
    month,
    day,
  ] = parts;

  const months = [
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

  return `${day} ${
    months[
      Number(month) - 1
    ] || month
  } ${year}`;
}


/* =========================================================
   TODAY
========================================================= */

function getTodayString() {
  const today = new Date();

  return `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
}


/* =========================================================
   FIRST DAY OF CURRENT MONTH
========================================================= */

function getFirstDayOfCurrentMonth() {
  const today = new Date();

  return `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-01`;
}


/* =========================================================
   DEFAULT SETTINGS
========================================================= */

const defaultSettings = {
  salary: 0,
  thr_bonus: 0,
  freelance: 0,
  cash_adjustment: 0,
  collaboration_cost: 0,

  qris_mdr_percentage: 0,

  other_expenses: [
    {
      id: Date.now(),
      name: "",
      amount: 0,
      information: "",
    },
  ],

  bep_percentage: 20,

  distributions: [
    {
      name: "Raden",
      percentage: 50,
    },
    {
      name: "Kakak",
      percentage: 50,
    },
  ],
};


/* =========================================================
   SAFE SETTINGS
========================================================= */

function normalizeSettings(rawSettings) {
  const raw =
    rawSettings || {};

  let otherExpenses =
    Array.isArray(
      raw.other_expenses
    )
      ? raw.other_expenses
      : [];

  /*
    Compatibility dengan laporan lama
    yang masih menggunakan other_expense.
  */

  if (
    otherExpenses.length === 0 &&
    Number(raw.other_expense || 0) > 0
  ) {
    otherExpenses = [
      {
        id: `legacy-${Date.now()}`,
        name: "Other Expense",
        amount: Number(
          raw.other_expense || 0
        ),
        information: "",
      },
    ];
  }

  return {
    salary:
      Number(raw.salary || 0),

    thr_bonus:
      Number(raw.thr_bonus || 0),

    freelance:
      Number(raw.freelance || 0),

    cash_adjustment:
      Number(
        raw.cash_adjustment || 0
      ),

    collaboration_cost:
      Number(
        raw.collaboration_cost || 0
      ),

    qris_mdr_percentage:
      Number(
        raw.qris_mdr_percentage || 0
      ),

    other_expenses:
      otherExpenses.map(
        (item, index) => ({
          id:
            item.id ||
            `other-${index}-${Date.now()}`,

          name:
            item.name || "",

          amount:
            Number(item.amount || 0),

          information:
            item.information || "",
        })
      ),

    bep_percentage:
      Number(
        raw.bep_percentage ?? 20
      ),

    distributions:
      Array.isArray(
        raw.distributions
      )
        ? raw.distributions
        : [
            {
              name: "Raden",
              percentage: 50,
            },
            {
              name: "Kakak",
              percentage: 50,
            },
          ],
  };
}


/* =========================================================
   BOOKKEEPING
========================================================= */

function Bookkeeping() {

  /* =======================================================
     REPORTS
  ======================================================= */

  const [
    reports,
    setReports,
  ] = useState([]);


  /* =======================================================
     SPENDING
  ======================================================= */

  const [
    spending,
    setSpending,
  ] = useState([]);


  /* =======================================================
     TRANSACTIONS
  ======================================================= */

  const [
    transactions,
    setTransactions,
  ] = useState([]);


  /* =======================================================
     LOADING
  ======================================================= */

  const [
    loading,
    setLoading,
  ] = useState(true);


  /* =======================================================
     GENERATING
  ======================================================= */

  const [
    generating,
    setGenerating,
  ] = useState(false);


  /* =======================================================
     DELETING
  ======================================================= */

  const [
    deletingReportId,
    setDeletingReportId,
  ] = useState(null);


  /* =======================================================
     ERROR
  ======================================================= */

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  /* =======================================================
     SETTINGS MODAL
  ======================================================= */

  const [
    showSettings,
    setShowSettings,
  ] = useState(false);


  /* =======================================================
     ADDITIONAL EXPENSE MODAL
  ======================================================= */

  const [
    showAdditionalExpense,
    setShowAdditionalExpense,
  ] = useState(false);


  /* =======================================================
     DATE
  ======================================================= */

  const [
    fromDate,
    setFromDate,
  ] = useState(
    getFirstDayOfCurrentMonth()
  );


  const [
    toDate,
    setToDate,
  ] = useState(
    getTodayString()
  );


  /* =======================================================
     SETTINGS
  ======================================================= */

  const [
    settings,
    setSettings,
  ] = useState(
    defaultSettings
  );


  /* =======================================================
     ADDITIONAL EXPENSES
  ======================================================= */

  const [
    additionalExpenses,
    setAdditionalExpenses,
  ] = useState([]);


  const [
    additionalExpenseForm,
    setAdditionalExpenseForm,
  ] = useState({
    name: "",
    amount: "",
    information: "",
  });


  /* =======================================================
     LOAD DATA
  ======================================================= */

  useEffect(() => {
    fetchData();
  }, []);


  /* =======================================================
     FETCH DATA
  ======================================================= */

  const fetchData = async () => {

    setLoading(true);
    setErrorMessage("");


    /* =====================================================
       SPENDING
    ===================================================== */

    const {
      data: spendingData,
      error: spendingError,
    } = await supabase
      .from("spending")
      .select("*")
      .order(
        "date",
        {
          ascending: false,
        }
      );


    if (spendingError) {

      console.error(
        "BOOKKEEPING SPENDING ERROR:",
        spendingError
      );

      setErrorMessage(
        `Failed to load spending data: ${spendingError.message}`
      );

    } else {

      setSpending(
        spendingData || []
      );

    }


    /* =====================================================
       TRANSACTIONS
    ===================================================== */

    const {
      data: transactionData,
      error: transactionError,
    } = await supabase
      .from("transactions")
      .select("*")
      .order(
        "transaction_date",
        {
          ascending: false,
        }
      );


    if (transactionError) {

      console.error(
        "BOOKKEEPING TRANSACTION ERROR:",
        transactionError
      );

      setErrorMessage(
        `Failed to load transaction data: ${transactionError.message}`
      );

    } else {

      setTransactions(
        transactionData || []
      );

    }


    /* =====================================================
       REPORTS
    ===================================================== */

    const {
      data: reportData,
      error: reportError,
    } = await supabase
      .from("bookkeeping_reports")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false,
        }
      );


    if (reportError) {

      console.error(
        "BOOKKEEPING REPORT ERROR:",
        reportError
      );

      setErrorMessage(
        `Failed to load reports: ${reportError.message}`
      );

    } else {

      setReports(
        reportData || []
      );

    }


    setLoading(false);
  };


  /* =======================================================
     FILTER SPENDING
  ======================================================= */

  const filteredSpending =
    useMemo(() => {

      if (
        !fromDate ||
        !toDate
      ) {
        return [];
      }

      return spending.filter(
        (item) => {

          if (!item.date) {
            return false;
          }

          return (
            item.date >= fromDate &&
            item.date <= toDate
          );

        }
      );

    }, [
      spending,
      fromDate,
      toDate,
    ]);


  /* =======================================================
     FILTER TRANSACTIONS
  ======================================================= */

  const filteredTransactions =
    useMemo(() => {

      if (
        !fromDate ||
        !toDate
      ) {
        return [];
      }

      return transactions.filter(
        (item) => {

          if (
            !item.transaction_date
          ) {
            return false;
          }

          return (
            item.transaction_date >=
              fromDate &&
            item.transaction_date <=
              toDate
          );

        }
      );

    }, [
      transactions,
      fromDate,
      toDate,
    ]);


  /* =======================================================
     SPENDING TOTAL
  ======================================================= */

  const spendingTotal =
    filteredSpending.reduce(
      (
        total,
        item
      ) => {

        return (
          total +
          Number(
            item.amount ||
              item.total ||
              item.cost ||
              0
          )
        );

      },
      0
    );


  /* =======================================================
     ADDITIONAL EXPENSE TOTAL
  ======================================================= */

  const additionalExpenseTotal =
    additionalExpenses.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.amount || 0
        ),
      0
    );


  /* =======================================================
     OTHER EXPENSE TOTAL
  ======================================================= */

  const otherExpensesTotal =
    settings.other_expenses.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.amount || 0
        ),
      0
    );


  /* =======================================================
     FIXED OTHER EXPENSE TOTAL
  ======================================================= */

  const fixedExpenseTotal =
    Number(
      settings.salary || 0
    ) +
    Number(
      settings.thr_bonus || 0
    ) +
    Number(
      settings.freelance || 0
    ) +
    Number(
      settings.cash_adjustment || 0
    ) +
    Number(
      settings.collaboration_cost || 0
    );


  /* =======================================================
     GROSS REVENUE
  ======================================================= */

  const grossRevenue =
    filteredTransactions.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.amount || 0
        ),
      0
    );


  /* =======================================================
     DETECT QRIS TRANSACTION
  ======================================================= */

  const isQrisTransaction = (
    transaction
  ) => {

    const possibleValues = [
      transaction.payment_method,
      transaction.payment_type,
      transaction.method,
      transaction.payment,
      transaction.channel,
    ];

    return possibleValues.some(
      (value) =>
        String(
          value || ""
        )
          .toLowerCase()
          .includes("qris")
    );

  };


  /* =======================================================
     QRIS GROSS REVENUE
  ======================================================= */

  const qrisGrossRevenue =
    filteredTransactions
      .filter(
        isQrisTransaction
      )
      .reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.amount || 0
          ),
        0
      );


  /* =======================================================
     CASH / NON QRIS REVENUE
  ======================================================= */

  const nonQrisRevenue =
    grossRevenue -
    qrisGrossRevenue;


  /* =======================================================
     QRIS MDR
  ======================================================= */

  const qrisMdrPercentage =
    Number(
      settings.qris_mdr_percentage ||
        0
    );


  const qrisMdrAmount =
    Math.round(
      qrisGrossRevenue *
      (
        qrisMdrPercentage /
        100
      )
    );


  /* =======================================================
     NET REVENUE
  ======================================================= */

  const netRevenue =
    grossRevenue -
    qrisMdrAmount;


  /* =======================================================
     TOTAL EXPENSE
  ======================================================= */

  const totalExpense =
    spendingTotal +
    additionalExpenseTotal +
    fixedExpenseTotal +
    otherExpensesTotal;


  /* =======================================================
     NET PROFIT
  ======================================================= */

  const netProfit =
    netRevenue -
    totalExpense;


  /* =======================================================
     BEP
  ======================================================= */

  const bepPercentage =
    Number(
      settings.bep_percentage || 0
    );


  const bepAmount =
    Math.round(
      netProfit *
      (
        bepPercentage /
        100
      )
    );


  const profitAfterBep =
    netProfit -
    bepAmount;


  /* =======================================================
     DISTRIBUTION PERCENTAGE
  ======================================================= */

  const distributionPercentage =
    settings.distributions.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.percentage || 0
        ),
      0
    );


  /* =======================================================
     DISTRIBUTION RESULT
  ======================================================= */

  const distributionResult =
    settings.distributions.map(
      (
        item
      ) => {

        const percentage =
          Number(
            item.percentage || 0
          );

        const amount =
          Math.round(
            profitAfterBep *
            (
              percentage /
              100
            )
          );

        return {
          ...item,
          amount,
        };

      }
    );


  /* =======================================================
     DATE VALIDATION
  ======================================================= */

  const dateIsValid =
    fromDate &&
    toDate &&
    fromDate <= toDate;


  /* =======================================================
     ADDITIONAL EXPENSE CHANGE
  ======================================================= */

  const handleAdditionalExpenseChange =
    (event) => {

      const {
        name,
        value,
      } = event.target;

      setAdditionalExpenseForm(
        (
          current
        ) => ({
          ...current,
          [name]: value,
        })
      );

    };


  /* =======================================================
     ADDITIONAL EXPENSE AMOUNT
  ======================================================= */

  const handleAdditionalAmountChange =
    (event) => {

      const numericValue =
        event.target.value.replace(
          /\D/g,
          ""
        );

      setAdditionalExpenseForm(
        (
          current
        ) => ({
          ...current,
          amount:
            numericValue,
        })
      );

    };


  /* =======================================================
     ADD ADDITIONAL EXPENSE
  ======================================================= */

  const handleAddAdditionalExpense =
    (event) => {

      event.preventDefault();

      const name =
        additionalExpenseForm.name.trim();

      const amount =
        Number(
          additionalExpenseForm.amount ||
            0
        );


      if (
        !name ||
        amount <= 0
      ) {
        return;
      }


      setAdditionalExpenses(
        (
          current
        ) => [
          ...current,
          {
            id:
              `additional-${Date.now()}`,

            name,

            amount,

            information:
              additionalExpenseForm.information.trim(),
          },
        ]
      );


      setAdditionalExpenseForm({
        name: "",
        amount: "",
        information: "",
      });


      setShowAdditionalExpense(
        false
      );

    };


  /* =======================================================
     DELETE ADDITIONAL EXPENSE
  ======================================================= */

  const handleDeleteAdditionalExpense =
    (id) => {

      setAdditionalExpenses(
        (
          current
        ) =>
          current.filter(
            (item) =>
              item.id !== id
          )
      );

    };


  /* =======================================================
     SETTINGS CHANGE
  ======================================================= */

  const handleSettingChange =
    (event) => {

      const {
        name,
        value,
      } = event.target;

      setSettings(
        (
          current
        ) => ({
          ...current,
          [name]:
            parseNumberInput(
              value
            ),
        })
      );

    };


  /* =======================================================
     PERCENTAGE SETTING CHANGE
  ======================================================= */

  const handlePercentageSettingChange =
    (event) => {

      const {
        name,
        value,
      } = event.target;

      setSettings(
        (
          current
        ) => ({
          ...current,
          [name]:
            value,
        })
      );

    };


  /* =======================================================
     OTHER EXPENSE CHANGE
  ======================================================= */

  const handleOtherExpenseChange =
    (
      index,
      field,
      value
    ) => {

      setSettings(
        (
          current
        ) => {

          const updated =
            [
              ...current.other_expenses,
            ];

          updated[index] = {
            ...updated[index],
            [field]:
              field === "amount"
                ? parseNumberInput(
                    value
                  )
                : value,
          };

          return {
            ...current,
            other_expenses:
              updated,
          };

        }
      );

    };


  /* =======================================================
     ADD OTHER EXPENSE
  ======================================================= */

  const addOtherExpense =
    () => {

      setSettings(
        (
          current
        ) => ({
          ...current,

          other_expenses: [
            ...current.other_expenses,
            {
              id:
                `other-${Date.now()}`,

              name: "",

              amount: 0,

              information: "",
            },
          ],
        })
      );

    };


  /* =======================================================
     DELETE OTHER EXPENSE
  ======================================================= */

  const deleteOtherExpense =
    (index) => {

      setSettings(
        (
          current
        ) => ({
          ...current,

          other_expenses:
            current.other_expenses.filter(
              (
                _,
                itemIndex
              ) =>
                itemIndex !== index
            ),
        })
      );

    };


  /* =======================================================
     DISTRIBUTION CHANGE
  ======================================================= */

  const handleDistributionChange =
    (
      index,
      field,
      value
    ) => {

      setSettings(
        (
          current
        ) => {

          const updated =
            [
              ...current.distributions,
            ];

          updated[index] = {
            ...updated[index],
            [field]:
              field ===
              "percentage"
                ? value
                : value,
          };

          return {
            ...current,
            distributions:
              updated,
          };

        }
      );

    };


  /* =======================================================
     ADD DISTRIBUTION
  ======================================================= */

  const addDistribution =
    () => {

      setSettings(
        (
          current
        ) => ({
          ...current,

          distributions: [
            ...current.distributions,
            {
              name: "",
              percentage: 0,
            },
          ],
        })
      );

    };


  /* =======================================================
     DELETE DISTRIBUTION
  ======================================================= */

  const deleteDistribution =
    (index) => {

      setSettings(
        (
          current
        ) => ({
          ...current,

          distributions:
            current.distributions.filter(
              (
                _,
                itemIndex
              ) =>
                itemIndex !== index
            ),
        })
      );

    };


  /* =======================================================
     GENERATE REPORT
  ======================================================= */

  const generateReport =
    async () => {

      setErrorMessage("");


      if (!dateIsValid) {

        setErrorMessage(
          "Please select a valid From and To date."
        );

        return;
      }


      if (
        Math.round(
          distributionPercentage
        ) !== 100
      ) {

        setErrorMessage(
          "Profit distribution must total exactly 100%."
        );

        setShowSettings(true);

        return;
      }


      setGenerating(true);


      try {

        const reportTitle =
          `Financial Report — ${formatDate(
            fromDate
          )} to ${formatDate(
            toDate
          )}`;


        const settingsData = {

          salary:
            Number(
              settings.salary || 0
            ),

          thr_bonus:
            Number(
              settings.thr_bonus || 0
            ),

          freelance:
            Number(
              settings.freelance || 0
            ),

          cash_adjustment:
            Number(
              settings.cash_adjustment ||
                0
            ),

          collaboration_cost:
            Number(
              settings.collaboration_cost ||
                0
            ),

          qris_mdr_percentage:
            Number(
              settings.qris_mdr_percentage ||
                0
            ),

          other_expenses:
            settings.other_expenses.map(
              (item) => ({
                id:
                  item.id,

                name:
                  item.name,

                amount:
                  Number(
                    item.amount || 0
                  ),

                information:
                  item.information ||
                  "",
              })
            ),

          additional_expenses:
            additionalExpenses.map(
              (item) => ({
                id:
                  item.id,

                name:
                  item.name,

                amount:
                  Number(
                    item.amount || 0
                  ),

                information:
                  item.information ||
                  "",
              })
            ),

          spending_items:
            filteredSpending,

          transaction_items:
            filteredTransactions,
        };


        const distributionData =
          distributionResult.map(
            (
              item
            ) => ({
              name:
                item.name,

              percentage:
                Number(
                  item.percentage || 0
                ),

              amount:
                item.amount,
            })
          );


        const reportData = {

          report_title:
            reportTitle,

          start_date:
            fromDate,

          end_date:
            toDate,

          bep_percentage:
            bepPercentage,

          /*
            total_revenue menyimpan NET REVENUE
            karena ini adalah pendapatan yang
            benar-benar masuk setelah MDR.
          */

          total_revenue:
            netRevenue,

          total_income:
            grossRevenue,

          total_expense:
            totalExpense,

          net_profit:
            netProfit,

          bep_amount:
            bepAmount,

          profit_after_bep:
            profitAfterBep,

          distribution_total_percentage:
            distributionPercentage,

          distribution_data:
            distributionData,

          settings_data:
            {
              ...settingsData,

              revenue_summary: {
                gross_revenue:
                  grossRevenue,

                qris_gross_revenue:
                  qrisGrossRevenue,

                non_qris_revenue:
                  nonQrisRevenue,

                qris_mdr_percentage:
                  qrisMdrPercentage,

                qris_mdr_amount:
                  qrisMdrAmount,

                net_revenue:
                  netRevenue,
              },
            },
        };


        const {
          data,
          error,
        } = await supabase
          .from(
            "bookkeeping_reports"
          )
          .insert([
            reportData,
          ])
          .select()
          .single();


        if (error) {
          throw error;
        }


        setReports(
          (
            current
          ) => [
            data,
            ...current,
          ]
        );


        setErrorMessage("");


      } catch (error) {

        console.error(
          "GENERATE BOOKKEEPING ERROR:",
          error
        );

        setErrorMessage(
          `Failed to create report: ${error.message}`
        );

      } finally {

        setGenerating(false);

      }

    };


  /* =======================================================
     DELETE REPORT
  ======================================================= */

  const deleteReport =
    async (reportId) => {

      const confirmed =
        window.confirm(
          "Delete this financial report?\n\nThis action cannot be undone."
        );


      if (!confirmed) {
        return;
      }


      setDeletingReportId(
        reportId
      );

      setErrorMessage("");


      try {

        const {
          error,
        } = await supabase
          .from(
            "bookkeeping_reports"
          )
          .delete()
          .eq(
            "id",
            reportId
          );


        if (error) {
          throw error;
        }


        setReports(
          (
            current
          ) =>
            current.filter(
              (report) =>
                report.id !==
                reportId
            )
        );


      } catch (error) {

        console.error(
          "DELETE BOOKKEEPING REPORT ERROR:",
          error
        );

        setErrorMessage(
          `Failed to delete report: ${error.message}`
        );

      } finally {

        setDeletingReportId(
          null
        );

      }

    };


  /* =======================================================
     PDF
  ======================================================= */

  const downloadPDF =
    (report) => {

      const distribution =
        report.distribution_data ||
        [];


      const storedSettings =
        normalizeSettings(
          report.settings_data
        );


      const revenueSummary =
        report
          .settings_data
          ?.revenue_summary ||
        {
          gross_revenue:
            Number(
              report.total_income ||
                0
            ),

          qris_gross_revenue:
            0,

          non_qris_revenue:
            Number(
              report.total_income ||
                0
            ),

          qris_mdr_percentage:
            0,

          qris_mdr_amount:
            0,

          net_revenue:
            Number(
              report.total_revenue ||
                0
            ),
        };


      const additional =
        storedSettings.additional_expenses ||
        [];


      const otherExpenses =
        storedSettings.other_expenses ||
        [];


      const spendingItems =
        storedSettings.spending_items ||
        [];


      const transactionItems =
        storedSettings.transaction_items ||
        [];


      const escapeHTML =
        (value) =>
          String(
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


      const reportHTML = `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>
${escapeHTML(
  report.report_title ||
    "Financial Report"
)}
</title>

<style>

@page {
  size: A4;
  margin: 18mm;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family:
    Arial,
    Helvetica,
    sans-serif;
  color: #111;
  background: #fff;
  font-size: 10px;
  line-height: 1.45;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 18px;
  border-bottom: 1px solid #111;
}

.brand {
  font-size: 10px;
  letter-spacing: 2px;
  font-weight: 600;
}

.document-type {
  margin-top: 7px;
  font-size: 23px;
  font-weight: 400;
  letter-spacing: -0.5px;
}

.document-period {
  margin-top: 7px;
  color: #666;
  font-size: 9px;
}

.header-right {
  text-align: right;
}

.header-right .label {
  color: #888;
  font-size: 7px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

.header-right .value {
  margin-top: 4px;
  font-size: 9px;
}

.intro {
  margin-top: 16px;
  color: #666;
  font-size: 9px;
}

.section {
  margin-top: 25px;
}

.section-title {
  margin-bottom: 10px;
  padding-bottom: 7px;
  border-bottom: 1px solid #ccc;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

.subsection {
  margin-top: 15px;
}

.subsection-title {
  margin-bottom: 7px;
  font-size: 9px;
  font-weight: 600;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  padding: 7px 6px;
  border-bottom: 1px solid #aaa;
  color: #666;
  font-size: 7px;
  font-weight: 500;
  letter-spacing: 1px;
  text-align: left;
  text-transform: uppercase;
}

td {
  padding: 7px 6px;
  border-bottom: 1px solid #e2e2e2;
  vertical-align: top;
  font-size: 9px;
}

.amount {
  text-align: right;
  white-space: nowrap;
}

.summary {
  margin-top: 10px;
  border-top: 1px solid #111;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 8px 0;
  border-bottom: 1px solid #ddd;
}

.summary-row.total {
  border-bottom: 2px solid #111;
  font-weight: 600;
}

.summary-row.highlight {
  padding: 11px 0;
  font-size: 12px;
  font-weight: 600;
}

.muted {
  color: #777;
}

.empty {
  color: #888;
  font-style: italic;
}

.footer {
  margin-top: 35px;
  padding-top: 12px;
  border-top: 1px solid #ccc;
  color: #777;
  font-size: 8px;
}

.footer strong {
  color: #333;
  font-weight: 500;
}

.page-break {
  page-break-before: always;
}

</style>

</head>

<body>


<div class="header">

  <div>

    <div class="brand">
      PLUNO STUDIO
    </div>

    <div class="document-type">
      Financial Report
    </div>

    <div class="document-period">
      ${formatDate(
        report.start_date
      )}
      —
      ${formatDate(
        report.end_date
      )}
    </div>

  </div>


  <div class="header-right">

    <div class="label">
      Document
    </div>

    <div class="value">
      ${escapeHTML(
        report.report_title ||
          "Financial Report"
      )}
    </div>

  </div>

</div>


<div class="intro">
  Laporan ini disusun untuk kebutuhan internal Pluno Studio.
</div>


<!-- =====================================================
     REVENUE
===================================================== -->

<div class="section">

  <div class="section-title">
    01 · Revenue
  </div>


  <div class="summary">

    <div class="summary-row">

      <span>
        Gross Revenue
      </span>

      <strong>
        ${formatRupiah(
          revenueSummary.gross_revenue
        )}
      </strong>

    </div>


    <div class="summary-row">

      <span>
        QRIS Revenue
      </span>

      <strong>
        ${formatRupiah(
          revenueSummary.qris_gross_revenue
        )}
      </strong>

    </div>


    <div class="summary-row">

      <span>
        Non-QRIS Revenue
      </span>

      <strong>
        ${formatRupiah(
          revenueSummary.non_qris_revenue
        )}
      </strong>

    </div>


    <div class="summary-row">

      <span>
        QRIS MDR
        <span class="muted">
          (${Number(
            revenueSummary.qris_mdr_percentage ||
              0
          )}%)
        </span>
      </span>

      <strong>
        -
        ${formatRupiah(
          revenueSummary.qris_mdr_amount
        )}
      </strong>

    </div>


    <div class="summary-row total">

      <span>
        Net Revenue
      </span>

      <strong>
        ${formatRupiah(
          revenueSummary.net_revenue
        )}
      </strong>

    </div>

  </div>

</div>


<!-- =====================================================
     EXPENSES
===================================================== -->

<div class="section">

  <div class="section-title">
    02 · Expenses
  </div>


  <!-- STUDIO EXPENSES -->

  <div class="subsection">

    <div class="subsection-title">
      Studio Expenses
    </div>

    <table>

      <thead>

        <tr>

          <th>
            Date
          </th>

          <th>
            Description
          </th>

          <th class="amount">
            Amount
          </th>

        </tr>

      </thead>

      <tbody>

        ${
          spendingItems.length
            ? spendingItems
                .map(
                  (item) => `
                    <tr>

                      <td>
                        ${formatDate(
                          item.date
                        )}
                      </td>

                      <td>
                        ${escapeHTML(
                          item.description ||
                            item.name ||
                            "-"
                        )}
                      </td>

                      <td class="amount">
                        ${formatRupiah(
                          item.amount ||
                            item.total ||
                            item.cost ||
                            0
                        )}
                      </td>

                    </tr>
                  `
                )
                .join("")
            : `
              <tr>
                <td colspan="3" class="empty">
                  No studio expenses recorded.
                </td>
              </tr>
            `
        }

      </tbody>

    </table>

  </div>


  <!-- ADDITIONAL EXPENSES -->

  <div class="subsection">

    <div class="subsection-title">
      Additional Expenses
    </div>

    <table>

      <thead>

        <tr>

          <th>
            Description
          </th>

          <th>
            Information
          </th>

          <th class="amount">
            Amount
          </th>

        </tr>

      </thead>

      <tbody>

        ${
          additional.length
            ? additional
                .map(
                  (item) => `
                    <tr>

                      <td>
                        ${escapeHTML(
                          item.name
                        )}
                      </td>

                      <td>
                        ${escapeHTML(
                          item.information ||
                            "-"
                        )}
                      </td>

                      <td class="amount">
                        ${formatRupiah(
                          item.amount
                        )}
                      </td>

                    </tr>
                  `
                )
                .join("")
            : `
              <tr>
                <td colspan="3" class="empty">
                  No additional expenses recorded.
                </td>
              </tr>
            `
        }

      </tbody>

    </table>

  </div>


  <!-- OTHER EXPENSES -->

  <div class="subsection">

    <div class="subsection-title">
      Other Expenses
    </div>

    <table>

      <thead>

        <tr>

          <th>
            Description
          </th>

          <th>
            Information
          </th>

          <th class="amount">
            Amount
          </th>

        </tr>

      </thead>

      <tbody>

        ${
          otherExpenses.length &&
          otherExpenses.some(
            (item) =>
              item.name ||
              Number(
                item.amount || 0
              ) > 0
          )
            ? otherExpenses
                .filter(
                  (item) =>
                    item.name ||
                    Number(
                      item.amount || 0
                    ) > 0
                )
                .map(
                  (item) => `
                    <tr>

                      <td>
                        ${escapeHTML(
                          item.name ||
                            "-"
                        )}
                      </td>

                      <td>
                        ${escapeHTML(
                          item.information ||
                            "-"
                        )}
                      </td>

                      <td class="amount">
                        ${formatRupiah(
                          item.amount
                        )}
                      </td>

                    </tr>
                  `
                )
                .join("")
            : `
              <tr>
                <td colspan="3" class="empty">
                  No other expenses recorded.
                </td>
              </tr>
            `
        }

      </tbody>

    </table>

  </div>


  <!-- FIXED EXPENSES -->

  <div class="subsection">

    <div class="subsection-title">
      Operational & Personnel Expenses
    </div>

    <table>

      <tbody>

        <tr>

          <td>
            Salary
          </td>

          <td class="amount">
            ${formatRupiah(
              storedSettings.salary
            )}
          </td>

        </tr>


        <tr>

          <td>
            THR & Bonus
          </td>

          <td class="amount">
            ${formatRupiah(
              storedSettings.thr_bonus
            )}
          </td>

        </tr>


        <tr>

          <td>
            Freelance
          </td>

          <td class="amount">
            ${formatRupiah(
              storedSettings.freelance
            )}
          </td>

        </tr>


        <tr>

          <td>
            Cash Adjustment
          </td>

          <td class="amount">
            ${formatRupiah(
              storedSettings.cash_adjustment
            )}
          </td>

        </tr>


        <tr>

          <td>
            Collaboration Cost
          </td>

          <td class="amount">
            ${formatRupiah(
              storedSettings.collaboration_cost
            )}
          </td>

        </tr>

      </tbody>

    </table>

  </div>


  <div class="summary">

    <div class="summary-row total">

      <span>
        Total Expenses
      </span>

      <strong>
        ${formatRupiah(
          report.total_expense
        )}
      </strong>

    </div>

  </div>

</div>


<!-- =====================================================
     PROFIT
===================================================== -->

<div class="section">

  <div class="section-title">
    03 · Profit
  </div>


  <div class="summary">

    <div class="summary-row highlight">

      <span>
        Net Profit
      </span>

      <strong>
        ${formatRupiah(
          report.net_profit
        )}
      </strong>

    </div>

  </div>

</div>


<!-- =====================================================
     BEP
===================================================== -->

<div class="section">

  <div class="section-title">
    04 · BEP Allocation
  </div>


  <div class="summary">

    <div class="summary-row">

      <span>
        BEP Allocation
      </span>

      <strong>
        ${report.bep_percentage}%
      </strong>

    </div>


    <div class="summary-row">

      <span>
        BEP Amount
      </span>

      <strong>
        ${formatRupiah(
          report.bep_amount
        )}
      </strong>

    </div>


    <div class="summary-row highlight">

      <span>
        Profit After BEP
      </span>

      <strong>
        ${formatRupiah(
          report.profit_after_bep
        )}
      </strong>

    </div>

  </div>

</div>


<!-- =====================================================
     DISTRIBUTION
===================================================== -->

<div class="section">

  <div class="section-title">
    05 · Profit Distribution
  </div>


  <table>

    <thead>

      <tr>

        <th>
          Name
        </th>

        <th>
          Percentage
        </th>

        <th class="amount">
          Amount
        </th>

      </tr>

    </thead>


    <tbody>

      ${
        distribution.length
          ? distribution
              .map(
                (item) => `
                  <tr>

                    <td>
                      ${escapeHTML(
                        item.name
                      )}
                    </td>

                    <td>
                      ${Number(
                        item.percentage ||
                          0
                      )}%
                    </td>

                    <td class="amount">
                      ${formatRupiah(
                        item.amount
                      )}
                    </td>

                  </tr>
                `
              )
              .join("")
          : `
            <tr>
              <td colspan="3" class="empty">
                No profit distribution recorded.
              </td>
            </tr>
          `
      }

    </tbody>

  </table>

</div>


<div class="footer">

  <strong>
    PLUNO STUDIO
  </strong>

  <br>

  Dokumen ini disusun untuk kebutuhan internal
  Pluno Studio dan tidak diperuntukkan sebagai
  dokumen publik.

</div>


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
          "Browser blocked the PDF window. Please allow popups for this site."
        );

        return;

      }


      printWindow.document.write(
        reportHTML
      );

      printWindow.document.close();

      printWindow.focus();


      setTimeout(() => {

        printWindow.print();

      }, 500);

    };


  /* =======================================================
     RENDER
  ======================================================= */

  return (

    <div className="bookkeeping-page">

      <Sidebar
        activePage="bookkeeping"
      />


      <main className="bookkeeping-main">


        {/* =================================================
            HEADER
        ================================================= */}

        <header className="bookkeeping-header">

          <div>

            <div className="bookkeeping-eyebrow">
              PLUNO STUDIO · FINANCIAL
            </div>

            <h1>
              Bookkeeping
            </h1>

            <p>
              Generate and manage financial reports.
            </p>

          </div>

        </header>


        {/* =================================================
            GENERATOR
        ================================================= */}

        <section className="bookkeeping-generator">

          <div className="bookkeeping-generator-top">

            <div>

              <div className="bookkeeping-section-label">
                REPORT PERIOD
              </div>

              <h2>
                Generate Financial Report
              </h2>

            </div>


            <button
              type="button"
              className="bookkeeping-settings-button"
              onClick={() =>
                setShowSettings(true)
              }
              aria-label="Settings"
            >
              ⚙
            </button>

          </div>


          {/* =================================================
              ONLY FROM / TO
          ================================================= */}

          <div
            className="bookkeeping-period-grid"
            style={{
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
            }}
          >

            <div className="bookkeeping-field">

              <label>
                FROM
              </label>

              <input
                type="date"
                value={
                  fromDate
                }
                onChange={(
                  event
                ) =>
                  setFromDate(
                    event.target.value
                  )
                }
              />

            </div>


            <div className="bookkeeping-field">

              <label>
                TO
              </label>

              <input
                type="date"
                value={
                  toDate
                }
                onChange={(
                  event
                ) =>
                  setToDate(
                    event.target.value
                  )
                }
              />

            </div>

          </div>


          <div className="bookkeeping-generator-footer">

            <div>

              <span>
                CURRENT PERIOD
              </span>

              <strong>

                {formatDate(
                  fromDate
                )}

                {" "}
                —
                {" "}

                {formatDate(
                  toDate
                )}

              </strong>

            </div>


            <button
              type="button"
              className="bookkeeping-generate-button"
              onClick={
                generateReport
              }
              disabled={
                generating ||
                !dateIsValid
              }
            >

              {generating
                ? "Generating..."
                : "Generate Report"}

            </button>

          </div>

        </section>


        {/* =================================================
            ERROR
        ================================================= */}

        {errorMessage && (

          <div className="bookkeeping-error">
            {errorMessage}
          </div>

        )}


        {/* =================================================
            CURRENT DATA
        ================================================= */}

        <section className="bookkeeping-overview">

          <div className="bookkeeping-section-label">
            CURRENT DATA
          </div>


          <div className="bookkeeping-overview-grid">


            {/* GROSS REVENUE */}

            <div>

              <span>
                GROSS REVENUE
              </span>

              <strong>
                {formatRupiah(
                  grossRevenue
                )}
              </strong>

            </div>


            {/* NET REVENUE */}

            <div>

              <span>
                NET REVENUE
              </span>

              <strong>
                {formatRupiah(
                  netRevenue
                )}
              </strong>

            </div>


            {/* EXPENSE */}

            <div>

              <span>
                TOTAL EXPENSE
              </span>

              <strong>
                {formatRupiah(
                  totalExpense
                )}
              </strong>

            </div>


            {/* PROFIT */}

            <div>

              <span>
                NET PROFIT
              </span>

              <strong>
                {formatRupiah(
                  netProfit
                )}
              </strong>

            </div>


            {/* QRIS MDR */}

            <div>

              <span>
                QRIS MDR
              </span>

              <strong>
                {formatRupiah(
                  qrisMdrAmount
                )}
              </strong>

            </div>


            {/* QRIS REVENUE */}

            <div>

              <span>
                QRIS REVENUE
              </span>

              <strong>
                {formatRupiah(
                  qrisGrossRevenue
                )}
              </strong>

            </div>

          </div>

        </section>


        {/* =================================================
            ADDITIONAL EXPENSES
        ================================================= */}

        <section className="bookkeeping-additional">

          <div className="bookkeeping-card-header">

            <div>

              <span>
                ADDITIONAL EXPENSES
              </span>

              <h2>
                Additional Expenses
              </h2>

            </div>


            <button
              type="button"
              className="bookkeeping-add-button"
              onClick={() =>
                setShowAdditionalExpense(
                  true
                )
              }
            >
              + Add
            </button>

          </div>


          {additionalExpenses.length === 0 ? (

            <div className="bookkeeping-empty-small">
              No additional expenses added.
            </div>

          ) : (

            <div className="bookkeeping-additional-list">

              {additionalExpenses.map(
                (
                  item
                ) => (

                  <div
                    className="bookkeeping-additional-item"
                    key={
                      item.id
                    }
                  >

                    <div>

                      <strong>
                        {item.name}
                      </strong>

                      {item.information && (

                        <span>
                          {item.information}
                        </span>

                      )}

                    </div>


                    <div className="bookkeeping-additional-right">

                      <strong>
                        {formatRupiah(
                          item.amount
                        )}
                      </strong>


                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteAdditionalExpense(
                            item.id
                          )
                        }
                      >
                        Delete
                      </button>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </section>


        {/* =================================================
            REPORTS
        ================================================= */}

        <section className="bookkeeping-reports">

          <div className="bookkeeping-card-header">

            <div>

              <span>
                FINANCIAL REPORTS
              </span>

              <h2>
                Generated Reports
              </h2>

            </div>

          </div>


          {loading ? (

            <div className="bookkeeping-empty">
              Loading reports...
            </div>

          ) : reports.length === 0 ? (

            <div className="bookkeeping-empty">
              No financial reports generated yet.
            </div>

          ) : (

            <div className="bookkeeping-report-list">

              {reports.map(
                (
                  report
                ) => (

                  <div
                    className="bookkeeping-report-item"
                    key={
                      report.id
                    }
                  >

                    <div>

                      <span>
                        {formatDate(
                          report.start_date
                        )}

                        {" "}
                        —

                        {" "}

                        {formatDate(
                          report.end_date
                        )}
                      </span>

                      <h3>
                        {report.report_title ||
                          "Financial Report"}
                      </h3>

                    </div>


                    <div className="bookkeeping-report-meta">

                      <div>

                        <span>
                          NET PROFIT
                        </span>

                        <strong>
                          {formatRupiah(
                            report.net_profit
                          )}
                        </strong>

                      </div>


                      <button
                        type="button"
                        className="bookkeeping-download-button"
                        onClick={() =>
                          downloadPDF(
                            report
                          )
                        }
                      >
                        Download PDF
                      </button>


                      <button
                        type="button"
                        className="bookkeeping-download-button"
                        onClick={() =>
                          deleteReport(
                            report.id
                          )
                        }
                        disabled={
                          deletingReportId ===
                          report.id
                        }
                      >
                        {deletingReportId ===
                        report.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </section>


        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="bookkeeping-footer">

          <span>
            PLUNO INTERNAL SYSTEM
          </span>

          <span>
            v1.0 · 2026
          </span>

        </footer>

      </main>


      {/* =====================================================
          SETTINGS MODAL
      ===================================================== */}

      {showSettings && (

        <div
          className="bookkeeping-overlay"
          onMouseDown={(
            event
          ) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              setShowSettings(
                false
              );
            }

          }}
        >

          <div className="bookkeeping-modal">


            <div className="bookkeeping-modal-header">

              <div>

                <span>
                  REPORT SETTINGS
                </span>

                <h2>
                  Bookkeeping Settings
                </h2>

                <p>
                  Set expenses, QRIS MDR, BEP and profit distribution.
                </p>

              </div>


              <button
                type="button"
                className="bookkeeping-close"
                onClick={() =>
                  setShowSettings(
                    false
                  )
                }
              >
                ×
              </button>

            </div>


            <div className="bookkeeping-modal-body">


              {/* =================================================
                  OTHER EXPENSES
              ================================================= */}

              <div className="bookkeeping-settings-section">

                <div className="bookkeeping-settings-title">

                  <span>
                    EXPENSE SETTINGS
                  </span>

                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      gap: "15px",
                    }}
                  >

                    <h3>
                      Other Expenses
                    </h3>


                    <button
                      type="button"
                      className="bookkeeping-add-button"
                      onClick={
                        addOtherExpense
                      }
                    >
                      + Add
                    </button>

                  </div>

                </div>


                {/* =================================================
                    FIXED EXPENSES
                ================================================= */}

                <div className="bookkeeping-settings-grid">


                  {/* SALARY */}

                  <div className="bookkeeping-field">

                    <label>
                      SALARY
                    </label>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        formatNumberInput(
                          settings.salary
                        )
                      }
                      onChange={
                        handleSettingChange
                      }
                      name="salary"
                      placeholder="0"
                    />

                  </div>


                  {/* THR */}

                  <div className="bookkeeping-field">

                    <label>
                      THR & BONUS
                    </label>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        formatNumberInput(
                          settings.thr_bonus
                        )
                      }
                      onChange={
                        handleSettingChange
                      }
                      name="thr_bonus"
                      placeholder="0"
                    />

                  </div>


                  {/* FREELANCE */}

                  <div className="bookkeeping-field">

                    <label>
                      FREELANCE
                    </label>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        formatNumberInput(
                          settings.freelance
                        )
                      }
                      onChange={
                        handleSettingChange
                      }
                      name="freelance"
                      placeholder="0"
                    />

                  </div>


                  {/* CASH */}

                  <div className="bookkeeping-field">

                    <label>
                      CASH ADJUSTMENT
                    </label>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        formatNumberInput(
                          settings.cash_adjustment
                        )
                      }
                      onChange={
                        handleSettingChange
                      }
                      name="cash_adjustment"
                      placeholder="0"
                    />

                  </div>


                  {/* COLLABORATION */}

                  <div className="bookkeeping-field">

                    <label>
                      COLLABORATION COST
                    </label>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        formatNumberInput(
                          settings.collaboration_cost
                        )
                      }
                      onChange={
                        handleSettingChange
                      }
                      name="collaboration_cost"
                      placeholder="0"
                    />

                  </div>

                </div>


                {/* =================================================
                    OTHER EXPENSE LIST
                ================================================= */}

                <div
                  style={{
                    marginTop:
                      "18px",
                    display:
                      "flex",
                    flexDirection:
                      "column",
                    gap:
                      "10px",
                  }}
                >

                  {settings.other_expenses.length ===
                  0 ? (

                    <div className="bookkeeping-empty-small">
                      No other expenses added.
                    </div>

                  ) : (

                    settings.other_expenses.map(
                      (
                        item,
                        index
                      ) => (

                        <div
                          key={
                            item.id ||
                            index
                          }
                          style={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              "minmax(0, 1fr) minmax(130px, 170px) 35px",
                            gap:
                              "8px",
                          }}
                        >

                          <input
                            type="text"
                            value={
                              item.name
                            }
                            placeholder="Expense name"
                            onChange={(
                              event
                            ) =>
                              handleOtherExpenseChange(
                                index,
                                "name",
                                event.target.value
                              )
                            }
                            style={{
                              width:
                                "100%",
                              height:
                                "37px",
                              padding:
                                "9px 11px",
                              border:
                                "1px solid #292929",
                              outline:
                                "none",
                              background:
                                "#111",
                              color:
                                "#eee",
                              fontFamily:
                                "inherit",
                              fontSize:
                                "10px",
                            }}
                          />


                          <input
                            type="text"
                            inputMode="numeric"
                            value={
                              formatNumberInput(
                                item.amount
                              )
                            }
                            placeholder="0"
                            onChange={(
                              event
                            ) =>
                              handleOtherExpenseChange(
                                index,
                                "amount",
                                event.target.value
                              )
                            }
                            style={{
                              width:
                                "100%",
                              height:
                                "37px",
                              padding:
                                "9px 11px",
                              border:
                                "1px solid #292929",
                              outline:
                                "none",
                              background:
                                "#111",
                              color:
                                "#eee",
                              fontFamily:
                                "inherit",
                              fontSize:
                                "10px",
                              textAlign:
                                "right",
                            }}
                          />


                          <button
                            type="button"
                            onClick={() =>
                              deleteOtherExpense(
                                index
                              )
                            }
                            style={{
                              width:
                                "35px",
                              height:
                                "37px",
                              padding:
                                "0",
                              border:
                                "1px solid #292929",
                              background:
                                "#111",
                              color:
                                "#666",
                              cursor:
                                "pointer",
                              fontSize:
                                "15px",
                            }}
                          >
                            ×
                          </button>

                        </div>

                      )
                    )

                  )}

                </div>

              </div>


              {/* =================================================
                  QRIS MDR
              ================================================= */}

              <div className="bookkeeping-settings-section">

                <div className="bookkeeping-settings-title">

                  <span>
                    PAYMENT PROCESSING
                  </span>

                  <h3>
                    QRIS MDR
                  </h3>

                </div>


                <div className="bookkeeping-field">

                  <label>
                    QRIS MDR PERCENTAGE
                  </label>


                  <div className="bookkeeping-input-suffix">

                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      name="qris_mdr_percentage"
                      value={
                        settings.qris_mdr_percentage
                      }
                      onChange={
                        handlePercentageSettingChange
                      }
                      placeholder="0"
                    />

                    <span>
                      %
                    </span>

                  </div>

                </div>

              </div>


              {/* =================================================
                  BEP
              ================================================= */}

              <div className="bookkeeping-settings-section">

                <div className="bookkeeping-settings-title">

                  <span>
                    PROFIT ALLOCATION
                  </span>

                  <h3>
                    BEP
                  </h3>

                </div>


                <div className="bookkeeping-field">

                  <label>
                    BEP PERCENTAGE
                  </label>


                  <div className="bookkeeping-input-suffix">

                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      name="bep_percentage"
                      value={
                        settings.bep_percentage
                      }
                      onChange={
                        handlePercentageSettingChange
                      }
                    />

                    <span>
                      %
                    </span>

                  </div>

                </div>

              </div>


              {/* =================================================
                  DISTRIBUTION
              ================================================= */}

              <div className="bookkeeping-settings-section">

                <div className="bookkeeping-settings-title">

                  <span>
                    FINAL DISTRIBUTION
                  </span>

                  <h3>
                    Profit Distribution
                  </h3>

                </div>


                <div className="bookkeeping-distribution-list">

                  {settings.distributions.map(
                    (
                      item,
                      index
                    ) => (

                      <div
                        className="bookkeeping-distribution-row"
                        key={
                          index
                        }
                      >

                        <input
                          type="text"
                          value={
                            item.name
                          }
                          placeholder="Name"
                          onChange={(
                            event
                          ) =>
                            handleDistributionChange(
                              index,
                              "name",
                              event.target.value
                            )
                          }
                        />


                        <div className="bookkeeping-percentage-input">

                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={
                              item.percentage
                            }
                            onChange={(
                              event
                            ) =>
                              handleDistributionChange(
                                index,
                                "percentage",
                                event.target.value
                              )
                            }
                          />

                          <span>
                            %
                          </span>

                        </div>


                        <button
                          type="button"
                          onClick={() =>
                            deleteDistribution(
                              index
                            )
                          }
                        >
                          ×
                        </button>

                      </div>

                    )
                  )}

                </div>


                <div className="bookkeeping-distribution-footer">

                  <button
                    type="button"
                    className="bookkeeping-add-distribution"
                    onClick={
                      addDistribution
                    }
                  >
                    + Add Person
                  </button>


                  <span
                    className={
                      Math.round(
                        distributionPercentage
                      ) === 100
                        ? "valid"
                        : "invalid"
                    }
                  >
                    Total{" "}
                    {distributionPercentage}%
                  </span>

                </div>

              </div>

            </div>


            <div className="bookkeeping-modal-footer">

              <button
                type="button"
                className="bookkeeping-cancel"
                onClick={() =>
                  setShowSettings(
                    false
                  )
                }
              >
                Close
              </button>


              <button
                type="button"
                className="bookkeeping-save"
                onClick={() =>
                  setShowSettings(
                    false
                  )
                }
              >
                Save Settings
              </button>

            </div>

          </div>

        </div>

      )}


      {/* =====================================================
          ADDITIONAL EXPENSE MODAL
      ===================================================== */}

      {showAdditionalExpense && (

        <div
          className="bookkeeping-overlay"
          onMouseDown={(
            event
          ) => {

            if (
              event.target ===
              event.currentTarget
            ) {

              setShowAdditionalExpense(
                false
              );

            }

          }}
        >

          <div className="bookkeeping-modal bookkeeping-small-modal">


            <div className="bookkeeping-modal-header">

              <div>

                <span>
                  ADDITIONAL EXPENSE
                </span>

                <h2>
                  Add Expense
                </h2>

                <p>
                  Add an expense for this report.
                </p>

              </div>


              <button
                type="button"
                className="bookkeeping-close"
                onClick={() =>
                  setShowAdditionalExpense(
                    false
                  )
                }
              >
                ×
              </button>

            </div>


            <form
              onSubmit={
                handleAddAdditionalExpense
              }
            >

              <div className="bookkeeping-modal-body">

                <div className="bookkeeping-settings-grid bookkeeping-one-column">


                  <div className="bookkeeping-field">

                    <label>
                      EXPENSE NAME
                    </label>

                    <input
                      type="text"
                      name="name"
                      value={
                        additionalExpenseForm.name
                      }
                      onChange={
                        handleAdditionalExpenseChange
                      }
                      placeholder="Expense name"
                      required
                    />

                  </div>


                  <div className="bookkeeping-field">

                    <label>
                      AMOUNT
                    </label>

                    <input
                      type="text"
                      inputMode="numeric"
                      name="amount"
                      value={
                        formatNumberInput(
                          additionalExpenseForm.amount
                        )
                      }
                      onChange={
                        handleAdditionalAmountChange
                      }
                      placeholder="0"
                      required
                    />

                  </div>


                  <div className="bookkeeping-field">

                    <label>
                      INFORMATION
                    </label>

                    <input
                      type="text"
                      name="information"
                      value={
                        additionalExpenseForm.information
                      }
                      onChange={
                        handleAdditionalExpenseChange
                      }
                      placeholder="Additional information"
                    />

                  </div>

                </div>

              </div>


              <div className="bookkeeping-modal-footer">

                <button
                  type="button"
                  className="bookkeeping-cancel"
                  onClick={() =>
                    setShowAdditionalExpense(
                      false
                    )
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="bookkeeping-save"
                >
                  Add Expense
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>

  );
}


export default Bookkeeping;