export const getCurrentScale = () =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--font-scale")) || 1;

export const setFontScale = (scale) => {
  document.documentElement.style.setProperty("--font-scale", scale);
};

export const increaseFont = () => {
  const scale = Math.min(getCurrentScale() + 0.1, 2);
  setFontScale(scale);
};

export const decreaseFont = () => {
  const scale = Math.max(getCurrentScale() - 0.1, 0.5);
  setFontScale(scale);
};

export const resetFont = () => {
  setFontScale(1);
};
