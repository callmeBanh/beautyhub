import { loadEnv } from "vite";
import { checkReleaseConfig } from "./release-checks.mjs";
const env = loadEnv("production", process.cwd(), "VITE_");
const checks = checkReleaseConfig(env);
for (const check of checks)
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.check}`);
console.log(
  "Chỉ kiểm tra cấu hình tại máy, không kết nối Supabase và không xác nhận đủ điều kiện mở nhận tiền. Xem MARKET_LAUNCH.md.",
);
if (checks.some((check) => !check.ok)) process.exitCode = 1;
