-- Expose active creator plan state through the existing public provider profile query.
CREATE OR REPLACE FUNCTION public.admin_extend_subscription(
  p_provider_id uuid,
  p_days integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ admin được gia hạn.';
  END IF;

  IF p_days IS NULL OR p_days NOT BETWEEN 1 AND 365 THEN
    RAISE EXCEPTION 'Số ngày gia hạn phải từ 1 đến 365.';
  END IF;

  UPDATE public.providers
  SET plan = 'creator',
      expires_at = greatest(now(), coalesce(expires_at, now())) + p_days * interval '1 day'
  WHERE id = p_provider_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy creator.';
  END IF;
END;
$$;

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'creator')),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.providers p
SET plan = CASE WHEN s.current_period_end > now() THEN 'creator' ELSE 'free' END,
    expires_at = s.current_period_end
FROM public.creator_subscriptions s
WHERE s.provider_id = p.id;

CREATE OR REPLACE FUNCTION public.sync_provider_subscription_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.providers
  SET plan = CASE WHEN NEW.current_period_end > now() THEN 'creator' ELSE 'free' END,
      expires_at = NEW.current_period_end
  WHERE id = NEW.provider_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_subscription_sync_provider_plan ON public.creator_subscriptions;
CREATE TRIGGER creator_subscription_sync_provider_plan
AFTER INSERT OR UPDATE OF current_period_end ON public.creator_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_provider_subscription_plan();

REVOKE ALL ON FUNCTION public.admin_extend_subscription(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_extend_subscription(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription(bigint, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
