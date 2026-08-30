import { useEffect, useMemo, useState } from "react";

import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import {
  isRevenueInRange,
} from "../lib/revenuePeriod";
import {
  customerFinanceToRevenueRow,
} from "../lib/customerFinance";
import "./Bookkeeping.css";

/* =========================================================
   TABLE NAMES
   Spending.jsx reads/writes "spendings" (plural).
   Keep this in one place so it can't drift again.
========================================================= */

const SPENDINGS_TABLE = "spendings";
const CUSTOMER_FINANCE_RPC = "get_customer_finance_summary";
const REPORTS_TABLE = "bookkeeping_reports";

/* =========================================================
   FORMAT HELPERS
========================================================= */

function formatRupiah(value) {
  const number = Number(value || 0);
  return `Rp ${number.toLocaleString("id-ID")}`;
}

function formatNumberInput(value) {
  if (value === null || value === undefined || value === "") return "";

  const numericValue = String(value).replace(/\D/g, "");

  if (!numericValue) return "";

  return Number(numericValue).toLocaleString("id-ID");
}

function parseNumberInput(value) {
  if (value === null || value === undefined || value === "") return 0;

  return (
    Number(
      String(value).replace(/\D/g, "")
    ) || 0
  );
}

function formatDate(date) {
  if (!date) return "-";

  const parts = String(date).split("-");

  if (parts.length !== 3) return date;

  const [year, month, day] = parts;

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  return `${day} ${months[Number(month) - 1] || month} ${year}`;
}


/* =========================================================
   FORMAT GENERATED AT
   Example:
   Generated 23.35 - 27/08/2026
========================================================= */

function formatGeneratedAt(date) {
  if (!date) return "-";

  const generatedDate = new Date(date);

  if (
    Number.isNaN(
      generatedDate.getTime()
    )
  ) {
    return "-";
  }

  const hours = String(
    generatedDate.getHours()
  ).padStart(2, "0");

  const minutes = String(
    generatedDate.getMinutes()
  ).padStart(2, "0");

  const day = String(
    generatedDate.getDate()
  ).padStart(2, "0");

  const month = String(
    generatedDate.getMonth() + 1
  ).padStart(2, "0");

  const year = generatedDate.getFullYear();

  return `Generated ${hours}.${minutes} - ${day}/${month}/${year}`;
}


