export const BANK_MAP: Record<string, string> = {
  vietcombank: "vietcombank",
  vcb: "vietcombank",
  techcombank: "techcombank",
  tcb: "techcombank",
  mbbank: "mbbank",
  mb: "mbbank",
  tpbank: "tpbank",
  tpb: "tpbank",
  vpbank: "vpbank",
  vpb: "vpbank",
  acb: "acb",
  bidv: "bidv",
  vietinbank: "vietinbank",
  ctg: "vietinbank",
  agribank: "agribank",
  sacombank: "sacombank",
  stb: "sacombank",
  ocb: "ocb",
  hdbank: "hdbank",
  shb: "shb",
  msb: "msb",
  vib: "vib",
  seabank: "seabank",
  eximbank: "eximbank",
  eib: "eximbank",
  lpbank: "lpbank",
  lienvietpostbank: "lpbank",
  timo: "timo",
  cake: "cake",
};

/**
 * Normalizes user-entered bank name into a standardized VietQR bank code.
 */
export function resolveBankCode(bankName: string): string {
  if (!bankName) return "vietcombank";
  const normalized = bankName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

  for (const [key, code] of Object.entries(BANK_MAP)) {
    if (normalized.includes(key)) return code;
  }
  return normalized || "vietcombank";
}

/**
 * Builds a standardized VietQR quicklink image URL.
 */
export function buildVietQrUrl(params: {
  bankName: string;
  accountNo: string;
  accountHolder: string;
  amount: number;
  memo: string;
}): string {
  const bankCode = resolveBankCode(params.bankName);
  const cleanAccount = params.accountNo.replace(/\s+/g, "");
  const encMemo = encodeURIComponent(params.memo.trim());
  const encHolder = encodeURIComponent(params.accountHolder.trim());
  return `https://img.vietqr.io/image/${bankCode}-${cleanAccount}-compact2.png?amount=${params.amount}&addInfo=${encMemo}&accountName=${encHolder}`;
}

