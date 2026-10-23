import { createClient } from "@supabase/supabase-js";
import type { Provider } from "./domain";
import { isPublicSupabaseKey } from "./domain";
const enabled = import.meta.env.VITE_BACKEND_ENABLED !== "false";
const url = enabled ? import.meta.env.VITE_SUPABASE_URL : "";
const key = enabled ? import.meta.env.VITE_SUPABASE_ANON_KEY : "";
export const configured = Boolean(
  url && key && /^https:\/\//.test(url) && isPublicSupabaseKey(key),
);
export const db = configured
  ? createClient(url, key, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export function client() {
  if (!db)
    throw new Error(
      "BeautyHub đang chuẩn bị mở cửa. Chức năng này chưa khả dụng.",
    );
  return db;
}
export async function rpc<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    throw new Error("Network offline: hãy kết nối mạng trước khi gửi yêu cầu.");
  const { data, error } = await client().rpc(name, args);
  if (error) throw error;
  return data as T;
}
export async function signProviderAssets(providers: Provider[]) {
  const assets = providers.flatMap((p) => p.portfolio_assets);
  if (assets.length) {
    const { data: urls, error } = await client()
      .storage.from("portfolio")
      .createSignedUrls(
        assets.map((a) => a.path),
        3600,
      );
    if (error) throw error;
    assets.forEach((a) => {
      a.url = urls?.find((u) => u.path === a.path)?.signedUrl || undefined;
    });
  }
  return providers;
}
export type CatalogPage = {
  items: Provider[];
  total: number;
  page: number;
  size: number;
};
export async function catalog(
  filters: Record<string, unknown> = {},
  page = 1,
  size = 12,
  saved = false,
): Promise<CatalogPage> {
  if (!db) return { items: [], total: 0, page, size };
  const result = await rpc<CatalogPage>("provider_catalog", {
    p_filters: filters,
    p_page: page,
    p_size: size,
    p_saved: saved,
  });
  await signProviderAssets(result.items);
  return result;
}
export async function providerDetail(
  slug?: string,
  packageId?: string,
): Promise<Provider | null> {
  if (!db) return null;
  const provider = await rpc<Provider | null>("provider_detail", {
    p_slug: slug || null,
    p_package: packageId || null,
  });
  if (provider) await signProviderAssets([provider]);
  return provider;
}
export async function listProviders(ownerId?: string): Promise<Provider[]> {
  const first = await catalog({}, 1, 4);
  if (!ownerId) return first.items;
  const { data, error } = await client()
    .from("providers")
    .select("*,packages(*),portfolio_assets(*),reviews(*)")
    .eq("owner_id", ownerId)
    .limit(1)
    .limit(20, { referencedTable: "reviews" });
  if (error) throw error;
  const own = await signProviderAssets(
    ((data || []) as Provider[]).map((provider) => ({
      ...first.items.find((publicProvider) => publicProvider.id === provider.id),
      ...provider,
    })),
  );
  return [
    ...first.items.filter((p) => !own.some((o) => o.id === p.id)),
    ...own,
  ];
}
export async function track(event: string) {
  if (!db) return;
  try {
    await db.rpc("track_event", { p_event: event });
  } catch {
    /* Analytics must never block booking. */
  }
}
export async function compressImage(file: File): Promise<Blob> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 12 * 1024 * 1024
  )
    throw new Error("Chọn ảnh JPG, PNG hoặc WebP dưới 12 MB.");
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const ratio = Math.min(1, 1400 / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * ratio);
    canvas.height = Math.round(image.height * ratio);
    canvas
      .getContext("2d")!
      .drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Không xử lý được ảnh."))),
        "image/webp",
        0.76,
      ),
    );
    if (blob.size > 524288)
      throw new Error(
        "Ảnh sau nén vẫn lớn hơn 512 KB. Vui lòng chọn ảnh nhỏ hơn.",
      );
    return blob;
  } finally {
    image.close();
  }
}
