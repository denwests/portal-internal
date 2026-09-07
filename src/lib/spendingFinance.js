export const SPENDING_CATEGORIES = [
  {
    key: "expense",
    label: "Studio Expenses",
    kicker: "STUDIO OPERATIONS",
  },
  {
    key: "cash",
    label: "Cash Spending",
    kicker: "CASH MOVEMENT",
  },
  {
    key: "attire",
    label: "Attire / Background",
    kicker: "MONTHLY ALLOCATION",
  },
  {
    key: "evoto",
    label: "Evoto Balance",
    kicker: "CREDIT USAGE",
  },
];

const CATEGORY_ALIASES = {
  expense: "expense",
  "studio expense": "expense",
  "studio expenses": "expense",
  cash: "cash",
  "cash spending": "cash",
  "cash movement": "cash",
  attire: "attire",
  background: "attire",
  "attire / background": "attire",
  "attire/background": "attire",
  evoto: "evoto",
  "evoto balance": "evoto",
};

export function normalizeSpendingCategory(category) {
  const normalized = String(category || "").trim().toLowerCase();
  return CATEGORY_ALIASES[normalized] || normalized;
}

export function getSpendingCategory(category) {
  const key = normalizeSpendingCategory(category);
  return SPENDING_CATEGORIES.find((item) => item.key === key) || SPENDING_CATEGORIES[0];
}

export function calculateEvotoAmount(credits, creditRate) {
  const safeCredits = Math.max(0, Number(credits) || 0);
  const safeRate = Math.max(0, Number(creditRate) || 0);
  return safeCredits * safeRate;
}

export function summarizeSpendings(rows, configuredRate = 0) {
  const summary = {
    expense: 0,
    cashIn: 0,
    cashOut: 0,
    cashBalance: 0,
    attire: 0,
    evotoIn: 0,
    evotoOut: 0,
    evotoBalance: 0,
    evotoUsageValue: 0,
  };

  for (const item of rows || []) {
    const category = normalizeSpendingCategory(item.category);
    const amountIn = Number(item.amount_in || 0);
    const amountOut = Number(item.amount_out || item.amount || 0);

    if (category === "expense") summary.expense += amountOut;
    if (category === "attire") summary.attire += amountOut;
    if (category === "cash") {
      summary.cashIn += amountIn;
      summary.cashOut += amountOut;
    }
    if (category === "evoto") {
      const credits = Math.max(0, Number(item.evoto_credits || 0));
      const direction = String(item.evoto_direction || "Out").toLowerCase();
      if (direction === "in") summary.evotoIn += credits;
      else {
        summary.evotoOut += credits;
        summary.evotoUsageValue += amountOut || calculateEvotoAmount(
          credits,
          item.evoto_credit_rate || configuredRate
        );
      }
    }
  }

  summary.cashBalance = summary.cashIn - summary.cashOut;
  summary.evotoBalance = summary.evotoIn - summary.evotoOut;
  return summary;
}

export function isBookkeepingExpense(item) {
  const category = normalizeSpendingCategory(item?.category);
  return category === "expense";
}
