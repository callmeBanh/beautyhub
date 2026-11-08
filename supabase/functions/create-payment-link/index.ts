import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPayOSLinkSignature } from "../_shared/payos.ts";

const responseHeaders = { "content-type": "application/json" };
const maxBodyBytes = 16 * 1024;
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function reply(status: number, body: Record<string, unknown>, origin?: string) {
  const corsHeaders =
    origin && allowedOrigins.includes(origin)
      ? {
          "access-control-allow-origin": origin,
          "access-control-allow-headers": "authorization, apikey, content-type",
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

async function readJson(request: Request) {
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
    bookingId?: unknown;
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || undefined;
  if (request.method === "OPTIONS") {
    return origin && allowedOrigins.includes(origin)
      ? reply(204, {}, origin)
      : reply(403, { error: "Origin not allowed." });
  }
  if (request.method !== "POST") return reply(405, { error: "Method not allowed." });
  if (origin && !allowedOrigins.includes(origin)) {
    return reply(403, { error: "Origin not allowed." });
  }
  if (Number(request.headers.get("content-length") || 0) > maxBodyBytes) {
    return reply(413, { error: "Request too large." }, origin);
  }

  try {
    const body = await readJson(request);
    if (
      typeof body.bookingId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        body.bookingId,
      )
    ) {
      return reply(400, { error: "Invalid booking." }, origin);
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
    const { data: booking, error: bookingError } = await service
      .from("bookings")
      .select("id,customer_id,status,deposit,hold_until")
      .eq("id", body.bookingId)
      .maybeSingle();
    if (bookingError) throw new Error("Could not load booking.");
    if (!booking) return reply(404, { error: "Booking not found." }, origin);
    if (booking.customer_id !== authData.user.id) {
      return reply(403, { error: "Booking is not owned by caller." }, origin);
    }
    if (
      booking.status !== "AWAITING_DEPOSIT" ||
      !booking.hold_until ||
      Date.parse(booking.hold_until) <= Date.now() ||
      !Number.isSafeInteger(booking.deposit) ||
      booking.deposit <= 0
    ) {
      return reply(409, { error: "Booking is not awaiting a deposit." }, origin);
    }

    const expiresAt = Math.min(
      Date.now() + 6 * 60 * 60 * 1000,
      Date.parse(booking.hold_until),
    );
    const { data: reserved, error: reserveError } = await service
      .rpc("reserve_payos_payment_link", {
        p_booking_id: booking.id,
        p_expires_at: new Date(expiresAt).toISOString(),
      })
      .single();
    if (reserveError || !reserved) throw new Error("Could not reserve payment link.");
    if (reserved.checkout_url && reserved.expires_at) {
      return reply(
        200,
        {
          checkoutUrl: reserved.checkout_url,
          qrCode: reserved.qr_code,
          expiresAt: reserved.expires_at,
        },
        origin,
      );
    }

    const orderCode = Number(reserved.payos_order_code);
    const amount = Number(reserved.amount);
    const description = `BH${String(orderCode).slice(-7)}`;
    const returnUrl = new URL(`/bookings/${booking.id}`, base).toString();
    const cancelUrl = returnUrl;
    const signature = await createPayOSLinkSignature(
      { amount, cancelUrl, description, orderCode, returnUrl },
      checksumKey,
    );
    const payload = {
      orderCode,
      amount,
      description,
      items: [{ name: "BeautyHub deposit", quantity: 1, price: amount }],
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
      typeof payment?.qrCode !== "string" ||
      typeof payment?.paymentLinkId !== "string"
    ) {
      throw new Error("PayOS could not create the payment link.");
    }
    const { error: updateError } = await service
      .from("payment_links")
      .update({
        payment_link_id: payment.paymentLinkId,
        checkout_url: payment.checkoutUrl,
        qr_code: payment.qrCode,
      })
      .eq("id", reserved.id);
    if (updateError) throw new Error("Could not save payment link.");
    return reply(
      200,
      {
        checkoutUrl: payment.checkoutUrl,
        qrCode: payment.qrCode,
        expiresAt: reserved.expires_at,
      },
      origin,
    );
  } catch {
    return reply(503, { error: "Could not create a PayOS payment link." }, origin);
  }
});
