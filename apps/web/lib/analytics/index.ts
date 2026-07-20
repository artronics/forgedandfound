declare global {
  interface Window {
    dataLayer?: object[];
  }
}

export function pushEvent(event: object) {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}