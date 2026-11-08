type JsonRecord = Record<string, unknown>;

function sortObjDataByKey(value: object): JsonRecord {
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, (value as JsonRecord)[key]]),
  );
}

export function canonicalPayOSData(data: JsonRecord) {
  return Object.keys(data)
    .sort()
    .filter((key) => data[key] !== undefined)
    .map((key) => {
      let value = data[key];
      if (value && Array.isArray(value)) {
        value = JSON.stringify(
          value.map((item) =>
            item && typeof item === "object"
              ? sortObjDataByKey(item)
              : item,
          ),
        );
      }
      if ([null, undefined, "undefined", "null"].includes(value)) value = "";
      return `${key}=${value}`;
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
