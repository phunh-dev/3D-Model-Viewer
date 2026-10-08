import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { loadPrefs } from "./lib/prefs";
import { useApp } from "./store/appStore";
import { setLanguage } from "./i18n";
import "./index.css";

// Apply saved preferences before the first paint so the theme doesn't flash.
void loadPrefs().then((prefs) => {
  document.documentElement.dataset.theme = prefs.theme;
  setLanguage(prefs.language);
  useApp.getState().applyPrefs(prefs);

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
