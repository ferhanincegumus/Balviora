import { base44 } from "@/api/base44Client";

const ONCE_KEY = "ds_landing_events";

function alreadyFired(name) {
  try {
    const seen = JSON.parse(sessionStorage.getItem(ONCE_KEY) || "[]");
    return seen.includes(name);
  } catch {
    return false;
  }
}

function markFired(name) {
  try {
    const seen = JSON.parse(sessionStorage.getItem(ONCE_KEY) || "[]");
    if (!seen.includes(name)) {
      seen.push(name);
      sessionStorage.setItem(ONCE_KEY, JSON.stringify(seen));
    }
  } catch {
    /* ignore */
  }
}

export function trackEvent(name, properties = {}) {
  try {
    base44.analytics.track({ eventName: name, properties });
  } catch {
    /* console-safe: never break the page */
  }
}

export function trackOnce(name, properties = {}) {
  if (alreadyFired(name)) return;
  markFired(name);
  trackEvent(name, properties);
}