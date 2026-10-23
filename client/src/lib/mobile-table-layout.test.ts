import { describe, expect, it } from "vitest";
import { applyMobileTableLayout } from "./mobile-table-layout";

describe("mobile table layout", () => {
  it("labels wide tables and marks the action cell for stacked cards", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <table>
        <thead><tr>
          <th>Reference</th><th>Requester</th><th>Assignment group</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody><tr>
          <td>INC-1001</td><td>Alex Morgan</td><td>Service Desk</td><td>Open</td><td><button>View</button></td>
        </tr></tbody>
      </table>
    `;

    applyMobileTableLayout(root);

    const table = root.querySelector("table");
    const cells = root.querySelectorAll("tbody td");
    expect(table?.dataset.mobileCards).toBe("true");
    expect(cells[0].dataset.mobileLabel).toBe("Reference");
    expect(cells[4].dataset.mobileLabel).toBe("Actions");
    expect(cells[4].dataset.mobileActions).toBe("true");
    expect(cells[0].getAttribute("aria-labelledby")).toBe(
      root.querySelector("thead th")?.id,
    );
    expect(cells[0].getAttribute("role")).toBe("cell");
  });

  it("leaves compact tables in their original scrollable table layout", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <table>
        <thead><tr><th>Name</th><th>Status</th><th>Owner</th><th>Updated</th></tr></thead>
        <tbody><tr><td>Application</td><td>Active</td><td>IT</td><td>Today</td></tr></tbody>
      </table>
    `;

    applyMobileTableLayout(root);

    const table = root.querySelector("table");
    expect(table?.dataset.mobileCards).toBe("false");
    expect(root.querySelector("tbody td")?.hasAttribute("data-mobile-label")).toBe(false);
  });

  it("keeps a caller-provided mobile label and marks spanning detail rows", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <table>
        <thead><tr><th>Reference</th><th>Requester</th><th>Group</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          <tr><td data-mobile-label="Ticket ID">INC-1001</td><td>Alex</td><td>Service Desk</td><td>Open</td><td>View</td></tr>
          <tr><td colspan="5">Additional details</td></tr>
        </tbody>
      </table>
    `;

    applyMobileTableLayout(root);

    expect(root.querySelector("tbody td")?.dataset.mobileLabel).toBe("Ticket ID");
    expect(root.querySelector("tbody tr + tr td")?.dataset.mobileWide).toBe("true");
    expect(root.querySelector("tbody tr + tr td")?.hasAttribute("data-mobile-label")).toBe(false);
  });
});