function getTodayString() {
  const today = new Date();

  return `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
}

function getFirstDayOfCurrentMonth() {
  const today = new Date();

  return `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-01`;
}

/* =========================================================
   DEFAULT SETTINGS
========================================================= */

const defaultDistributions = [
  { name: "Raden", percentage: 50 },
  { name: "Kakak", percentage: 50 },
];

const defaultSettings = {
  additional_expenses: [],
  bep_percentage: 20,
  distributions: defaultDistributions,
};

function normalizeSettings(rawSettings) {
  const raw = rawSettings || {};

  const additionalExpenses = Array.isArray(raw.additional_expenses)
    ? raw.additional_expenses
    : [];

  return {
    additional_expenses: additionalExpenses.map((item, index) => ({
      id: item.id || `additional-${index}-${Date.now()}`,
      name: item.name || "",
      amount: Number(item.amount || 0),
      information: item.information || "",
    })),

    bep_percentage: Number(raw.bep_percentage ?? 20),

    distributions: Array.isArray(raw.distributions)
      ? raw.distributions
      : defaultDistributions,
  };
}

/* =========================================================
   SPENDING HELPERS
   Spending.jsx stores Studio Expenses with category "expense"
   and the outgoing value in amount_out.
========================================================= */

function isStudioExpense(item) {
  const category = String(item.category || "")
    .trim()
    .toLowerCase();

  return (
    category === "expense" ||
    category === "studio expense" ||
    category === "studio expenses"
  );
}

function getSpendingAmount(item) {
  return (
    Number(
      item.amount_out ??
        item.amount ??
        item.total ??
        item.cost ??
        0
    ) || 0
  );
}

function getSpendingDate(item) {
  return item.date || item.transaction_date || null;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================================================
   BOOKKEEPING
========================================================= */

function Bookkeeping() {
  const [reports, setReports] = useState([]);
  const [spending, setSpending] = useState([]);
  const [revenueRows, setRevenueRows] = useState([]);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);

  const [fromDate, setFromDate] = useState(
    getFirstDayOfCurrentMonth()
  );

  const [toDate, setToDate] = useState(
    getTodayString()
  );

  /* =======================================================
     FETCH DATA
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      const [
        spendingResult,
        customerFinanceResult,
        reportResult,
      ] = await Promise.all([
        supabase
          .from(SPENDINGS_TABLE)
          .select("*")
          .order("date", {
            ascending: false,
          }),

        supabase.rpc(CUSTOMER_FINANCE_RPC),

        supabase
          .from(REPORTS_TABLE)
          .select("*")
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (cancelled) return;

      const errors = [];

      if (spendingResult.error) {
        console.error(
          "BOOKKEEPING SPENDING ERROR:",
          spendingResult.error
        );

        errors.push(
          `Failed to load spending data: ${spendingResult.error.message}`
        );
      } else {
        setSpending(
          spendingResult.data || []
        );
      }

      if (customerFinanceResult.error) {
        console.error(
          "BOOKKEEPING CUSTOMER FINANCE ERROR:",
          customerFinanceResult.error
        );

        errors.push(
          `Failed to load Customer Data: ${customerFinanceResult.error.message}`
        );
      } else {
        setRevenueRows(
          (customerFinanceResult.data || [])
            .filter((customer) => customer.is_final)
            .map(customerFinanceToRevenueRow)
        );
      }

      if (reportResult.error) {
        console.error(
          "BOOKKEEPING REPORT ERROR:",
          reportResult.error
        );

        errors.push(
          `Failed to load reports: ${reportResult.error.message}`
        );
      } else {
        setReports(
          reportResult.data || []
        );
      }

      setErrorMessage(
        errors.join(" ")
      );

      setLoading(false);
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const studioExpenses = useMemo(
    () =>
      spending.filter(
        isStudioExpense
      ),
    [spending]
  );

  const filteredSpending = useMemo(() => {
    if (!fromDate || !toDate) return [];

    return studioExpenses.filter(
      (item) => {
        const date =
          getSpendingDate(item);

        if (!date) return false;

        return (
          date >= fromDate &&
          date <= toDate
        );
      }
    );
  }, [
    studioExpenses,
    fromDate,
    toDate,
  ]);

  const filteredRevenueRows = useMemo(() => {
    if (!fromDate || !toDate) return [];

    return revenueRows.filter(
      (item) =>
        isRevenueInRange(
          item,
          fromDate,
          toDate
        )
    );
  }, [
    revenueRows,
    fromDate,
    toDate,
  ]);

  const spendingTotal =
    filteredSpending.reduce(
      (
        total,
        item
      ) =>
        total +
        getSpendingAmount(item),
      0
    );

  const additionalExpenseTotal =
    settings.additional_expenses.reduce(
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

  const grossRevenue =
    filteredRevenueRows.reduce(
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

  const revenueWithMdr =
    filteredRevenueRows
      .filter((item) => Number(item.mdr_amount || 0) > 0)
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

  const revenueWithoutMdr =
    grossRevenue -
    revenueWithMdr;

  /* =======================================================
     CUSTOMER FINAL REVENUE

     Customer Data is the financial source of truth.
     The database RPC groups the existing transactions for
     each customer and returns the final package, MDR, and net
     values. Transactions remains the cash-receipt ledger.
  ======================================================= */

  const qrisMdrAmount =
    filteredRevenueRows.reduce(
      (total, item) =>
        total +
        Number(
          item.mdr_amount || 0
        ),
      0
    );

  const qrisMdrPercentage =
    grossRevenue > 0
      ? (
          qrisMdrAmount /
          grossRevenue
        ) * 100
      : 0;

  const netRevenue =
    filteredRevenueRows.reduce(
      (total, item) =>
        total +
        Number(
          item.net_amount ??
            item.amount ??
            0
        ),
      0
    );

  const totalExpense =
    spendingTotal +
    additionalExpenseTotal;

  const netProfit =
    netRevenue -
    totalExpense;

  const bepPercentage =
    Number(
      settings.bep_percentage || 0
    );

  /*
   * BEP / reserve hanya boleh diambil ketika ada profit.
   * Jika periode rugi, BEP = 0 agar kerugian tidak terlihat
   * seolah-olah berkurang karena nilai BEP negatif.
   */
  const bepBase =
    Math.max(
      netProfit,
      0
    );

  const bepAmount =
    Math.round(
      bepBase *
        (
          bepPercentage /
          100
        )
    );

  const profitAfterBep =
    netProfit -
    bepAmount;

  /*
   * Distribusi profit juga hanya dilakukan dari profit positif.
   * Saat profitAfterBep <= 0, semua nominal distribusi = 0.
   */
  const distributionBase =
    Math.max(
      profitAfterBep,
      0
    );

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

  const distributionResult =
    settings.distributions.map(
      (
        item
      ) => {

        const percentage =
          Number(
            item.percentage || 0
          );

        return {
          ...item,

          amount:
            Math.round(
              distributionBase *
                (
                  percentage /
                  100
                )
            ),
        };
      }
    );

  const dateIsValid =
    fromDate &&
    toDate &&
    fromDate <= toDate;

  /* =======================================================
     SETTINGS HANDLERS
  ======================================================= */

  const handleAdditionalExpenseChange = (
    index,
    field,
    value
  ) => {
    setSettings(
      (current) => {
        const updated = [
          ...current.additional_expenses,
        ];

        updated[index] = {
          ...updated[index],
          [field]:
            field === "amount"
              ? parseNumberInput(value)
              : value,
        };

        return {
          ...current,
          additional_expenses:
            updated,
        };
      }
    );
  };

  const addAdditionalExpense = () => {
    setSettings(
      (current) => ({
        ...current,

        additional_expenses: [
          ...current.additional_expenses,

          {
            id:
              `additional-${Date.now()}`,

            name:
              "",

            amount:
              0,

            information:
              "",
          },
        ],
      })
    );
  };

  const deleteAdditionalExpense = (
    index
  ) => {
    setSettings(
      (current) => ({
        ...current,

        additional_expenses:
          current.additional_expenses.filter(
            (
              _,
              itemIndex
            ) =>
              itemIndex !==
              index
          ),
      })
    );
  };

  const handlePercentageSettingChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setSettings(
      (current) => ({
        ...current,
        [name]:
          value,
      })
    );
  };

  const handleDistributionChange = (
    index,
    field,
    value
  ) => {
    setSettings(
      (current) => {
        const updated = [
          ...current.distributions,
        ];

        updated[index] = {
          ...updated[index],
          [field]:
            value,
        };

        return {
          ...current,
          distributions:
            updated,
        };
      }
    );
  };

  const addDistribution = () => {
    setSettings(
      (current) => ({
        ...current,

        distributions: [
          ...current.distributions,

          {
            name:
              "",

            percentage:
              0,
          },
        ],
      })
    );
  };

  const deleteDistribution = (
    index
  ) => {
    setSettings(
      (current) => ({
        ...current,

        distributions:
          current.distributions.filter(
            (
              _,
              itemIndex
            ) =>
              itemIndex !==
              index
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

        setShowSettings(
          true
        );

        return;
      }

      setGenerating(
        true
      );

      try {

        const reportTitle =
          `Financial Report — ${formatDate(
            fromDate
          )} to ${formatDate(
            toDate
          )}`;

        const settingsData = {

          additional_expenses:
            settings
              .additional_expenses
              .map(
                (
                  item
                ) => ({
                  id:
                    item.id,

                  name:
                    item.name,

                  amount:
                    Number(
                      item.amount ||
                        0
                    ),

                  information:
                    item.information ||
                    "",
                })
              ),

          spending_items:
            filteredSpending,

          transaction_items:
            filteredRevenueRows,

          customer_revenue_items:
            filteredRevenueRows,

          revenue_basis:
            "customer_final_value",

          revenue_summary: {

            gross_revenue:
              grossRevenue,

            qris_gross_revenue:
              revenueWithMdr,

            non_qris_revenue:
              revenueWithoutMdr,

            qris_mdr_percentage:
              qrisMdrPercentage,

            qris_mdr_amount:
              qrisMdrAmount,

            net_revenue:
              netRevenue,
          },
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
                  item.percentage ||
                    0
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
            settingsData,
        };

        const {
          data,
          error,
        } = await supabase
          .from(
            REPORTS_TABLE
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
          (current) => [
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

        setGenerating(
          false
        );
      }
    };

  /* =======================================================
     DELETE REPORT
  ======================================================= */

  const deleteReport =
    async (
      reportId
    ) => {

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
            REPORTS_TABLE
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
              (
                report
              ) =>
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
     DOWNLOAD PDF
  ======================================================= */

  const downloadPDF =
    (
      report
    ) => {

      const distribution =
        report.distribution_data ||
        [];

      const rawSettings =
        report.settings_data ||
        {};

      const storedSettings =
        normalizeSettings(
          rawSettings
        );

      const revenueSummary =
        rawSettings
          .revenue_summary ||
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
        Array.isArray(
          rawSettings
            .additional_expenses
        )
          ? rawSettings
              .additional_expenses
          : storedSettings
              .additional_expenses ||
            [];

      const savedSpendingItems =
        Array.isArray(
          rawSettings
            .spending_items
        )
          ? rawSettings
              .spending_items
          : [];

      const spendingItems =
        savedSpendingItems.length >
        0

          ? savedSpendingItems

          : spending.filter(
              (
                item
              ) => {

                const date =
                  getSpendingDate(
                    item
                  );

                if (
                  !date ||
                  !isStudioExpense(
                    item
                  )
                ) {
                  return false;
                }

                return (
                  date >=
                    report.start_date &&
                  date <=
                    report.end_date
                );
              }
            );

      const visibleAdditional =
        additional.filter(
          (
            item
          ) =>
            item.name ||
            Number(
              item.amount ||
                0
            ) > 0
        );

      const spendingRows =
        spendingItems.length
          ? spendingItems
              .map(
                (
                  item
                ) => `
<tr>
  <td>${formatDate(
    getSpendingDate(item)
  )}</td>
  <td>${escapeHTML(
    item.description ||
      item.name ||
      "-"
  )}</td>
  <td class="amount">${formatRupiah(
    getSpendingAmount(item)
  )}</td>
</tr>`
              )
              .join("")

          : `
<tr>
  <td
    colspan="3"
    class="empty"
  >
    No studio expenses recorded.
  </td>
</tr>`;

      const additionalRows =
        visibleAdditional.length
          ? visibleAdditional
              .map(
                (
                  item
                ) => `
<tr>
  <td>${escapeHTML(
    item.name ||
      "-"
  )}</td>
  <td>${escapeHTML(
    item.information ||
      "-"
  )}</td>
  <td class="amount">${formatRupiah(
    item.amount
  )}</td>
</tr>`
              )
              .join("")

          : `
<tr>
  <td
    colspan="3"
    class="empty"
  >
    No additional expenses recorded.
  </td>
</tr>`;

      const distributionRows =
        distribution.length
          ? distribution
              .map(
                (
                  item
                ) => `
<tr>
  <td>${escapeHTML(
    item.name
  )}</td>
  <td>${Number(
    item.percentage ||
      0
  )}%</td>
  <td class="amount">${formatRupiah(
    item.amount
  )}</td>
</tr>`
              )
              .join("")

          : `
<tr>
  <td
    colspan="3"
    class="empty"
  >
    No profit distribution recorded.
  </td>
</tr>`;

      const title =
        escapeHTML(
          report.report_title ||
            "Financial Report"
        );

      const reportHTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${title}</title>

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
  font-family: Arial, Helvetica, sans-serif;
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
      ${title}
    </div>

  </div>

</div>

<div class="intro">
  Laporan ini disusun untuk kebutuhan internal Pluno Studio.
</div>


<div class="section">

  <div class="section-title">
    01 · Customer Final Revenue by Event Date
  </div>

  <div class="summary">

    <div class="summary-row">
      <span>
        Total Package Value
      </span>

      <strong>
        ${formatRupiah(
          revenueSummary.gross_revenue
        )}
      </strong>
    </div>

    <div class="summary-row">
      <span>
        Revenue With MDR
      </span>

      <strong>
        ${formatRupiah(
          revenueSummary.qris_gross_revenue
        )}
      </strong>
    </div>

    <div class="summary-row">
      <span>
        Revenue Without MDR
      </span>

      <strong>
        ${formatRupiah(
          revenueSummary.non_qris_revenue
        )}
      </strong>
    </div>

    <div class="summary-row">

      <span>
        Total MDR

      </span>

      <strong>
        -${formatRupiah(
          revenueSummary.qris_mdr_amount
        )}
      </strong>

    </div>

    <div class="summary-row total">

      <span>
        Total Net Value
      </span>

      <strong>
        ${formatRupiah(
          revenueSummary.net_revenue
        )}
      </strong>

    </div>

  </div>

</div>


<div class="section">

  <div class="section-title">
    02 · Expenses
  </div>

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
        ${spendingRows}
      </tbody>

    </table>

  </div>


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
        ${additionalRows}
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
      ${distributionRows}
    </tbody>

  </table>

</div>


<div class="footer">

  <strong>
    PLUNO STUDIO
  </strong>

  <br>

  Dokumen ini disusun untuk kebutuhan internal Pluno Studio dan tidak diperuntukkan sebagai dokumen publik.

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

      setTimeout(
        () => {
          printWindow.print();
        },
        500
      );
    };

  /* =======================================================
     RENDER
  ======================================================= */

  const inputStyle = {
    width: "100%",
    height: "37px",
    padding: "9px 11px",
    border: "1px solid #292929",
    outline: "none",
    background: "#111",
    color: "#eee",
    fontFamily: "inherit",
    fontSize: "10px",
  };

  return (
    <div className="bookkeeping-page">

      <Sidebar
        activePage="bookkeeping"
      />


      <main className="bookkeeping-main">


        {/* =================================================
            GENERATOR & PERIOD
        ================================================= */}

        <section className="bookkeeping-generator">

          <div className="bookkeeping-generator-top">

            <div>

              <div className="bookkeeping-section-label">
                REPORT PERIOD
              </div>

            </div>


            <button
              type="button"
              className="bookkeeping-settings-button"
              onClick={() =>
                setShowSettings(
                  true
                )
              }
              aria-label="Settings"
            >
              ⚙
            </button>

          </div>


          <div className="bookkeeping-period-grid">

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
                CUSTOMER FINAL VALUE BY EVENT DATE · EXPENSE BY PAYMENT DATE
              </span>

              <strong>
                {formatDate(
                  fromDate
                )}
                {" — "}
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

              {
                generating
                  ? "Generating..."
                  : "Generate Report"
              }

            </button>

          </div>

        </section>


        {errorMessage && (
          <div className="bookkeeping-error">
            {errorMessage}
          </div>
        )}


 {/* =================================================
    CURRENT CUSTOMER REVENUE · BY EVENT DATE
================================================= */}

<section className="bookkeeping-overview">

  <div className="bookkeeping-section-label">
    CURRENT DATA
  </div>

  <div className="bookkeeping-overview-grid">

    <div>

      <span>
        TOTAL PACKAGE VALUE
      </span>

      <strong>
        {formatRupiah(
          grossRevenue
        )}
      </strong>

    </div>


    <div>

      <span>
        TOTAL MDR
      </span>

      <strong>
        {formatRupiah(
          qrisMdrAmount
        )}
      </strong>

    </div>


    <div>

      <span>
        TOTAL NET VALUE
      </span>

      <strong>
        {formatRupiah(
          netRevenue
        )}
      </strong>

    </div>


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

  </div>

</section>


        {/* =================================================
            FINANCIAL REPORTS
        ================================================= */}

        <section className="bookkeeping-reports">

          <div className="bookkeeping-card-header">

            <div>

              <span>
                FINANCIAL REPORTS
              </span>

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

                        {" — "}

                        {formatDate(
                          report.end_date
                        )}

                        {" "}

                        (
                        {formatGeneratedAt(
                          report.created_at
                        )}
                        )

                      </span>


                      <h3>
                        {
                          report.report_title ||
                          "Financial Report"
                        }
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

                        {
                          deletingReportId ===
                          report.id
                            ? "Deleting..."
                            : "Delete"
                        }

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
                  ADDITIONAL EXPENSES
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
                      gap:
                        "15px",
                    }}
                  >

                    <h3>
                      Additional Expenses
                    </h3>


                    <button
                      type="button"
                      className="bookkeeping-add-button"
                      onClick={
                        addAdditionalExpense
                      }
                    >
                      + Add
                    </button>

                  </div>

                </div>


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

                  {
                    settings
                      .additional_expenses
                      .length ===
                    0 ? (

                    <div className="bookkeeping-empty-small">
                      No additional expenses added.
                    </div>

                  ) : (

                    settings
                      .additional_expenses
                      .map(
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
                              placeholder="Expense description"
                              onChange={(
                                event
                              ) =>
                                handleAdditionalExpenseChange(
                                  index,
                                  "name",
                                  event.target
                                    .value
                                )
                              }
                              style={
                                inputStyle
                              }
                            />


                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatNumberInput(
                                item.amount
                              )}
                              placeholder="0"
                              onChange={(
                                event
                              ) =>
                                handleAdditionalExpenseChange(
                                  index,
                                  "amount",
                                  event.target
                                    .value
                                )
                              }
                              style={{
                                ...inputStyle,
                                textAlign:
                                  "right",
                              }}
                            />


                            <button
                              type="button"
                              onClick={() =>
                                deleteAdditionalExpense(
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
                        settings
                          .bep_percentage
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

                  {
                    settings
                      .distributions
                      .map(
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
                                  event
                                    .target
                                    .value
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
                                    event
                                      .target
                                      .value
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
                      )
                  }

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
                      ) ===
                      100
                        ? "valid"
                        : "invalid"
                    }
                  >

                    Total{" "}
                    {
                      distributionPercentage
                    }%

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

    </div>
  );
}

export default Bookkeeping;
