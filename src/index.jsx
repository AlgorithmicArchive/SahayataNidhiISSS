// ============================================
// CSP NONCE - MUST BE FIRST (before any imports)
// ============================================
const nonceMeta = document.querySelector('meta[name="csp-nonce"]');
if (nonceMeta && nonceMeta.content) {
  // Set Webpack's global nonce for dynamic chunks and inline scripts
  __webpack_nonce__ = nonceMeta.content;
}

// ============================================
// IMPORTS
// ============================================
import "@tensorflow/tfjs";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "bootstrap/dist/css/bootstrap.min.css";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";
import * as pdfjsLib from "pdfjs-dist";

// Set worker source to the file you copied to wwwroot/js/
pdfjsLib.GlobalWorkerOptions.workerSrc = "/js/pdf.worker.min.js";

// ============================================
// CONSOLE SUPPRESSIONS
// ============================================

// Suppress TensorFlow.js warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  const msg = args[0]?.toString() || "";
  if (
    msg.includes("already been set") ||
    msg.includes("already registered") ||
    msg.includes("Reusing existing backend") ||
    msg.includes("Future Flag Warning") ||
    msg.includes("Source map error")
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

// Suppress Google Translate and WASM errors
const originalError = console.error;
console.error = (...args) => {
  const msg = args[0]?.toString() || "";
  if (
    msg.includes("Error loading Google Translate") ||
    (msg.includes("Source map error") && msg.includes("wasm:")) ||
    (msg.includes("URL constructor") && msg.includes("is not a valid URL"))
  ) {
    return;
  }
  originalError.apply(console, args);
};

// ============================================
// RENDER
// ============================================
const root = createRoot(document.getElementById("root"));
root.render(<App />);
