import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ArticleEditorDialog } from "./article-editor-dialog";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("knowledge article editor initialization", () => {
  it("opens before effects initialize a category and submits its default without empty Select items", () => {
    const onSave = vi.fn();
    render(<ArticleEditorDialog open onOpenChange={vi.fn()} article={null} pending={false}
      options={{ canManage: true, categories: [{ value: "Policy", label: "Policy" }], owners: [] }}
      onSave={onSave} onArchive={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Test policy" } });
    fireEvent.change(screen.getByLabelText(/Article content/), { target: { value: "A valid policy with approved instructions." } });
    fireEvent.click(screen.getByRole("button", { name: "Create article" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: "Test policy", category: "Policy", status: "draft", isPublic: false,
      reviewDate: null, ownerId: null,
    }));
  });

  it("handles empty category options without crashing or enabling an invalid submission", () => {
    render(<ArticleEditorDialog open onOpenChange={vi.fn()} article={null} pending={false}
      options={{ canManage: true, categories: [], owners: [] }}
      onSave={vi.fn()} onArchive={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Create article" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
