import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createPayOSWebhookSignature,
  timingSafeHexEqual,
} from "../_shared/payos.ts";

const maxBodyBytes = 64 * 1024;

type WebhookBody = {
  code?: unknown;
  desc?: unknown;
  success?: unknown;
  data?: Record<string, unknown>;
  signature?: unknown;
};

async function readLimitedBody(
  request: Request,
  onLength: (length: number) => void,
): Promise<WebhookBody> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    onLength(size);
    if (size > maxBodyBytes) {
      await reader.cancel();
      throw new Error("Body too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as WebhookBody;
}

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function logRejection(
  step: string,
  bodyLength: number,
  body?: WebhookBody,
) {
  const bodyFields =
    body && typeof body === "object" && !Array.isArray(body)
      ? Object.keys(body)
      : [];
  const dataFields =
    body?.data &&
    typeof body.data === "object" &&
    !Array.isArray(body.data)
      ? Object.keys(body.data)
      : [];
  console.warn(
    JSON.stringify({
      event: "payos_webhook_rejected",
      step,
      bodyLength,
      fieldNames: { body: bodyFields, data: dataFields },
    }),
  );
}

Deno.serve(async (request) => {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (request.method !== "POST") {
    logRejection("unsupported_method", contentLength);
    return reply(405, { error: "Method not allowed." });
  }
  if (contentLength > maxBodyBytes) {
    logRejection("body_too_large", contentLength);
    return reply(413, { error: "Request too large." });
  }

  let bodyLength = contentLength;
  let body: WebhookBody;
  try {
    body = await readLimitedBody(request, (length) => {
      bodyLength = length;
    });
  } catch {
    logRejection("invalid_body", bodyLength);
    return reply(400, { error: "Invalid webhook body." });
  }
  const checksumKey = Deno.env.get("PAYOS_CHECKSUM_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!checksumKey || !supabaseUrl || !serviceKey) {
    logRejection("missing_secret", bodyLength, body);
    return reply(503, { error: "Webhook is not configured." });
  }

  if (
    !body.data ||
    typeof body.data !== "object" ||
    Array.isArray(body.data) ||
    typeof body.signature !== "string"
  ) {
    logRejection("bad_fields", bodyLength, body);
    return reply(400, { error: "Invalid webhook fields." });
  }

  let step = "signature_verification";
  try {
    const expected = await createPayOSWebhookSignature(body.data, checksumKey);
    if (!timingSafeHexEqual(body.signature, expected)) {
      logRejection("signature_mismatch", bodyLength, body);
      return reply(401, { error: "Invalid signature." });
    }
    if (
      typeof body.data.orderCode !== "number" ||
      !Number.isSafeInteger(body.data.orderCode) ||
      typeof body.data.amount !== "number" ||
      !Number.isSafeInteger(body.data.amount) ||
      body.data.amount < 0 ||
      typeof body.data.reference !== "string" ||
      body.data.reference.length < 1 ||
      body.data.reference.length > 160
    ) {
      logRejection("bad_fields", bodyLength, body);
      return reply(400, { error: "Invalid webhook fields." });
    }
    step = "payment_recording";
    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await service.rpc("process_payos_payment", {
      p_event_id: `${body.data.orderCode}:${body.data.reference}`,
      p_order_code: body.data.orderCode,
      p_amount: body.data.amount,
      p_payload: {
        code: body.data.code ?? null,
        reference: body.data.reference,
        paymentLinkId: body.data.paymentLinkId ?? null,
        transactionDateTime: body.data.transactionDateTime ?? null,
      },
      p_success: body.success === true && body.data.code === "00",
    });
    if (error) return reply(500, { error: "Could not record payment event." });
    return reply(200, { code: "00", desc: "success" });
  } catch {
    logRejection(
      step === "signature_verification" ? "signature_error" : "recording_error",
      bodyLength,
      body,
    );
    return reply(500, { error: "Could not verify or record webhook." });
  }
});
