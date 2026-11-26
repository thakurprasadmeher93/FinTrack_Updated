function asDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function amount(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateDebtBalanceAt(
  row: {
    amount: unknown;
    date: Date | string;
    status?: string | null;
    settledAmount?: unknown;
    settledAt?: Date | string | null;
  },
  referenceTime: Date,
) {
  const date = asDate(row.date);
  if (!date || date > referenceTime) {
    return { relevant: false, total: 0, settled: 0, outstanding: 0, daysPending: 0 };
  }

  const total = Math.abs(amount(row.amount));
  const settledAmount = Math.max(0, amount(row.settledAmount));
  const settledAt = asDate(row.settledAt);
  const settledByReferenceTime =
    row.status === "settled" && (!settledAt || settledAt <= referenceTime);
  const settledAmountAtReferenceTime =
    row.status === "settled" && settledAt && settledAt > referenceTime ? 0 : settledAmount;
  const outstanding = settledByReferenceTime
    ? 0
    : Math.max(0, total - settledAmountAtReferenceTime);

  return {
    relevant: true,
    total,
    settled: settledByReferenceTime ? total : Math.min(total, settledAmountAtReferenceTime),
    outstanding,
    daysPending: Math.max(0, Math.floor((referenceTime.getTime() - date.getTime()) / 86_400_000)),
  };
}

export function calculateSplitShareAt(
  row: {
    amount: unknown;
    settledAmount?: unknown;
    isSettled?: boolean | null;
    date: Date | string;
  },
  referenceTime: Date,
) {
  const date = asDate(row.date);
  if (!date || date > referenceTime) {
    return { relevant: false, total: 0, settled: 0, outstanding: 0, daysPending: 0 };
  }

  const total = Math.max(0, amount(row.amount));
  const settledAmount = Math.max(0, amount(row.settledAmount));
  const settled = row.isSettled ? total : Math.min(total, settledAmount);
  return {
    relevant: true,
    total,
    settled,
    outstanding: row.isSettled ? 0 : Math.max(0, total - settledAmount),
    daysPending: Math.max(0, Math.floor((referenceTime.getTime() - date.getTime()) / 86_400_000)),
  };
}

export function obligationAgingBucket(daysPending: number): "0-30" | "31-60" | "61-90" | "90+" {
  if (daysPending <= 30) return "0-30";
  if (daysPending <= 60) return "31-60";
  if (daysPending <= 90) return "61-90";
  return "90+";
}
