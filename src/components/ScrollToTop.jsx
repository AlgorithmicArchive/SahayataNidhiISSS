// ScrollToTop.js
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      setTimeout(() => {
        // Scroll the window
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        // Scroll potential containers
        const containers = document.querySelectorAll(
          ".MuiContainer-root, .MuiBox-root, [style*='overflow'], [class*='collapse']"
        );
        containers.forEach((container) => {
          container.scrollTo({ top: 0, left: 0, behavior: "auto" });
        });
      }, 100); // Delay to account for rendering
    }
  }, [pathname, hash]);

  return null;
}
