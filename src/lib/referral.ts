/**
 * Comprehensive referral code tracking helper.
 * Ensures collaborator attribution is persistently retained across
 * localStorage, sessionStorage, and first-party cookies (30 days).
 */

const REFERRAL_KEY = "editly_ref";
const SESSION_KEY = "editly_sid";
const CODE_REGEX = /^[a-zA-Z0-9_.-]{1,120}$/;

export function sanitizeReferralCode(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return CODE_REGEX.test(trimmed) ? trimmed : null;
}

export function saveReferralCode(code: string): void {
  const sanitized = sanitizeReferralCode(code);
  if (!sanitized || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(REFERRAL_KEY, sanitized);
  } catch {
    // Ignore storage quota/permission errors
  }

  try {
    window.sessionStorage.setItem(REFERRAL_KEY, sanitized);
  } catch {
    // Ignore
  }

  try {
    document.cookie = `${REFERRAL_KEY}=${encodeURIComponent(sanitized)}; path=/; max-age=2592000; SameSite=Lax`;
  } catch {
    // Ignore
  }
}

export function getReferralCode(): string | null {
  if (typeof window === "undefined") return null;

  // 1. URL query parameter has top precedence (checks ref, c, code, collab, collaborator)
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl =
      params.get("ref") ||
      params.get("c") ||
      params.get("code") ||
      params.get("collab") ||
      params.get("collaborator");
    const sanitizedUrl = sanitizeReferralCode(fromUrl);
    if (sanitizedUrl) {
      saveReferralCode(sanitizedUrl);
      return sanitizedUrl;
    }
  } catch {
    // Ignore
  }

  // 2. Check localStorage
  try {
    const fromLocal = sanitizeReferralCode(window.localStorage.getItem(REFERRAL_KEY));
    if (fromLocal) return fromLocal;
  } catch {
    // Ignore
  }

  // 3. Check sessionStorage
  try {
    const fromSession = sanitizeReferralCode(window.sessionStorage.getItem(REFERRAL_KEY));
    if (fromSession) return fromSession;
  } catch {
    // Ignore
  }

  // 4. Check cookies
  try {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${REFERRAL_KEY}=([^;]+)`));
    if (match && match[1]) {
      const fromCookie = sanitizeReferralCode(decodeURIComponent(match[1]));
      if (fromCookie) {
        saveReferralCode(fromCookie);
        return fromCookie;
      }
    }
  } catch {
    // Ignore
  }

  return null;
}

export function getVisitorSessionId(): string {
  if (typeof window === "undefined") return "guest-session";

  // Check localStorage
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
  } catch {
    // Ignore
  }

  // Check sessionStorage
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
  } catch {
    // Ignore
  }

  // Generate new unique session ID
  const newSid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  try {
    window.localStorage.setItem(SESSION_KEY, newSid);
  } catch {
    // Ignore
  }
  try {
    window.sessionStorage.setItem(SESSION_KEY, newSid);
  } catch {
    // Ignore
  }

  return newSid;
}

export function buildPermanentReferralUrl(code: string, basePath: string = "/"): string {
  if (typeof window === "undefined") {
    return `${basePath}${basePath.includes("?") ? "&" : "?"}ref=${code}`;
  }
  const origin = window.location.origin;
  const path = basePath.startsWith("/") ? basePath : `/${basePath}`;
  const sep = path.includes("?") ? "&" : "?";
  return `${origin}${path}${sep}ref=${encodeURIComponent(code)}`;
}
