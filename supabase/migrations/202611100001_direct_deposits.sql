ALTER TABLE public.bookings
  ADD COLUMN transfer_note text
    CHECK (transfer_note IS NULL OR length(transfer_note) <= 60);

CREATE TABLE public.provider_payout_accounts (
  provider_id uuid PRIMARY KEY REFERENCES public.providers ON DELETE CASCADE,
  bank_bin text NOT NULL CHECK (bank_bin ~ '^[0-9]{6}$'),
  bank_name text NOT NULL CHECK (length(trim(bank_name)) BETWEEN 1 AND 100),
  account_number text NOT NULL CHECK (account_number ~ '^[0-9]{6,19}$'),
  account_name text NOT NULL
    CHECK (account_name ~ '^[A-Z0-9 ]{1,50}$' AND account_name = trim(account_name)),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.provider_payout_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY provider_payout_accounts_read ON public.provider_payout_accounts
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY provider_payout_accounts_insert ON public.provider_payout_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY provider_payout_accounts_update ON public.provider_payout_accounts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );
REVOKE ALL ON public.provider_payout_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.provider_payout_accounts TO authenticated;

CREATE FUNCTION private.set_payout_account_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER provider_payout_accounts_updated_at
  BEFORE UPDATE ON public.provider_payout_accounts
  FOR EACH ROW EXECUTE FUNCTION private.set_payout_account_updated_at();

