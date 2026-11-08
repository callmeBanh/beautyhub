const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() || "";
const consentStorageKey = "beautyhub.analytics-consent";
export const consentSettingsEvent = "beautyhub:open-consent-settings";

type ConsentChoice = "granted" | "denied";
export type AnalyticsParameters = {
  service_type?: string;
  search_term?: string;
  package_id?: string;
};
type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

let consentModeInitialized = false;
let configuredForSession = false;
let memoryConsent: boolean | null | undefined;
let lastPageViewPath: string | null = null;

const isConfigured = () => /^G-[A-Z0-9]+$/i.test(measurementId);

function ensureGtagQueue() {
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function (...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  if (!consentModeInitialized) {
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("js", new Date());
    consentModeInitialized = true;
  }
}

function loadAnalytics() {
  if (!isConfigured() || configuredForSession) return;
  ensureGtagQueue();
  window.gtag!("config", measurementId, { send_page_view: false });
  const script = document.createElement("script");
  script.id = "beautyhub-ga-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
  configuredForSession = true;
}

function applyConsent(choice: ConsentChoice) {
  if (!isConfigured()) return;
  ensureGtagQueue();
  window.gtag!("consent", "update", {
    analytics_storage: choice,
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  if (choice === "granted") loadAnalytics();
}

export function analyticsConfigured() {
  return isConfigured();
}

export function getAnalyticsConsent(): boolean | null {
  if (memoryConsent !== undefined) return memoryConsent;
  try {
    const saved = localStorage.getItem(consentStorageKey);
    if (saved === "accepted") return true;
    if (saved === "rejected") return false;
    return null;
  } catch {
    return null;
  }
}

export function initializeAnalytics() {
  if (!isConfigured()) return;
  ensureGtagQueue();
  const saved = getAnalyticsConsent();
  if (saved !== null) applyConsent(saved ? "granted" : "denied");
}

export function setAnalyticsConsent(granted: boolean) {
  memoryConsent = granted;
  if (!granted) lastPageViewPath = null;
  let persisted = true;
  try {
    localStorage.setItem(consentStorageKey, granted ? "accepted" : "rejected");
  } catch {
    persisted = false;
  }
  applyConsent(granted ? "granted" : "denied");
  return persisted;
}

export function trackPageView(pathname: string) {
  if (!isConfigured() || getAnalyticsConsent() !== true || !window.gtag) return;
  const pagePath = pathname
    .replace(/^\/creators\/[^/]+$/, "/creators/:creator")
    .replace(/^\/checkout\/[^/]+$/, "/checkout/:package")
    .replace(/^\/bookings\/[^/]+$/, "/bookings/:booking");
  if (pathname === lastPageViewPath) return;
  window.gtag("event", "page_view", {
    page_path: pagePath,
    page_location: `${window.location.origin}${pagePath}`,
    page_title: document.title,
  });
  lastPageViewPath = pathname;
}

export function trackAnalyticsEvent(
  event: string,
  parameters: AnalyticsParameters = {},
) {
  if (!isConfigured() || getAnalyticsConsent() !== true || !window.gtag) return;
  const gaEvents: Record<string, string> = {
    search: "search",
    booking_started: "booking_started",
    provider_view: "view_creator",
    package_view: "select_package",
    view_slots: "view_slots",
    booking_submitted: "begin_checkout",
    sign_up: "sign_up",
    login: "login",
  };
  const gaEvent = gaEvents[event];
  if (!gaEvent) return;
  const safeParameters: AnalyticsParameters = {};
  if (parameters.service_type) safeParameters.service_type = parameters.service_type;
  if (parameters.package_id) safeParameters.package_id = parameters.package_id;
  const searchTerm = parameters.search_term?.trim();
  if (
    searchTerm &&
    searchTerm.length <= 100 &&
    !/@|(?:\+?\d[\d\s().-]{7,}\d)/.test(searchTerm)
  ) {
    safeParameters.search_term = searchTerm;
  }
  window.gtag("event", gaEvent, safeParameters);
}
