import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPayOSLinkSignature } from "../_shared/payos.ts";

const responseHeaders = { "content-type": "application/json" };
const maxBodyBytes = 16 * 1024;
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

function reply(status: number, body: Record<string, unknown>, origin?: string) {
  const normalizedOrigin = origin?.trim().replace(/\/+$/, "");
  const corsHeaders =
    normalizedOrigin && allowedOrigins.includes(normalizedOrigin)
      ? {
          "access-control-allow-origin": normalizedOrigin,
          "access-control-allow-headers":
            "authorization, apikey, content-type, x-client-info",
          "access-control-allow-methods": "POST, OPTIONS",
          vary: "Origin",
        }
      : {};
  const headers = { ...responseHeaders, ...corsHeaders };
  if (status === 204) return new Response(null, { status, headers });
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) return {};
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
  if (size === 0) return {};
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes).trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || undefined;
  const normalizedOrigin = origin?.trim().replace(/\/+$/, "");
  if (request.method === "OPTIONS") {
    if (!normalizedOrigin || !allowedOrigins.includes(normalizedOrigin)) {
      return reply(403, { error: "Origin not allowed." });
    }
    return reply(204, {}, origin);
  }
  if (request.method !== "POST") {
    return reply(405, { error: "Method not allowed." });
  }
  if (
    origin &&
    (!normalizedOrigin || !allowedOrigins.includes(normalizedOrigin))
  ) {
    return reply(403, { error: "Origin not allowed." });
  }
  if (Number(request.headers.get("content-length") || 0) > maxBodyBytes) {
    return reply(413, { error: "Request too large." }, origin);
  }

  try {
    try {
      await readJson(request);
    } catch (error) {
      if (error instanceof Error && error.message === "Body too large") {
        return reply(413, { error: "Request too large." }, origin);
      }
    }

    const authorization = request.headers.get("authorization") || "";
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return reply(401, { error: "Authentication required." }, origin);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientId = Deno.env.get("PAYOS_CLIENT_ID");
    const apiKey = Deno.env.get("PAYOS_API_KEY");
    const checksumKey = Deno.env.get("PAYOS_CHECKSUM_KEY");
    const appBaseUrl = Deno.env.get("APP_BASE_URL");
    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceKey ||
      !clientId ||
      !apiKey ||
      !checksumKey ||
      !appBaseUrl
    ) {
      return reply(503, { error: "PayOS is not configured." }, origin);
    }
    const base = new URL(appBaseUrl);
    if (base.protocol !== "https:") {
      return reply(503, { error: "Application URL must use HTTPS." }, origin);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);
    if (authError || !authData.user) {
      return reply(401, { error: "Authentication required." }, origin);
    }

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: provider, error: providerError } = await service
      .from("providers")
      .select("id,status")
      .eq("owner_id", authData.user.id)
      .maybeSingle();
    if (providerError) throw new Error("Could not load creator profile.");
    if (!provider) {
      return reply(404, { error: "Creator profile not found." }, origin);
    }
    if (provider.status === "SUSPENDED") {
      return reply(403, { error: "Creator profile is suspended." }, origin);
    }

    const expiresAt = Date.now() + 6 * 60 * 60 * 1000;
    const { data: reserved, error: reserveError } = await service
      .rpc("reserve_subscription_order", {
        p_provider_id: provider.id,
        p_expires_at: new Date(expiresAt).toISOString(),
      })
      .single();
    if (reserveError || !reserved) {
      throw new Error("Could not reserve subscription order.");
    }
    if (reserved.checkout_url) {
      return reply(
        200,
        {
          checkoutUrl: reserved.checkout_url,
          expiresAt: reserved.expires_at,
        },
        origin,
      );
    }

    const orderCode = Number(reserved.payos_order_code);
    const amount = Number(reserved.amount);
    if (
      !Number.isSafeInteger(orderCode) ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      throw new Error("Invalid order data.");
    }

    const description = `BH${String(orderCode).slice(-7)}`;
    const returnUrl = new URL("/studio?tab=subscription", base).toString();
    const cancelUrl = returnUrl;
    const signature = await createPayOSLinkSignature(
      { amount, cancelUrl, description, orderCode, returnUrl },
      checksumKey,
    );
    const payload = {
      orderCode,
      amount,
      description,
      items: [
        {
          name: "BeautyHub Creator Subscription",
          quantity: 1,
          price: amount,
        },
      ],
      cancelUrl,
      returnUrl,
      expiredAt: Math.floor(expiresAt / 1000),
      signature,
    };
    const payosResponse = await fetch(
      "https://api-merchant.payos.vn/v2/payment-requests",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-client-id": clientId,
          "x-api-key": apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      },
    );
    const payosResult = await payosResponse.json().catch(() => null);
    const payment = payosResult?.data;
    if (
      !payosResponse.ok ||
      payosResult?.code !== "00" ||
      typeof payment?.checkoutUrl !== "string" ||
      typeof payment?.paymentLinkId !== "string"
    ) {
      throw new Error("PayOS could not create the subscription payment link.");
    }

    const { error: updateError } = await service
      .from("subscription_orders")
      .update({
        payos_payment_link_id: payment.paymentLinkId,
        checkout_url: payment.checkoutUrl,
      })
      .eq("id", reserved.id);
    if (updateError) {
      throw new Error("Could not save subscription order payment link.");
    }

    return reply(
      200,
      {
        checkoutUrl: payment.checkoutUrl,
        expiresAt: reserved.expires_at,
      },
      origin,
    );
  } catch (error) {
    console.error("create-subscription-link: failed", {
      step: error instanceof Error ? error.message : "unknown",
    });
    return reply(
      503,
      { error: "Could not create a PayOS subscription link." },
      origin,
    );
  }
});