CREATE OR REPLACE FUNCTION public.save_settings(
  p_bank text,
  p_account text,
  p_holder text,
  p_support text,
  p_policy text,
  p_ready boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Chỉ admin được cấu hình.'; END IF;
  IF p_ready AND (p_support !~ '^https://' OR length(trim(p_policy)) < 100) THEN
    RAISE EXCEPTION 'Cần kênh hỗ trợ HTTPS và chính sách đầy đủ trước khi mở booking.';
  END IF;
  UPDATE public.settings
  SET bank_name = '',
      bank_account = '',
      bank_holder = '',
      support_url = p_support,
      cancellation_policy = p_policy,
      policy_version = policy_version + 1,
      ready = p_ready
  WHERE id;
  INSERT INTO public.audit_log(actor_id, action, detail)
  VALUES (auth.uid(), 'SETTINGS_UPDATED', 'Cập nhật thông tin vận hành.');
END;
$$;

CREATE OR REPLACE FUNCTION public.create_booking(
  p_package uuid,
  p_start timestamptz,
  p_name text,
  p_phone text,
  p_district text,
  p_address text,
  p_notes text,
  p_key uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pk public.packages;
  p public.providers;
  cfg public.settings;
  bid uuid;
  finish timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Vui lòng đăng nhập.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  SELECT id INTO bid FROM public.bookings
  WHERE customer_id = auth.uid() AND request_key = p_key;
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
    SELECT 1 FROM public.free_slots(
      p_package, (p_start AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
    ) f WHERE f.starts_at = p_start
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
      'provider_name', p.name,
      'package', to_jsonb(pk),
      'policy', cfg.cancellation_policy,
      'policy_version', cfg.policy_version,
      'deposit_ready', EXISTS (
        SELECT 1 FROM public.provider_payout_accounts WHERE provider_id = p.id
      )
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

CREATE FUNCTION public.get_deposit_payee(p_booking_id uuid)
RETURNS TABLE(bank_bin text, bank_name text, account_number text, account_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  b public.bookings;
  provider_owner uuid;
  is_customer boolean;
  is_owner boolean;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Không tìm thấy booking.'; END IF;
  SELECT owner_id INTO provider_owner FROM public.providers WHERE id = b.provider_id;
  is_customer := b.customer_id = auth.uid();
  is_owner := provider_owner = auth.uid();
  IF auth.uid() IS NULL OR NOT (is_customer OR is_owner OR public.is_admin()) THEN
    RAISE EXCEPTION 'Bạn không có quyền xem thông tin nhận cọc.';
  END IF;
  IF is_customer AND NOT is_owner AND NOT public.is_admin()
     AND b.status NOT IN ('AWAITING_DEPOSIT', 'PAYMENT_REVIEW') THEN
    RAISE EXCEPTION 'Booking chưa đến bước đặt cọc.';
  END IF;
  RETURN QUERY
    SELECT a.bank_bin, a.bank_name, a.account_number, a.account_name
    FROM public.provider_payout_accounts a
    WHERE a.provider_id = b.provider_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_deposit_payee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_deposit_payee(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.booking_contact(p_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT pr.phone
  FROM public.bookings b
  JOIN public.providers p ON p.id = b.provider_id
  JOIN public.profiles pr ON pr.id = p.owner_id
  WHERE b.id = p_id
    AND public.can_read_booking(p_id)
    AND b.status IN ('AWAITING_DEPOSIT', 'PAYMENT_REVIEW', 'CONFIRMED', 'COMPLETED');
$$;

DROP FUNCTION public.booking_action(uuid, text, text);
CREATE FUNCTION public.booking_action(
  p_id uuid,
  p_action text,
  p_detail text DEFAULT '',
  p_transfer_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  b public.bookings;
  p public.providers;
  admin boolean;
  customer boolean;
  owner boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Vui lòng đăng nhập.'; END IF;
  IF length(p_detail) > 2000 OR length(p_transfer_note) > 60 THEN
    RAISE EXCEPTION 'Nội dung quá dài.';
  END IF;
  IF p_action = 'PAYMENT_NOT_RECEIVED' AND length(p_detail) > 200 THEN
    RAISE EXCEPTION 'Lý do chưa nhận tiền tối đa 200 ký tự.';
  END IF;
  IF p_transfer_note IS NOT NULL AND p_action <> 'REPORT_PAYMENT' THEN
    RAISE EXCEPTION 'Mã giao dịch chỉ dùng khi báo đã chuyển cọc.';
  END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_id FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Không tìm thấy booking.'; END IF;
  SELECT * INTO p FROM public.providers WHERE id = b.provider_id;
  admin := public.is_admin();
  customer := b.customer_id = auth.uid();
  owner := p.owner_id = auth.uid();
  IF NOT (customer OR owner OR admin) THEN
    RAISE EXCEPTION 'Bạn không có quyền thao tác booking này.';
  END IF;
  IF b.status IN ('REQUESTED', 'AWAITING_DEPOSIT')
     AND b.hold_until < now()
     AND p_action NOT IN ('LATE_PAYMENT') THEN
    UPDATE public.bookings SET status = 'EXPIRED', updated_at = now() WHERE id = p_id;
    PERFORM private.event(p_id, 'EXPIRED', 'Hết thời hạn giữ lịch.');
    RETURN;
  END IF;
  IF p_action = 'ACCEPT' AND owner AND b.status = 'REQUESTED' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.provider_payout_accounts WHERE provider_id = b.provider_id
    ) THEN
      RAISE EXCEPTION 'Hãy cập nhật thông tin nhận cọc trước khi nhận lịch.';
    END IF;
    UPDATE public.bookings
    SET status = 'AWAITING_DEPOSIT',
        hold_until = least(now() + interval '6 hours', b.starts_at - interval '6 hours'),
        snapshot = jsonb_set(b.snapshot, '{deposit_ready}', 'true'::jsonb, true)
    WHERE id = p_id;
  ELSIF p_action = 'REJECT' AND owner AND b.status = 'REQUESTED'
        AND length(trim(p_detail)) >= 5 THEN
    UPDATE public.bookings SET status = 'REJECTED', hold_until = NULL WHERE id = p_id;
  ELSIF p_action = 'REPORT_PAYMENT' AND customer
        AND b.status = 'AWAITING_DEPOSIT' THEN
    UPDATE public.bookings
    SET status = 'PAYMENT_REVIEW',
        payment_status = 'REPORTED',
        transfer_note = nullif(trim(p_transfer_note), ''),
        transfer_reference = nullif(trim(p_transfer_note), ''),
        hold_until = NULL
    WHERE id = p_id;
  ELSIF p_action = 'VERIFY_PAYMENT' AND
        ((owner AND b.status IN ('AWAITING_DEPOSIT', 'PAYMENT_REVIEW'))
         OR (admin AND b.status = 'PAYMENT_REVIEW')) THEN
    UPDATE public.bookings
    SET status = 'CONFIRMED', payment_status = 'PAID', hold_until = NULL
    WHERE id = p_id;
  ELSIF p_action = 'PAYMENT_NOT_RECEIVED' AND owner
        AND b.status = 'PAYMENT_REVIEW'
        AND length(trim(p_detail)) BETWEEN 1 AND 200 THEN
    UPDATE public.bookings
    SET status = 'AWAITING_DEPOSIT',
        payment_status = 'UNPAID',
        transfer_note = NULL,
        transfer_reference = NULL,
        hold_until = least(now() + interval '6 hours', b.starts_at - interval '1 hour')
    WHERE id = p_id;
  ELSIF p_action = 'PAYMENT_NOT_FOUND' AND admin
        AND b.status = 'PAYMENT_REVIEW' AND length(trim(p_detail)) >= 5 THEN
    UPDATE public.bookings
    SET status = 'AWAITING_DEPOSIT',
        payment_status = 'UNPAID',
        transfer_note = NULL,
        transfer_reference = NULL,
        hold_until = least(now() + interval '6 hours', b.starts_at - interval '1 hour')
    WHERE id = p_id;
  ELSIF p_action = 'ADMIN_CANCEL' AND admin AND b.status = 'PAYMENT_REVIEW'
        AND length(trim(p_detail)) BETWEEN 5 AND 2000 THEN
    UPDATE public.bookings SET status = 'CANCELLED', hold_until = NULL WHERE id = p_id;
  ELSIF p_action = 'CANCEL' AND customer
        AND b.status IN ('REQUESTED', 'AWAITING_DEPOSIT')
        AND b.payment_status = 'UNPAID' THEN
    UPDATE public.bookings SET status = 'CANCELLED', hold_until = NULL WHERE id = p_id;
  ELSIF p_action = 'COMPLETE' AND owner AND b.status = 'CONFIRMED'
        AND b.ends_at <= now() THEN
    UPDATE public.bookings SET status = 'COMPLETED' WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'Thao tác không hợp lệ hoặc cần bổ sung lý do. Hãy tải lại booking.';
  END IF;
  UPDATE public.bookings SET updated_at = now() WHERE id = p_id;
  PERFORM private.event(
    p_id,
    p_action,
    CASE
      WHEN p_action = 'REPORT_PAYMENT'
        THEN coalesce(nullif(trim(p_transfer_note), ''), 'Khách báo đã chuyển cọc.')
      ELSE p_detail
    END
  );
  IF admin OR p_action IN ('VERIFY_PAYMENT', 'PAYMENT_NOT_RECEIVED') THEN
    INSERT INTO public.audit_log(actor_id, action, target_id, detail)
    VALUES (auth.uid(), p_action, p_id, p_detail);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_action(uuid, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_action(uuid, text, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_support(
  p_id uuid,
  p_resolution text,
  p_cancel boolean DEFAULT false,
  p_refund integer DEFAULT 0
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.support_requests;
  b public.bookings;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Chỉ admin được xử lý hỗ trợ.'; END IF;
  IF length(trim(p_resolution)) < 10 THEN
    RAISE EXCEPTION 'Cần ghi rõ kết quả xử lý.';
  END IF;
  SELECT * INTO r FROM public.support_requests
  WHERE id = p_id AND status = 'OPEN' FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Yêu cầu đã được xử lý.'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id = r.booking_id FOR UPDATE;
  IF p_refund IS NULL OR p_refund < 0 OR p_refund > b.deposit THEN
    RAISE EXCEPTION 'Số tiền hoàn không hợp lệ.';
  END IF;
  IF p_refund > 0 AND (
    NOT p_cancel OR b.payment_status <> 'PAID'
    OR NOT EXISTS (
      SELECT 1 FROM public.payment_links
      WHERE booking_id = b.id AND status = 'PAID'
    )
  ) THEN
    RAISE EXCEPTION 'BeautyHub không hoàn cọc chuyển trực tiếp; admin chỉ hòa giải.';
  END IF;
  IF p_cancel AND (
    b.status IN ('CANCELLED', 'REJECTED', 'EXPIRED')
    OR b.payment_status IN ('REFUND_PENDING', 'REFUNDED')
  ) THEN
    RAISE EXCEPTION 'Booking đã kết thúc hoặc đã xử lý hoàn tiền. Không được ghi đè khoản hoàn.';
  END IF;
  IF p_cancel AND b.payment_status = 'REPORTED' THEN
    RAISE EXCEPTION 'Cần creator xác nhận giao dịch trước khi hủy booking.';
  END IF;
  IF p_cancel THEN
    UPDATE public.bookings
    SET status = 'CANCELLED',
        hold_until = NULL,
        refund_amount = CASE WHEN payment_status = 'PAID' THEN p_refund ELSE NULL END,
        payment_status = CASE
          WHEN payment_status = 'PAID' AND p_refund > 0 THEN 'REFUND_PENDING'
          ELSE payment_status
        END,
        updated_at = now()
    WHERE id = b.id;
  END IF;
  UPDATE public.support_requests
  SET status = 'RESOLVED', resolution = p_resolution, assigned_to = auth.uid()
  WHERE id = p_id;
  PERFORM private.event(b.id, 'SUPPORT_RESOLVED', p_resolution);
  INSERT INTO public.audit_log(actor_id, action, target_id, detail)
  VALUES (auth.uid(), 'SUPPORT_RESOLVED', p_id, p_resolution);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_refund(p_id uuid, p_reference text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin() OR length(trim(p_reference)) < 6 THEN
    RAISE EXCEPTION 'Cần admin và mã giao dịch hoàn tiền.';
  END IF;
  UPDATE public.bookings
  SET payment_status = 'REFUNDED', updated_at = now()
  WHERE id = p_id
    AND payment_status = 'REFUND_PENDING'
    AND EXISTS (
      SELECT 1 FROM public.payment_links
      WHERE booking_id = p_id AND status = 'PAID'
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'Không có khoản hoàn chờ xử lý payOS.'; END IF;
  PERFORM private.event(p_id, 'REFUNDED', p_reference);
  INSERT INTO public.audit_log(actor_id, action, target_id, detail)
  VALUES (auth.uid(), 'REFUNDED', p_id, p_reference);
END;
$$;
