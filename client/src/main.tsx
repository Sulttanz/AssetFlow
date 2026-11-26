import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installDevResizeWarningHandler } from "./lib/dev-resize-warning";

if (import.meta.env.DEV) {
  const remove = installDevResizeWarningHandler(window);
  import.meta.hot?.dispose(remove);
}

createRoot(document.getElementById("root")!).render(<App />);
