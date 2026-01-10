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

  let resolvedUrl = url;
  try {
    resolvedUrl = new URL(url, window.location.origin).toString();
  } catch {
    resolvedUrl = url;
  }

  const shouldUseTop = isEmbeddedWindow();
  const navMethod = replace ? "replace" : "assign";

  if (!shouldUseTop) {
    try {
      window.location[navMethod](resolvedUrl);
      return true;
    } catch {
      return false;
    }
  }

  try {
    window.top.location[navMethod](resolvedUrl);
    return true;
  } catch {
    try {
      window.parent.location[navMethod](resolvedUrl);
      return true;
    } catch {
      try {
        window.open(resolvedUrl, "_top");
        return true;
      } catch {
        return false;
      }
    }
  }
}
