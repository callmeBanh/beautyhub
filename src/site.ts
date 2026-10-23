import { publicHttps } from "../scripts/release-checks.mjs";
const publicUrl = (value: string | undefined) =>
  value && publicHttps(value) ? value : "";
export const site = {
  origin: publicUrl(import.meta.env.VITE_SITE_URL),
  support: publicUrl(import.meta.env.VITE_SUPPORT_URL),
  privacy: publicUrl(import.meta.env.VITE_PRIVACY_URL),
  operator: (import.meta.env.VITE_OPERATOR_NAME || "").trim(),
  policyDate: (import.meta.env.VITE_POLICY_UPDATED_AT || "").trim(),
  retention: (import.meta.env.VITE_DATA_RETENTION || "").trim(),
};
