export type VietQrBank = { bin: string; shortName: string };

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

export const VIETQR_BANKS: VietQrBank[] = [
  { bin: "970425", shortName: "ABBANK" },
  { bin: "970416", shortName: "ACB" },
  { bin: "970405", shortName: "Agribank" },
  { bin: "970409", shortName: "BacABank" },
  { bin: "970438", shortName: "BaoVietBank" },
  { bin: "555666", shortName: "BIDC" },
  { bin: "970418", shortName: "BIDV" },
  { bin: "963666", shortName: "BNP HCM" },
  { bin: "963668", shortName: "BNP HN" },
  { bin: "963688", shortName: "BOCHK" },
  { bin: "970465", shortName: "BSP" },
  { bin: "546034", shortName: "CAKE" },
  { bin: "970444", shortName: "CBBank" },
  { bin: "422589", shortName: "CIMB" },
  { bin: "533948", shortName: "Citibank" },
  { bin: "970446", shortName: "COOPBANK" },
  { bin: "168999", shortName: "CUBHCM" },
  { bin: "796500", shortName: "DBSBank" },
  { bin: "963686", shortName: "ESUN" },
  { bin: "970431", shortName: "Eximbank" },
  { bin: "970408", shortName: "GPBank" },
  { bin: "970437", shortName: "HDBank" },
  { bin: "970442", shortName: "HongLeong" },
  { bin: "458761", shortName: "HSBC" },
  { bin: "970456", shortName: "IBKHCM" },
  { bin: "970455", shortName: "IBKHN" },
  { bin: "963669", shortName: "ICBC" },
  { bin: "970434", shortName: "IndovinaBank" },
  { bin: "668888", shortName: "KBank" },
  { bin: "970466", shortName: "KEBHanaHCM" },
  { bin: "970467", shortName: "KEBHANAHN" },
  { bin: "970452", shortName: "KienLongBank" },
  { bin: "970463", shortName: "KookminHCM" },
  { bin: "970462", shortName: "KookminHN" },
  { bin: "970449", shortName: "LPBank" },
  { bin: "977777", shortName: "MAFC" },
  { bin: "970422", shortName: "MBBank" },
  { bin: "970414", shortName: "MBV" },
  { bin: "971025", shortName: "MoMo" },
  { bin: "970426", shortName: "MSB" },
  { bin: "971032", shortName: "MVAS" },
  { bin: "970428", shortName: "NamABank" },
  { bin: "970419", shortName: "NCB" },
  { bin: "801011", shortName: "Nonghyup" },
  { bin: "970448", shortName: "OCB" },
  { bin: "970430", shortName: "PGBank" },
  { bin: "970439", shortName: "PublicBank" },
  { bin: "970412", shortName: "PVcomBank" },
  { bin: "971133", shortName: "PVcomBank Pay" },
  { bin: "970403", shortName: "Sacombank" },
  { bin: "970400", shortName: "SaigonBank" },
  { bin: "970429", shortName: "SCB" },
  { bin: "970440", shortName: "SeABank" },
  { bin: "970443", shortName: "SHB" },
  { bin: "970424", shortName: "ShinhanBank" },
  { bin: "970410", shortName: "StandardChartered" },
  { bin: "970407", shortName: "Techcombank" },
  { bin: "963388", shortName: "Timo" },
  { bin: "963326", shortName: "TNEX" },
  { bin: "970423", shortName: "TPBank" },
  { bin: "546035", shortName: "Ubank" },
  { bin: "970458", shortName: "UnitedOverseas" },
  { bin: "999888", shortName: "VBSP" },
  { bin: "970441", shortName: "VIB" },
  { bin: "970427", shortName: "VietABank" },
  { bin: "970433", shortName: "VietBank" },
  { bin: "970454", shortName: "VietCapitalBank" },
  { bin: "970436", shortName: "Vietcombank" },
  { bin: "970415", shortName: "VietinBank" },
  { bin: "971005", shortName: "ViettelMoney" },
  { bin: "970406", shortName: "Vikki" },
  { bin: "971011", shortName: "VNPTMoney" },
  { bin: "970432", shortName: "VPBank" },
  { bin: "970421", shortName: "VRB" },
  { bin: "970457", shortName: "Woori" },
  { bin: "971101", shortName: "ZaloPay" },
];

export function buildVietQrUrl(params: {
  bankBin: string;
  accountNo: string;
  accountHolder: string;
  amount: number;
  memo: string;
}): string {
  const accountNo = params.accountNo.replace(/\s+/g, "");
  const query = new URLSearchParams({
    amount: String(params.amount),
    addInfo: params.memo.trim(),
    accountName: params.accountHolder.trim(),
  });
  return `https://img.vietqr.io/image/${params.bankBin}-${accountNo}-compact2.png?${query}`;
}
