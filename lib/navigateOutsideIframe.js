export function isEmbeddedWindow() {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function navigateOutsideIframe(url, { replace = false } = {}) {
  if (typeof window === "undefined") return false;

  const shouldUseTop = isEmbeddedWindow();
  const targetWindow = shouldUseTop && window.top ? window.top : window;

  try {
    if (replace) {
      targetWindow.location.replace(url);
    } else {
      targetWindow.location.assign(url);
    }
    return true;
  } catch {
    try {
      if (replace) {
        window.location.replace(url);
      } else {
        window.location.assign(url);
      }
      return true;
    } catch {
      return false;
    }
  }
}
