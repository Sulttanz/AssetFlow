import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { KnowledgeDocument } from "./knowledge-document";
import styles from "./knowledge-document.css?raw";

const manuals = import.meta.glob("../../../../docs/system-manual/*.md", {
  eager: true, query: "?raw", import: "default",
}) as Record<string, string>;
const body = (source: string) => source.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "").trim();
afterEach(cleanup);

describe("Knowledge Base shared document rendering", () => {
  it("preserves inline words, code references, HTML keyboard hints and links without sentence gaps", () => {
    render(<KnowledgeDocument content={'Open **Risk Register** (`/risks`) such as **IT-RSK-001**. This is **not** the Project Management risk register and requires the `risk_management` feature. Press <kbd>Ctrl</kbd> + <kbd>K</kbd>. Visit [/risks](/risks). <span style="color:transparent" class="hidden">Active badge</span>'} />);
    const article = screen.getByTestId("knowledge-document");
    expect(article.getAttribute("dir")).toBe("ltr");
    expect(article.textContent).toContain("Open Risk Register (/risks) such as IT-RSK-001. This is not the Project Management risk register");
    expect(screen.getByText("risk_management").tagName).toBe("CODE");
    expect(screen.getByText("not").tagName).toBe("STRONG");
    expect(screen.getByText("Ctrl").tagName).toBe("KBD");
    expect(screen.getByText("Active badge").getAttribute("style")).toBeNull();
    expect(screen.getByText("Active badge").getAttribute("class")).toBeNull();
    expect(screen.getByRole("link", { name: "/risks" }).getAttribute("href")).toBe("/risks");
  });
  it("renders GFM tables, nested lists, quotes and code blocks as semantic, scroll-contained content", () => {
    render(<KnowledgeDocument content={"# Title\n\n## Major section\n\n### Subsection\n\n#### Detail\n\n| Stage | Score |\n| --- | --- |\n| Residual | `12` |\n\n1. Review risk\n   - Check controls\n\n> Review evidence first.\n\n```sql\nSELECT * FROM risk_register;\n```"} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Title");
    expect(screen.getByRole("heading", { level: 4 }).textContent).toBe("Detail");
    const region = screen.getByRole("region", { name: "Article table" });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(within(region).getByRole("table")).toBeTruthy();
    expect(screen.getByText("Check controls").closest("ol ul")).toBeTruthy();
    expect(screen.getByText("Review evidence first.").closest("blockquote")).toBeTruthy();
    expect(screen.getByText("SELECT * FROM risk_register;").closest("pre")).toBeTruthy();
  });
  it("sanitizes active HTML and author styling without removing safe inline content", () => {
    const { container } = render(<KnowledgeDocument content={'<script>alert(1)</script><style>body{display:none}</style><iframe src="https://example.com"></iframe><strong onclick="alert(1)" style="opacity:0" hidden>Visible strong</strong><kbd style="display:none">Enter</kbd><a href="javascript:alert(1)">Bad URL</a><a href="https://example.com/docs">Reference</a><img src="https://example.com/tracker.png" onerror="alert(1)" alt="illustration">' } />);
    expect(container.querySelector("script,style,iframe,img")).toBeNull();
    expect(container.querySelector("[onclick],[onerror],[style],[hidden]")).toBeNull();
    expect(screen.getByText("Visible strong").tagName).toBe("STRONG");
    expect(screen.getByText("Enter").tagName).toBe("KBD");
    expect(screen.getByText("Bad URL").getAttribute("href")).toBeNull();
    expect(screen.getByRole("link", { name: "Reference" }).getAttribute("rel")).toContain("noopener");
    expect(screen.getByText("[Image omitted: illustration]")).toBeTruthy();
  });
  it("uses application-class scoped dark colors rather than OS-driven prose inversion", () => {
    render(<div className="dark"><KnowledgeDocument content="**Visible** `code`" /></div>);
    const article = screen.getByTestId("knowledge-document");
    expect(article.className).toBe("kb-document");
    expect(styles).toContain(".dark .kb-document");
    expect(styles).toContain("--kb-ink: #1e293b");
    expect(styles).toContain("line-height: 1.7");
    expect(styles).not.toContain("prefers-color-scheme");
    expect(styles).not.toContain("prose-invert");
  });
  it.each(Object.entries(manuals))("renders the repository manual %s with visible semantic inline elements", (_path, source) => {
    render(<KnowledgeDocument content={body(source)} />);
    const article = screen.getByTestId("knowledge-document");
    expect(within(article).getByRole("heading", { level: 1 }).textContent?.trim().length).toBeGreaterThan(0);
    article.querySelectorAll("strong, code, kbd, a").forEach(element => {
      expect(element.textContent?.trim().length).toBeGreaterThan(0);
      expect(element.getAttribute("style")).toBeNull();
    });
    if (_path.includes("internal-it-department-risk-management")) {
      expect(within(article).getByText("IT-RSK-001").tagName).toBe("STRONG");
      expect(within(article).getByText("risk_management").tagName).toBe("CODE");
      expect(within(article).getByRole("link", { name: "/risks" })).toBeTruthy();
      expect(within(article).getAllByRole("table").length).toBeGreaterThan(0);
    }
  });
});
