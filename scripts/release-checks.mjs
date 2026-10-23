// Local configuration checks only. Passing does not certify a live launch.
import { isPublicKey } from "./public-key.mjs";
export function publicHttps(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      !url.hostname.endsWith(".local") &&
      !/^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[|example\.|test\.)/i.test(
        url.hostname,
      ) &&
      !/(^|\.)(example\.(com|org|net)|invalid|test)$/.test(url.hostname) &&
      url.hostname.includes(".")
    );
  } catch {
    return false;
  }
}
export function checkReleaseConfig(env) {
  const site = env.VITE_SITE_URL || "";
  let siteIsOrigin = false;
  try {
    siteIsOrigin = new URL(site).origin === site.replace(/\/$/, "");
  } catch {
    /* Report only a check name, never configuration values. */
  }
  const operator = (env.VITE_OPERATOR_NAME || "").trim();
  const updated = env.VITE_POLICY_UPDATED_AT || "";
  return [
    { check: "backend_enabled", ok: env.VITE_BACKEND_ENABLED === "true" },
    {
      check: "public_supabase_key",
      ok: isPublicKey(env.VITE_SUPABASE_ANON_KEY),
    },
    {
      check: "supabase_https_origin",
      ok:
        publicHttps(env.VITE_SUPABASE_URL || "") &&
        (() => {
          try {
            return (
              new URL(env.VITE_SUPABASE_URL).origin ===
              env.VITE_SUPABASE_URL.replace(/\/$/, "")
            );
          } catch {
            return false;
          }
        })(),
    },
    { check: "public_site_origin", ok: publicHttps(site) && siteIsOrigin },
    { check: "public_support", ok: publicHttps(env.VITE_SUPPORT_URL || "") },
    {
      check: "public_privacy_channel",
      ok: publicHttps(env.VITE_PRIVACY_URL || ""),
    },
    {
      check: "named_operator",
      ok:
        operator.length >= 2 &&
        operator.length <= 160 &&
        !/placeholder|your name|tên.*đây|test|example|todo/i.test(operator),
    },
    {
      check: "policy_date",
      ok:
        /^\d{4}-\d{2}-\d{2}$/.test(updated) &&
        !Number.isNaN(Date.parse(updated)) &&
        new Date(updated).toISOString().slice(0, 10) === updated &&
        Date.parse(updated) <= Date.now(),
    },
    {
      check: "retention_disclosure",
      ok:
        (env.VITE_DATA_RETENTION || "").trim().length >= 40 &&
        !/placeholder|todo/i.test(env.VITE_DATA_RETENTION || ""),
    },
  ];
}
