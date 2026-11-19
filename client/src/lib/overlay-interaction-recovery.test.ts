import { afterEach, describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { installOverlayInteractionRecovery } from "./overlay-interaction-recovery";

describe("stale modal pointer-lock recovery", () => {
  afterEach(() => {
    document.body.style.removeProperty("pointer-events");
    document.body.querySelectorAll("[data-overlay-test]").forEach(element => element.remove());
  });

  it("keeps the page locked while a modal is open and unlocks after it closes", async () => {
    const stopRecovery = installOverlayInteractionRecovery();
    const modal = document.createElement("div");
    modal.setAttribute("data-overlay-test", "");
    modal.setAttribute("data-state", "open");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("role", "dialog");
    document.body.appendChild(modal);
    document.body.style.pointerEvents = "none";

    await new Promise(resolve => setTimeout(resolve, 5));
    expect(document.body.style.pointerEvents).toBe("none");

    modal.setAttribute("data-state", "closed");
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
    stopRecovery();
  });

  it("repairs a body lock if a modal is removed before its normal cleanup runs", async () => {
    const stopRecovery = installOverlayInteractionRecovery();
    const modal = document.createElement("div");
    modal.setAttribute("data-overlay-test", "");
    modal.setAttribute("data-state", "open");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("role", "dialog");
    document.body.appendChild(modal);
    document.body.style.pointerEvents = "none";

    await new Promise(resolve => setTimeout(resolve, 5));
    modal.remove();
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
    stopRecovery();
  });

  it("keeps the lock while another modal remains open", async () => {
    const stopRecovery = installOverlayInteractionRecovery();
    const parent = document.createElement("div");
    const child = document.createElement("div");
    for (const modal of [parent, child]) {
      modal.setAttribute("data-overlay-test", "");
      modal.setAttribute("data-state", "open");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("role", "dialog");
      document.body.appendChild(modal);
    }
    document.body.style.pointerEvents = "none";

    await new Promise(resolve => setTimeout(resolve, 5));
    parent.remove();
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(document.body.style.pointerEvents).toBe("none");

    child.remove();
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
    stopRecovery();
  });
});
