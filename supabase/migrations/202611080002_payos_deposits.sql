CREATE SEQUENCE public.payos_order_code_seq
  AS bigint
  MINVALUE 1
  MAXVALUE 999999999
  START WITH 100000001
  NO CYCLE;

CREATE TABLE public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings,
  payos_order_code bigint NOT NULL UNIQUE,
  payment_link_id text UNIQUE,
  checkout_url text,
  qr_code text,
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payment_links_one_pending_per_booking
  ON public.payment_links(booking_id) WHERE status = 'PENDING';
CREATE INDEX payment_links_booking_created
  ON public.payment_links(booking_id, created_at DESC);
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_links_customer_read ON public.payment_links
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id AND b.customer_id = auth.uid()
  ));
REVOKE ALL ON public.payment_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payment_links TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payment_links TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.payos_order_code_seq TO service_role;

CREATE TABLE public.payment_events (
  id text PRIMARY KEY,
  order_code bigint NOT NULL,
  booking_id uuid REFERENCES public.bookings,
  amount integer NOT NULL CHECK (amount >= 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text NOT NULL,
  duplicate_count integer NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_events_review_queue
  ON public.payment_events(created_at DESC)
  WHERE result IN (
    'UNDERPAID_REVIEW',
    'EXPIRED_REVIEW',
    'BOOKING_NOT_AWAITING_DEPOSIT',
    'UNKNOWN_ORDER'
  );
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_events_admin_read ON public.payment_events
  FOR SELECT TO authenticated USING (public.is_admin());
REVOKE ALL ON public.payment_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payment_events TO authenticated;
GRANT SELECT, INSERT ON public.payment_events TO service_role;

ALTER TABLE public.audit_log ALTER COLUMN actor_id DROP NOT NULL;

CREATE FUNCTION public.reserve_payos_payment_link(
  p_booking_id uuid,
  p_expires_at timestamptz
) RETURNS SETOF public.payment_links
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  b public.bookings;
  existing_link public.payment_links;
BEGIN
  SELECT * INTO b
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF b.id IS NULL
     OR b.status <> 'AWAITING_DEPOSIT'
     OR b.hold_until IS NULL
     OR b.hold_until <= now()
     OR p_expires_at <= now()
     OR p_expires_at > b.hold_until THEN
    RAISE EXCEPTION 'Booking is not eligible for a payOS payment link.';
  END IF;

  SELECT * INTO existing_link
  FROM public.payment_links
  WHERE booking_id = p_booking_id
    AND status = 'PENDING'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF existing_link.id IS NOT NULL THEN
    IF existing_link.checkout_url IS NULL
       AND existing_link.created_at < now() - interval '2 minutes' THEN
      UPDATE public.payment_links
      SET status = 'CANCELLED'
      WHERE id = existing_link.id;
    ELSE
      RETURN NEXT existing_link;
      RETURN;
    END IF;
  END IF;

  UPDATE public.payment_links
  SET status = 'EXPIRED'
  WHERE booking_id = p_booking_id
    AND status = 'PENDING'
    AND expires_at <= now();

  INSERT INTO public.payment_links(
    booking_id, payos_order_code, amount, expires_at
  )
  VALUES (
    p_booking_id,
    nextval('public.payos_order_code_seq'),
    b.deposit,
    p_expires_at
  )
  RETURNING * INTO existing_link;

  RETURN NEXT existing_link;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_payos_payment_link(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_payos_payment_link(uuid, timestamptz)
  TO service_role;

CREATE FUNCTION public.process_payos_payment(
  p_event_id text,
  p_order_code bigint,
  p_amount integer,
  p_payload jsonb,
  p_success boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  link public.payment_links;
  b public.bookings;
  inserted_count integer;
  result_code text;
  detail text;
BEGIN
  IF p_event_id IS NULL OR length(p_event_id) NOT BETWEEN 1 AND 200
     OR p_order_code IS NULL OR p_amount IS NULL OR p_amount < 0
     OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid payOS event.';
  END IF;

  INSERT INTO public.payment_events(id, order_code, amount, payload, result)
  VALUES (
    p_event_id, p_order_code, p_amount, p_payload,
    CASE WHEN p_success THEN 'RECEIVED' ELSE 'PAYMENT_FAILED' END
  )
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 0 THEN
    UPDATE public.payment_events
    SET duplicate_count = duplicate_count + 1
    WHERE id = p_event_id;
    RETURN jsonb_build_object('result', 'DUPLICATE');
  END IF;

  SELECT * INTO link
  FROM public.payment_links
  WHERE payos_order_code = p_order_code;
  IF link.id IS NULL THEN
    UPDATE public.payment_events
    SET result = 'UNKNOWN_ORDER'
    WHERE id = p_event_id;
    RETURN jsonb_build_object('result', 'UNKNOWN_ORDER');
  END IF;

  SELECT * INTO b
  FROM public.bookings
  WHERE id = link.booking_id
  FOR UPDATE;

  SELECT * INTO link
  FROM public.payment_links
  WHERE id = link.id
  FOR UPDATE;

  UPDATE public.payment_events
  SET booking_id = b.id
  WHERE id = p_event_id;

  IF NOT p_success THEN
    RETURN jsonb_build_object('result', 'PAYMENT_FAILED');
  END IF;

  IF b.status <> 'AWAITING_DEPOSIT' THEN
    UPDATE public.payment_events
    SET result = 'BOOKING_NOT_AWAITING_DEPOSIT'
    WHERE id = p_event_id;
    RETURN jsonb_build_object('result', 'BOOKING_NOT_AWAITING_DEPOSIT');
  END IF;

  IF link.status <> 'PENDING'
     OR link.expires_at <= now()
     OR b.hold_until IS NULL
     OR b.hold_until <= now() THEN
    result_code := 'EXPIRED_REVIEW';
    detail := 'payOS payment received after the booking or link expired or was cancelled.';
  ELSIF link.amount <> b.deposit OR p_amount < b.deposit THEN
    result_code := 'UNDERPAID_REVIEW';
    detail := 'payOS payment amount is below the required deposit.';
  ELSE
    UPDATE public.bookings
    SET status = 'CONFIRMED',
        payment_status = 'PAID',
        hold_until = NULL,
        updated_at = now()
    WHERE id = b.id;
    UPDATE public.payment_links
    SET status = 'PAID'
    WHERE id = link.id;
    PERFORM private.event(b.id, 'VERIFY_PAYMENT', 'payOS deposit confirmed.');
    INSERT INTO public.audit_log(actor_id, action, target_id, detail)
    VALUES (NULL, 'PAYOS_DEPOSIT_CONFIRMED', b.id, 'payOS deposit confirmed.');
    UPDATE public.payment_events
    SET result = 'CONFIRMED'
    WHERE id = p_event_id;
    RETURN jsonb_build_object('result', 'CONFIRMED');
  END IF;

  UPDATE public.bookings
  SET status = 'PAYMENT_REVIEW',
      payment_status = 'REPORTED',
      transfer_reference = 'payOS:' || p_event_id,
      hold_until = NULL,
      updated_at = now()
  WHERE id = b.id;
  IF result_code = 'EXPIRED_REVIEW' AND link.status = 'PENDING' THEN
    UPDATE public.payment_links
    SET status = 'EXPIRED'
    WHERE id = link.id;
  END IF;
  PERFORM private.event(b.id, 'REPORT_PAYMENT', detail);
  INSERT INTO public.audit_log(actor_id, action, target_id, detail)
  VALUES (NULL, 'PAYOS_DEPOSIT_REVIEW', b.id, detail);
  UPDATE public.payment_events
  SET result = result_code
  WHERE id = p_event_id;
  RETURN jsonb_build_object('result', result_code);
END;
$$;
REVOKE ALL ON FUNCTION public.process_payos_payment(text, bigint, integer, jsonb, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_payos_payment(text, bigint, integer, jsonb, boolean)
  TO service_role;
