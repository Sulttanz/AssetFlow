export interface ScheduleRow {
  year: number;
  calendarYear: number;
  openingBookValue: number;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  closingBookValue: number;
}

export function generateSchedule(
  purchasePrice: number,
  purchaseDate: string,
  method: string,
  ratePercent: number,
  usefulLifeYears: number | null,
  residualValue: number
): ScheduleRow[] {
  if (!purchasePrice || purchasePrice <= 0 || !purchaseDate || !method || method === "none") return [];
  const purchaseDateObj = new Date(purchaseDate);
  if (isNaN(purchaseDateObj.getTime())) return [];

  const startYear = purchaseDateObj.getFullYear();
  const salvage = Math.min(residualValue || 0, purchasePrice * 0.9);
  const depreciableAmount = purchasePrice - salvage;

  const effectiveLife = usefulLifeYears && usefulLifeYears > 0
    ? usefulLifeYears
    : ratePercent > 0 ? Math.ceil(100 / ratePercent) : 5;

  const maxYears = Math.min(Math.max(effectiveLife + 2, 10), 30);
  const rows: ScheduleRow[] = [];
  let bookValue = purchasePrice;
  let accumulated = 0;

  if (method === "straight-line") {
    const annualDep = depreciableAmount / effectiveLife;
    for (let i = 1; i <= maxYears; i++) {
      const opening = bookValue;
      const depAmount = opening <= salvage + 0.01 ? 0 : Math.min(annualDep, opening - salvage);
      accumulated += depAmount;
      bookValue = Math.max(salvage, opening - depAmount);
      rows.push({ year: i, calendarYear: startYear + i, openingBookValue: +opening.toFixed(2), depreciationAmount: +depAmount.toFixed(2), accumulatedDepreciation: +accumulated.toFixed(2), closingBookValue: +bookValue.toFixed(2) });
      if (bookValue <= salvage + 0.01) break;
    }
  } else if (method === "declining-balance") {
    const rate = ratePercent > 0 ? ratePercent / 100 : (2 / effectiveLife);
    for (let i = 1; i <= maxYears; i++) {
      const opening = bookValue;
      const depAmount = opening <= salvage + 0.01 ? 0 : Math.max(0, Math.min(opening * rate, opening - salvage));
      accumulated += depAmount;
      bookValue = Math.max(salvage, opening - depAmount);
      rows.push({ year: i, calendarYear: startYear + i, openingBookValue: +opening.toFixed(2), depreciationAmount: +depAmount.toFixed(2), accumulatedDepreciation: +accumulated.toFixed(2), closingBookValue: +bookValue.toFixed(2) });
      if (bookValue <= salvage + 0.01) break;
    }
  }

  return rows;
}
