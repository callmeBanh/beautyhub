-- Creator Subscription (99.000đ / 30 days via payOS)

-- 1. Settings columns
ALTER TABLE public.settings
  ADD COLUMN subscription_price_vnd integer NOT NULL DEFAULT 99000 CHECK (subscription_price_vnd > 0),
  ADD COLUMN subscription_period_days integer NOT NULL DEFAULT 30 CHECK (subscription_period_days > 0),
  ADD COLUMN subscription_enforced boolean NOT NULL DEFAULT false,
  ADD COLUMN free_portfolio_limit integer NOT NULL DEFAULT 10 CHECK (free_portfolio_limit >= 0);

-- 2. Tables
CREATE TABLE public.creator_subscriptions (
  provider_id uuid PRIMARY KEY REFERENCES public.providers ON DELETE CASCADE,
  current_period_end timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.creator_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY creator_subscriptions_owner_or_admin_read ON public.creator_subscriptions
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );
REVOKE ALL ON public.creator_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.creator_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.creator_subscriptions TO service_role;

CREATE TABLE public.subscription_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers,
  payos_order_code bigint NOT NULL UNIQUE,
  payos_payment_link_id text UNIQUE,
  checkout_url text,
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED')),
  expires_at timestamptz NOT NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subscription_orders_one_pending_per_provider
  ON public.subscription_orders(provider_id) WHERE status = 'PENDING';
CREATE INDEX subscription_orders_provider_created
  ON public.subscription_orders(provider_id, created_at DESC);
ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscription_orders_owner_or_admin_read ON public.subscription_orders
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );
REVOKE ALL ON public.subscription_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.subscription_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.subscription_orders TO service_role;

-- 3. Functions
CREATE FUNCTION public.reserve_subscription_order(
  p_provider_id uuid,
  p_expires_at timestamptz
) RETURNS SETOF public.subscription_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p public.providers;
  existing_order public.subscription_orders;
  price_vnd integer;
