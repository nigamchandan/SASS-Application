const EVENT = 'dashboard:refresh';

export function emitDashboardRefresh(reason = 'unknown') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { reason } }));
}

export function subscribeDashboardRefresh(handler) {
  if (typeof window === 'undefined') return () => {};
  const wrapped = (e) => handler(e?.detail || {});
  window.addEventListener(EVENT, wrapped);
  return () => window.removeEventListener(EVENT, wrapped);
}
