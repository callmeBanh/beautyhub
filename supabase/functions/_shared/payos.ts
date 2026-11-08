type JsonRecord = Record<string, unknown>;

export function isPayOSWebhookProbe(body: {
  code?: unknown;
  desc?: unknown;
  success?: unknown;
  data?: unknown;
  signature?: unknown;
}) {
  return (
    body.code === "00" &&
    body.desc === "success" &&
    body.success === true &&
    typeof body.signature === "string" &&
    body.signature.length > 0 &&
    body.data !== null &&
    typeof body.data === "object" &&
    !Array.isArray(body.data) &&
    Object.keys(body.data).length === 0
  );
}

function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, sortedValue(item)]),
    );
  }
  return value;
}

export function canonicalPayOSData(data: JsonRecord) {
  const sorted = sortedValue(data) as JsonRecord;
  return Object.keys(sorted)
    .map((key) => {
      const value = sorted[key];
      const serialized =
        value === null || value === undefined
          ? ""
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
      return `${encodeURIComponent(key)}=${encodeURIComponent(serialized)}`;
    })
    .join("&");
}

async function hmacSha256(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function createPayOSWebhookSignature(data: JsonRecord, secret: string) {
  return hmacSha256(secret, canonicalPayOSData(data));
}

export function createPayOSLinkSignature(
  input: {
    amount: number;
    cancelUrl: string;
    description: string;
    orderCode: number;
    returnUrl: string;
  },
  secret: string,
) {
  const canonical = [
    `amount=${input.amount}`,
    `cancelUrl=${input.cancelUrl}`,
    `description=${input.description}`,
    `orderCode=${input.orderCode}`,
    `returnUrl=${input.returnUrl}`,
  ].join("&");
  return hmacSha256(secret, canonical);
}

export function timingSafeHexEqual(actual: string, expected: string) {
  if (
    !/^[0-9a-f]{64}$/i.test(actual) ||
    !/^[0-9a-f]{64}$/i.test(expected) ||
    actual.length !== expected.length
  ) {
    return false;
  }
  const normalizedActual = actual.toLowerCase();
  const normalizedExpected = expected.toLowerCase();
  let mismatch = 0;
  for (let index = 0; index < normalizedActual.length; index += 1) {
    mismatch |=
      normalizedActual.charCodeAt(index) ^ normalizedExpected.charCodeAt(index);
  }
  return mismatch === 0;
}
