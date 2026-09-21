import React from 'react';
import ReactDOM from "react-dom";
import './index.css';
import App from './App';

// Suppress known HiGlass upstream TypeError when external tileset servers are unreachable
if (typeof window !== "undefined") {
  window.addEventListener(
    "error",
    (event) => {
      const msg = event?.message || event?.error?.message || "";
      if (msg.includes("Cannot read properties of null (reading 'error')")) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        console.warn("[HiGlass] Handled unreachable tilesetInfo gracefully:", event.error);
        return true;
      }
    },
    true
  );

  window.addEventListener("unhandledrejection", (event) => {
    const msg = event?.reason?.message || "";
    if (msg.includes("Cannot read properties of null (reading 'error')")) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      console.warn("[HiGlass] Handled unreachable tilesetInfo promise rejection:", event.reason);
    }
  });
}

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('app')
);


