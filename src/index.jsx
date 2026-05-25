// At the TOP of your main entry file
import '@tensorflow/tfjs';

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "bootstrap/dist/css/bootstrap.min.css";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";

// src/index.jsx - Add at very top, before any imports

// Suppress TensorFlow.js warnings
const originalWarn = console.warn;
console.warn = (...args) => {
    const msg = args[0]?.toString() || '';
    if (
        msg.includes('already been set') ||
        msg.includes('already registered') ||
        msg.includes('Reusing existing backend') ||
        msg.includes('Future Flag Warning') ||
        msg.includes('Source map error')
    ) {
        return;
    }
    originalWarn.apply(console, args);
};

// Suppress Google Translate and WASM errors
const originalError = console.error;
console.error = (...args) => {
    const msg = args[0]?.toString() || '';
    if (
        msg.includes('Error loading Google Translate') ||
        (msg.includes('Source map error') && msg.includes('wasm:')) ||
        msg.includes('URL constructor') && msg.includes('is not a valid URL')
    ) {
        return;
    }
    originalError.apply(console, args);
};

const root = createRoot(document.getElementById("root")); // Create a root
root.render(<App />);
