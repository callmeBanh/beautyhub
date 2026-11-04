ALTER TABLE public.packages
  ADD COLUMN original_photo_count integer,
  ADD COLUMN edited_photo_count integer,
  ADD COLUMN revision_count integer,
  ADD COLUMN included_items jsonb,
  ADD COLUMN customer_benefits jsonb,
  ADD CONSTRAINT packages_original_photo_count_check
    CHECK (original_photo_count IS NULL OR original_photo_count BETWEEN 0 AND 500),
  ADD CONSTRAINT packages_edited_photo_count_check
    CHECK (edited_photo_count IS NULL OR edited_photo_count BETWEEN 0 AND 500),
  ADD CONSTRAINT packages_revision_count_check
    CHECK (revision_count IS NULL OR revision_count BETWEEN 0 AND 20),
  ADD CONSTRAINT packages_included_items_check
    CHECK (
      included_items IS NULL OR CASE
        WHEN jsonb_typeof(included_items) = 'array'
          THEN jsonb_array_length(included_items) <= 20
        ELSE false
      END
    ),
  ADD CONSTRAINT packages_customer_benefits_check
    CHECK (
      customer_benefits IS NULL OR CASE
        WHEN jsonb_typeof(customer_benefits) = 'array'
          THEN jsonb_array_length(customer_benefits) <= 20
        ELSE false
      END
    );

CREATE FUNCTION public.save_package_details(
  p_id uuid,
  p_name text,
  p_service text,
  p_description text,
  p_duration integer,
  p_price integer,
  p_days integer,
  p_includes text,
  p_exclusions text,
  p_active boolean,
  p_original_photo_count integer,
  p_edited_photo_count integer,
  p_revision_count integer,
  p_included_items jsonb,
  p_customer_benefits jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_package_id uuid;
BEGIN
  IF p_original_photo_count IS NOT NULL
     AND (p_original_photo_count < 0 OR p_original_photo_count > 500) THEN
    RAISE EXCEPTION 'Số ảnh gốc phải từ 0 đến 500.';
  END IF;
  IF p_edited_photo_count IS NOT NULL
     AND (p_edited_photo_count < 0 OR p_edited_photo_count > 500) THEN
    RAISE EXCEPTION 'Số ảnh chỉnh sửa phải từ 0 đến 500.';
  END IF;
  IF p_revision_count IS NOT NULL
     AND (p_revision_count < 0 OR p_revision_count > 20) THEN
    RAISE EXCEPTION 'Số lần chỉnh sửa phải từ 0 đến 20.';
  END IF;

  IF p_included_items IS NOT NULL THEN
    IF jsonb_typeof(p_included_items) <> 'array'
       OR jsonb_array_length(p_included_items) > 20 THEN
      RAISE EXCEPTION 'Gói gồm gì phải là danh sách tối đa 20 mục.';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_included_items) AS entry(item)
      WHERE jsonb_typeof(entry.item) <> 'string'
         OR length(btrim(entry.item #>> '{}')) NOT BETWEEN 1 AND 200
    ) THEN
      RAISE EXCEPTION 'Mỗi mục trong danh sách gói gồm gì phải có từ 1 đến 200 ký tự.';
    END IF;
  END IF;

  IF p_customer_benefits IS NOT NULL THEN
    IF jsonb_typeof(p_customer_benefits) <> 'array'
       OR jsonb_array_length(p_customer_benefits) > 20 THEN
      RAISE EXCEPTION 'Quyền lợi của khách phải là danh sách tối đa 20 mục.';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_customer_benefits) AS entry(item)
      WHERE jsonb_typeof(entry.item) <> 'string'
         OR length(btrim(entry.item #>> '{}')) NOT BETWEEN 1 AND 200
    ) THEN
      RAISE EXCEPTION 'Mỗi quyền lợi phải có từ 1 đến 200 ký tự.';
    END IF;
  END IF;

  v_package_id := public.save_package(
    p_id, p_name, p_service, p_description, p_duration, p_price, p_days,
    p_includes, p_exclusions, p_active
  );
  UPDATE public.packages
  SET original_photo_count = p_original_photo_count,
      edited_photo_count = p_edited_photo_count,
      revision_count = p_revision_count,
      included_items = p_included_items,
      customer_benefits = p_customer_benefits
  WHERE id = v_package_id
    AND provider_id = (
      SELECT id FROM public.providers WHERE owner_id = auth.uid()
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không có quyền sửa gói này.';
  END IF;
  RETURN v_package_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_package_details(
  uuid, text, text, text, integer, integer, integer, text, text, boolean,
  integer, integer, integer, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_package_details(
  uuid, text, text, text, integer, integer, integer, text, text, boolean,
  integer, integer, integer, jsonb, jsonb
) TO authenticated;
