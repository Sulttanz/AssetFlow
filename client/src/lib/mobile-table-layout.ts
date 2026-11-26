const MIN_CARD_COLUMNS = 5;
let generatedTableId = 0;

function getHeaderText(cell: HTMLTableCellElement, columnIndex: number): string {
  const labelledControl = cell.querySelector<HTMLElement>("[aria-label]");
  const label =
    cell.getAttribute("aria-label")?.trim() ||
    labelledControl?.getAttribute("aria-label")?.trim() ||
    cell.textContent?.replace(/\s+/g, " ").trim();

  return label || (columnIndex === 0 ? "Selection" : `Column ${columnIndex + 1}`);
}

/**
 * Marks wide tables for a labelled, stacked mobile presentation while leaving
 * their native table structure and desktop layout intact.
 */
export function applyMobileTableLayout(root: ParentNode): void {
  const tables =
    root instanceof HTMLTableElement
      ? [root]
      : Array.from(root.querySelectorAll<HTMLTableElement>("table"));

  for (const table of tables) {
    const headerRow = table.tHead?.rows.item(0);
    const headerLabels = headerRow
      ? Array.from(headerRow.cells).flatMap((cell, cellIndex) =>
          Array.from({ length: cell.colSpan || 1 }, () => getHeaderText(cell, cellIndex)),
        )
      : [];
    const useCards = table.dataset.mobileLayout !== "scroll" && headerLabels.length >= MIN_CARD_COLUMNS;

    table.dataset.mobileCards = String(useCards);
    if (!useCards) {
      for (const cell of Array.from(table.querySelectorAll<HTMLTableCellElement>("td[data-mobile-label-generated]"))) {
        delete cell.dataset.mobileLabel;
        delete cell.dataset.mobileLabelGenerated;
        delete cell.dataset.mobileActions;
        delete cell.dataset.mobileWide;
        cell.removeAttribute("aria-labelledby");
      }
      continue;
    }

    if (!table.id) {
      table.id = `mobile-data-table-${++generatedTableId}`;
    }

    const headerCells = headerRow ? Array.from(headerRow.cells) : [];
    let headerColumnIndex = 0;
    const headerIds: string[] = [];
    headerCells.forEach((headerCell, cellIndex) => {
      if (!headerCell.id) {
        headerCell.id = `${table.id}-header-${cellIndex + 1}`;
      }
      for (let column = 0; column < (headerCell.colSpan || 1); column += 1) {
        headerIds[headerColumnIndex] = headerCell.id;
        headerColumnIndex += 1;
      }
      headerCell.setAttribute("role", "columnheader");
    });

    table.setAttribute("role", table.getAttribute("role") || "table");
    for (const rowGroup of [
      ...Array.from(table.tHead ? [table.tHead] : []),
      ...Array.from(table.tBodies),
      ...Array.from(table.tFoot ? [table.tFoot] : []),
    ]) {
      rowGroup.setAttribute("role", rowGroup.getAttribute("role") || "rowgroup");
      for (const row of Array.from(rowGroup.rows)) {
        row.setAttribute("role", row.getAttribute("role") || "row");
        let columnIndex = 0;
        for (const cell of Array.from(row.cells)) {
          if (cell.tagName === "TH") {
            columnIndex += cell.colSpan || 1;
            continue;
          }

          const span = cell.colSpan || 1;
          if (span > 1) {
            cell.dataset.mobileWide = "true";
            delete cell.dataset.mobileActions;
          } else {
            delete cell.dataset.mobileWide;
            const label =
              cell.dataset.mobileLabelGenerated === "true"
                ? headerLabels[columnIndex] || `Column ${columnIndex + 1}`
                : cell.dataset.mobileLabel || headerLabels[columnIndex] || `Column ${columnIndex + 1}`;
            if (!cell.dataset.mobileLabel || cell.dataset.mobileLabelGenerated === "true") {
              cell.dataset.mobileLabel = label;
              cell.dataset.mobileLabelGenerated = "true";
            }
            if (/\bactions?\b/i.test(label)) {
              cell.dataset.mobileActions = "true";
            } else {
              delete cell.dataset.mobileActions;
            }
            if (!cell.hasAttribute("aria-labelledby") && headerIds[columnIndex]) {
              cell.setAttribute("aria-labelledby", headerIds[columnIndex]);
            }
          }

          cell.setAttribute("role", cell.getAttribute("role") || "cell");
          columnIndex += span;
        }
      }
    }
  }
}
