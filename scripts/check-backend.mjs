import { loadEnv } from "vite";
import { writeFile } from "node:fs/promises";
import { isPublicKey } from "./public-key.mjs";
import { publicHttps } from "./release-checks.mjs";

const env = loadEnv("production", process.cwd(), "VITE_");
if (env.VITE_BACKEND_ENABLED !== "true") {
  console.log(
    "Backend đang được để lại cho bước sau; không gửi yêu cầu tới Supabase. Bật VITE_BACKEND_ENABLED=true khi có project của bạn.",
  );
  process.exit(2);
}
const origin = env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const key = env.VITE_SUPABASE_ANON_KEY;
if (!origin?.startsWith("https://") || !isPublicKey(key)) {
  console.error("Thiếu URL HTTPS hoặc public key Supabase. Xem .env.example.");
  process.exit(1);
}
const endpoints = [
  "rest/v1/rpc/product_health",
  "rest/v1/rpc/public_settings",
  "rest/v1/rpc/provider_catalog",
  "auth/v1/settings",
];
const results = await Promise.all(
  endpoints.map(async (path) => {
    try {
      const response = await fetch(`${origin}/${path}`, {
        headers: { apikey: key },
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      const shapeValid = path.endsWith("product_health")
        ? data?.schema_version === "202610230001"
        : path.endsWith("provider_catalog")
          ? Array.isArray(data?.items) &&
            data.items.length <= 24 &&
            Number.isInteger(data.total) &&
            data.total >= 0
          : path.endsWith("public_settings")
            ? Array.isArray(data) &&
              data.length === 1 &&
              typeof data[0].ready === "boolean" &&
              publicHttps(data[0].support_url) &&
              (data[0].cancellation_policy || "").length >= 50 &&
              Number.isInteger(data[0].policy_version) &&
              data[0].policy_version > 0
            : data?.external?.google === true;
      return {
        check: path.split("/").pop(),
        ok: response.ok && shapeValid,
        status: response.status,
        ...(path.endsWith("product_health") && response.ok
          ? { schema: data.schema_version }
          : {}),
        ...(path.endsWith("public_settings") && response.ok
          ? { bookingOpen: Boolean(data?.[0]?.ready) }
          : {}),
        ...(path.startsWith("auth/") && response.ok
          ? { googleEnabled: Boolean(data.external?.google) }
          : {}),
        ...(!response.ok ? { errorCode: data.code || "HTTP_ERROR" } : {}),
        ...(response.ok && !shapeValid
          ? { errorCode: "CONFIG_OR_SCHEMA_MISMATCH" }
          : {}),
      };
    } catch {
      return {
        check: path.split("/").pop(),
        ok: false,
        errorCode: "NETWORK_ERROR",
      };
    }
  }),
);
// No key, URL, email or profile data is written to the report.
const report = { checkedAt: new Date().toISOString(), results };
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes("--save"))
  await writeFile("backend-status.json", JSON.stringify(report, null, 2));
if (
  results.some((row) => !row.ok) ||
  results.find((row) => row.check === "product_health")?.schema !==
    "202610230001"
)
  process.exitCode = 1;
