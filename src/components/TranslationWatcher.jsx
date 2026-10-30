import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Watches for route changes and re-triggers Google Translate
 * if a non-English language is saved in the cookie.
 */
const TranslationWatcher = () => {
  const location = useLocation();

  useEffect(() => {
    // Give React a fraction of a second to render the new page's DOM
    const timer = setTimeout(() => {
      // Check if a language cookie exists
      const match = document.cookie.match(/(^| )googtrans=([^;]+)/);
      if (match) {
        const savedLang = match[2].split("/").pop();

        // If a language other than English is selected, trigger translation
        if (savedLang && savedLang !== "en") {
          const combo = document.querySelector(".goog-te-combo");
          if (combo) {
            combo.value = savedLang;
            // Dispatch a change event to force Google Translate to re-process the new DOM
            combo.dispatchEvent(new Event("change"));
          }
        }
      }
    }, 200); // 200ms delay ensures the new page's text is in the DOM first

    return () => clearTimeout(timer);
  }, [location.pathname]); // Re-runs every time the URL path changes

  // This component renders absolutely nothing to the screen
  return null;
};

export default TranslationWatcher;