BEGIN
  IF p_expires_at IS NULL OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'Subscription order expiration must be in the future.';
  END IF;

  SELECT * INTO p
  FROM public.providers
  WHERE id = p_provider_id
  FOR UPDATE;

  IF p.id IS NULL OR p.status = 'SUSPENDED' THEN
    RAISE EXCEPTION 'Provider is not eligible for a subscription.';
  END IF;

  SELECT * INTO existing_order
  FROM public.subscription_orders
  WHERE provider_id = p_provider_id
    AND status = 'PENDING'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF existing_order.id IS NOT NULL THEN
    IF existing_order.checkout_url IS NULL
       AND existing_order.created_at < now() - interval '2 minutes' THEN
      UPDATE public.subscription_orders
      SET status = 'CANCELLED'
      WHERE id = existing_order.id;
    ELSE
      RETURN NEXT existing_order;
      RETURN;
    END IF;
  END IF;

  UPDATE public.subscription_orders
  SET status = 'EXPIRED'
  WHERE provider_id = p_provider_id
    AND status = 'PENDING'
    AND expires_at <= now();

  SELECT subscription_price_vnd INTO price_vnd
  FROM public.settings
  WHERE id;

  INSERT INTO public.subscription_orders(
    provider_id, payos_order_code, amount, expires_at
  )
  VALUES (
    p_provider_id,
    nextval('public.payos_order_code_seq'),
    price_vnd,
    p_expires_at
  )
  RETURNING * INTO existing_order;

  RETURN NEXT existing_order;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_subscription_order(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_subscription_order(uuid, timestamptz)
  TO service_role;

CREATE FUNCTION public.activate_subscription(
  p_order_code bigint,
  p_amount integer,
  p_success boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  ord public.subscription_orders;
  existing_end timestamptz;
  period_days integer;
  new_end timestamptz;
BEGIN
  SELECT * INTO ord
  FROM public.subscription_orders
  WHERE payos_order_code = p_order_code
  FOR UPDATE;

  IF ord.id IS NULL THEN
    RETURN jsonb_build_object('result', 'UNKNOWN_ORDER');
  END IF;

  IF NOT coalesce(p_success, false) THEN
    RETURN jsonb_build_object('result', 'PAYMENT_FAILED');
  END IF;

  IF ord.status = 'PAID' THEN
    RETURN jsonb_build_object('result', 'ALREADY_PAID');
  END IF;

  IF p_amount IS NULL OR p_amount < ord.amount THEN
    INSERT INTO public.audit_log(actor_id, action, target_id, detail)
    VALUES (
      NULL,
      'SUBSCRIPTION_UNDERPAID',
      ord.provider_id,
      'payOS subscription payment amount is below the required price.'
    );
    RETURN jsonb_build_object('result', 'UNDERPAID');
  END IF;

  SELECT current_period_end INTO existing_end
  FROM public.creator_subscriptions
  WHERE provider_id = ord.provider_id
  FOR UPDATE;

  SELECT subscription_period_days INTO period_days
  FROM public.settings
  WHERE id;

  new_end := greatest(coalesce(existing_end, now()), now())
    + make_interval(days => period_days);

  INSERT INTO public.creator_subscriptions(provider_id, current_period_end, updated_at)
  VALUES (ord.provider_id, new_end, now())
  ON CONFLICT (provider_id) DO UPDATE
  SET current_period_end = EXCLUDED.current_period_end,
      updated_at = now();

  UPDATE public.subscription_orders
  SET status = 'PAID',
      paid_at = now()
  WHERE id = ord.id;

  INSERT INTO public.audit_log(actor_id, action, target_id, detail)
  VALUES (NULL, 'SUBSCRIPTION_ACTIVATED', ord.provider_id, 'payOS subscription credited.');

  RETURN jsonb_build_object(
    'result', 'ACTIVATED',
    'current_period_end', new_end
  );
END;
$$;
REVOKE ALL ON FUNCTION public.activate_subscription(bigint, integer, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription(bigint, integer, boolean)
  TO service_role;

CREATE FUNCTION public.admin_extend_subscription(
  p_provider_id uuid,
  p_days integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  existing_end timestamptz;
  new_end timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ admin được gia hạn.';
  END IF;

  IF p_days IS NULL OR p_days NOT BETWEEN 1 AND 365 THEN
    RAISE EXCEPTION 'Số ngày gia hạn phải từ 1 đến 365.';
  END IF;

  PERFORM 1 FROM public.providers WHERE id = p_provider_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy creator.';
  END IF;

  SELECT current_period_end INTO existing_end
  FROM public.creator_subscriptions
  WHERE provider_id = p_provider_id
  FOR UPDATE;

  new_end := greatest(coalesce(existing_end, now()), now())
    + make_interval(days => p_days);

  INSERT INTO public.creator_subscriptions(provider_id, current_period_end, updated_at)
  VALUES (p_provider_id, new_end, now())
  ON CONFLICT (provider_id) DO UPDATE
  SET current_period_end = EXCLUDED.current_period_end,
      updated_at = now();

  INSERT INTO public.audit_log(actor_id, action, target_id, detail)
  VALUES (auth.uid(), 'SUBSCRIPTION_EXTENDED_MANUAL', p_provider_id, p_days || ' ngày');
END;
$$;
REVOKE ALL ON FUNCTION public.admin_extend_subscription(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_extend_subscription(uuid, integer)
  TO authenticated;

CREATE FUNCTION public.provider_accepts_bookings(
  p_provider_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    NOT coalesce((SELECT subscription_enforced FROM public.settings WHERE id), false)
    OR EXISTS (
      SELECT 1
      FROM public.creator_subscriptions
      WHERE provider_id = p_provider_id
        AND current_period_end > now()
    );
$$;
REVOKE ALL ON FUNCTION public.provider_accepts_bookings(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provider_accepts_bookings(uuid)
  TO anon, authenticated, service_role;

-- 4. Enforcement hooks
CREATE OR REPLACE FUNCTION public.create_booking(
  p_package uuid, p_start timestamptz, p_name text, p_phone text,
  p_district text, p_address text, p_notes text, p_key uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pk public.packages; p public.providers; cfg public.settings; bid uuid; finish timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Vui lòng đăng nhập.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  SELECT id INTO bid FROM public.bookings WHERE customer_id = auth.uid() AND request_key = p_key;
  IF bid IS NOT NULL THEN RETURN bid; END IF;
  SELECT * INTO cfg FROM public.settings WHERE id;
  IF NOT cfg.ready THEN
    RAISE EXCEPTION 'BeautyHub chưa mở nhận booking. Vui lòng quay lại sau.';
  END IF;
  SELECT * INTO pk FROM public.packages WHERE id = p_package AND active FOR SHARE;
  IF pk.id IS NULL THEN RAISE EXCEPTION 'Gói dịch vụ không còn khả dụng.'; END IF;
  SELECT * INTO p FROM public.providers WHERE id = pk.provider_id FOR UPDATE;
  IF p.status <> 'APPROVED' OR p.owner_id = auth.uid() THEN
    RAISE EXCEPTION 'Không thể đặt creator này.';
  END IF;
  IF NOT public.provider_accepts_bookings(p.id) THEN
    RAISE EXCEPTION 'Creator chưa nhận booking.';
  END IF;
  PERFORM private.expire_holds(p.id);
  IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 100
     OR p_phone IS NULL OR p_phone !~ '^\+?[0-9]{9,15}$'
     OR p_address IS NULL OR length(trim(p_address)) NOT BETWEEN 10 AND 500
     OR p_notes IS NULL OR length(p_notes) > 2000
     OR p_district IS NULL OR NOT (p_district = ANY(p.districts))
     OR p_key IS NULL THEN
    RAISE EXCEPTION 'Thông tin liên hệ hoặc địa điểm chưa hợp lệ.';
  END IF;
  IF (SELECT count(*) FROM public.bookings
      WHERE customer_id = auth.uid() AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'Bạn đã gửi nhiều yêu cầu. Vui lòng thử lại sau.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.free_slots(p_package, (p_start AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) f
    WHERE f.starts_at = p_start
  ) THEN
    RAISE EXCEPTION 'Khung giờ không còn trống. Vui lòng chọn lại.';
  END IF;
  finish := p_start + make_interval(mins => pk.duration);
  INSERT INTO public.bookings(
    customer_id, provider_id, package_id, request_key, snapshot, customer_name,
    phone, district, address, notes, starts_at, ends_at, price, deposit, hold_until
  )
  VALUES (
    auth.uid(), p.id, pk.id, p_key,
    jsonb_build_object(
      'provider_name', p.name, 'package', to_jsonb(pk),
      'policy', cfg.cancellation_policy, 'policy_version', cfg.policy_version,
      'deposit_ready', EXISTS (SELECT 1 FROM public.provider_payout_accounts WHERE provider_id = p.id)
    ),
    trim(p_name), p_phone, p_district, trim(p_address), p_notes, p_start, finish,
    pk.price, ceil(pk.price * 0.3),
    least(now() + interval '12 hours', p_start - interval '12 hours')
  )
  RETURNING id INTO bid;
  PERFORM private.event(bid, 'REQUESTED', 'Đã gửi yêu cầu. Creator phản hồi trong 12 giờ.');
  RETURN bid;
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION 'Khung giờ vừa có người đặt. Vui lòng chọn lại.';
END;
$$;

CREATE OR REPLACE FUNCTION public.add_portfolio(p_path text, p_caption text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pid uuid;
  cfg public.settings;
  photo_count integer;
BEGIN
  SELECT id INTO pid FROM public.providers WHERE owner_id = auth.uid() FOR UPDATE;
  IF pid IS NULL OR split_part(p_path, '/', 1) <> auth.uid()::text THEN
    RAISE EXCEPTION 'Đường dẫn ảnh không hợp lệ.';
  END IF;
  SELECT * INTO cfg FROM public.settings WHERE id;
  SELECT count(*) INTO photo_count FROM public.portfolio_assets WHERE provider_id = pid;
  IF cfg.subscription_enforced
     AND NOT public.provider_accepts_bookings(pid)
     AND photo_count >= cfg.free_portfolio_limit THEN
    RAISE EXCEPTION 'Gói Free tối đa % ảnh. Kích hoạt Subscription để thêm ảnh.', cfg.free_portfolio_limit;
  END IF;
  IF photo_count >= 12 THEN
    RAISE EXCEPTION 'Tối đa 12 ảnh mỗi creator.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects WHERE bucket_id = 'portfolio' AND name = p_path
  ) THEN
    RAISE EXCEPTION 'Chưa tải ảnh lên.';
  END IF;
  INSERT INTO public.portfolio_assets(provider_id, path, caption)
  VALUES (pid, p_path, p_caption);
END;
$$;
