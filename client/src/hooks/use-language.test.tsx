import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider, useLanguage } from "./use-language";

function LanguageProbe() {
  const { language, setLanguage, t } = useLanguage();
  return <main><span data-testid="language">{language}</span><span>{t("Dashboard")}</span><span>{t("Untranslated technical label")}</span>
    <button onClick={() => setLanguage("ar")}>Arabic</button><button onClick={() => setLanguage("en")}>English</button></main>;
}

describe("English and Arabic interface language", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
  });

  it("switches the document to RTL and persists language while falling back for unknown strings", () => {
    render(<LanguageProvider><LanguageProbe /></LanguageProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Arabic" }));
    expect(screen.getByTestId("language").textContent).toBe("ar");
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(localStorage.getItem("assetflow-language")).toBe("ar");
    expect(screen.getByText("لوحة المعلومات")).toBeTruthy();
    expect(screen.getByText("Untranslated technical label")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(document.documentElement.dir).toBe("ltr");
    expect(localStorage.getItem("assetflow-language")).toBe("en");
  });
});
