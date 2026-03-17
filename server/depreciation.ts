export interface DepreciationInput {
  purchasePrice: number;
  purchaseDate: string | null;
  depreciationMethod: string | null;
  depreciationRate: number | null;
  usefulLifeYears: number | null;
  residualValue: number | null;
}

export interface DepreciationSummary {
  yearsOwned: number;
  annualDepreciation: number;
  accumulatedDepreciation: number;
  currentBookValue: number;
  percentDepreciated: number;
  fullyDepreciated: boolean;
}

export interface ScheduleRow {
  year: number;
  calendarYear: number;
  openingBookValue: number;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  closingBookValue: number;
}

export function calculateDepreciation(asset: DepreciationInput): DepreciationSummary | null {
  const { purchasePrice, purchaseDate, depreciationMethod, depreciationRate, usefulLifeYears, residualValue } = asset;

  if (!purchasePrice || purchasePrice <= 0) return null;
  if (!purchaseDate) return null;
  if (!depreciationMethod || depreciationMethod === "none") return null;

  const purchaseDateObj = new Date(purchaseDate);
  if (isNaN(purchaseDateObj.getTime())) return null;

  const now = new Date();
  const yearsOwned = Math.max(0, (now.getTime() - purchaseDateObj.getTime()) / (1000 * 60 * 60 * 24 * 365.25));

  const salvage = residualValue && residualValue > 0 ? Math.min(residualValue, purchasePrice * 0.9) : 0;
  const depreciableAmount = purchasePrice - salvage;

  // Derive useful life from rate if not provided (e.g., 20% → 5 years)
  const effectiveLife = usefulLifeYears && usefulLifeYears > 0
    ? usefulLifeYears
    : depreciationRate && depreciationRate > 0
      ? Math.ceil(100 / depreciationRate)
      : 5;

  let currentBookValue: number;
  let accumulatedDepreciation: number;
  let annualDepreciation: number;

  if (depreciationMethod === "straight-line") {
    annualDepreciation = depreciableAmount / effectiveLife;
    accumulatedDepreciation = Math.min(depreciableAmount, annualDepreciation * yearsOwned);
    currentBookValue = Math.max(salvage, purchasePrice - accumulatedDepreciation);
  } else if (depreciationMethod === "declining-balance") {
    const rate = depreciationRate && depreciationRate > 0 ? depreciationRate / 100 : (2 / effectiveLife);
    currentBookValue = Math.max(salvage, purchasePrice * Math.pow(1 - rate, yearsOwned));
    accumulatedDepreciation = purchasePrice - currentBookValue;
    annualDepreciation = purchasePrice * rate;
  } else {
    return null;
  }

  const percentDepreciated = purchasePrice > 0 ? (accumulatedDepreciation / purchasePrice) * 100 : 0;
  const fullyDepreciated = currentBookValue <= salvage + 0.01;

  return {
    yearsOwned: Math.round(yearsOwned * 10) / 10,
    annualDepreciation: Math.round(annualDepreciation * 100) / 100,
    accumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
    currentBookValue: Math.round(currentBookValue * 100) / 100,
    percentDepreciated: Math.round(percentDepreciated * 10) / 10,
    fullyDepreciated,
  };
}

export function generateDepreciationSchedule(asset: DepreciationInput): ScheduleRow[] {
  const { purchasePrice, purchaseDate, depreciationMethod, depreciationRate, usefulLifeYears, residualValue } = asset;

  if (!purchasePrice || purchasePrice <= 0 || !purchaseDate) return [];
  if (!depreciationMethod || depreciationMethod === "none") return [];

  const purchaseDateObj = new Date(purchaseDate);
  if (isNaN(purchaseDateObj.getTime())) return [];

  const startYear = purchaseDateObj.getFullYear();
  const salvage = residualValue && residualValue > 0 ? Math.min(residualValue, purchasePrice * 0.9) : 0;
  const depreciableAmount = purchasePrice - salvage;

  const effectiveLife = usefulLifeYears && usefulLifeYears > 0
    ? usefulLifeYears
    : depreciationRate && depreciationRate > 0
      ? Math.ceil(100 / depreciationRate)
      : 5;

  const maxYears = Math.min(Math.max(effectiveLife + 2, 10), 30);
  const rows: ScheduleRow[] = [];
  let bookValue = purchasePrice;
  let accumulated = 0;

  if (depreciationMethod === "straight-line") {
    const annualDep = depreciableAmount / effectiveLife;
    for (let i = 1; i <= maxYears; i++) {
      const opening = bookValue;
      const depAmount = opening <= salvage + 0.01 ? 0 : Math.min(annualDep, opening - salvage);
      accumulated += depAmount;
      bookValue = Math.max(salvage, opening - depAmount);
      rows.push({
        year: i,
        calendarYear: startYear + i,
        openingBookValue: Math.round(opening * 100) / 100,
        depreciationAmount: Math.round(depAmount * 100) / 100,
        accumulatedDepreciation: Math.round(accumulated * 100) / 100,
        closingBookValue: Math.round(bookValue * 100) / 100,
      });
      if (bookValue <= salvage + 0.01) break;
    }
  } else if (depreciationMethod === "declining-balance") {
    const rate = depreciationRate && depreciationRate > 0 ? depreciationRate / 100 : (2 / effectiveLife);
    for (let i = 1; i <= maxYears; i++) {
      const opening = bookValue;
      const depAmount = opening <= salvage + 0.01 ? 0 : Math.max(0, Math.min(opening * rate, opening - salvage));
      accumulated += depAmount;
      bookValue = Math.max(salvage, opening - depAmount);
      rows.push({
        year: i,
        calendarYear: startYear + i,
        openingBookValue: Math.round(opening * 100) / 100,
        depreciationAmount: Math.round(depAmount * 100) / 100,
        accumulatedDepreciation: Math.round(accumulated * 100) / 100,
        closingBookValue: Math.round(bookValue * 100) / 100,
      });
      if (bookValue <= salvage + 0.01) break;
    }
  }

  return rows;
}
