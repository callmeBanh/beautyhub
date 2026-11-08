import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createPayOSWebhookSignature,
  timingSafeHexEqual,
} from "../_shared/payos.ts";

const maxBodyBytes = 64 * 1024;

async function readLimitedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
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
  return JSON.parse(new TextDecoder().decode(bytes)) as {
    code?: unknown;
    success?: unknown;
    data?: Record<string, unknown>;
    signature?: unknown;
  };
}

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return reply(405, { error: "Method not allowed." });
  if (Number(request.headers.get("content-length") || 0) > maxBodyBytes) {
    return reply(413, { error: "Request too large." });
  }

  let body: Awaited<ReturnType<typeof readLimitedBody>>;
  try {
    body = await readLimitedBody(request);
  } catch {
    return reply(400, { error: "Invalid webhook body." });
  }
  const checksumKey = Deno.env.get("PAYOS_CHECKSUM_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!checksumKey || !supabaseUrl || !serviceKey) {
    return reply(503, { error: "Webhook is not configured." });
  }
  if (
    !body.data ||
    typeof body.data !== "object" ||
    Array.isArray(body.data) ||
    typeof body.signature !== "string"
  ) {
    return reply(400, { error: "Invalid webhook fields." });
  }

  try {
    const expected = await createPayOSWebhookSignature(body.data, checksumKey);
    if (!timingSafeHexEqual(body.signature, expected)) {
      return reply(401, { error: "Invalid signature." });
    }
    if (body.code === "00" && Object.keys(body.data).length === 0) {
      return reply(200, { code: "00", desc: "success" });
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
      return reply(400, { error: "Invalid webhook fields." });
    }
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
    return reply(500, { error: "Could not verify or record webhook." });
  }
});
