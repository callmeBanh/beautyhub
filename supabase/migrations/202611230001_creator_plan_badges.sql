-- Expose active creator plan state through the existing public provider profile query.
ALTER TABLE public.providers
  ADD COLUMN plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'creator')),
  ADD COLUMN expires_at timestamptz;

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

CREATE TRIGGER creator_subscription_sync_provider_plan
AFTER INSERT OR UPDATE OF current_period_end ON public.creator_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_provider_subscription_plan();

-- Keep the existing admin_extend_subscription RPC signature and privileges intact.
GRANT EXECUTE ON FUNCTION public.admin_extend_subscription(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription(bigint, integer, boolean) TO service_role;

NOTIFY pgrst, 'reload schema';
