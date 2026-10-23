import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { useApp } from "./context";
import { errorText, type Provider } from "./domain";
export function FavoriteButton({
  provider,
  className = "",
}: {
  provider: Provider;
  className?: string;
}) {
  const { user, favorites, setFavorite, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const saved = favorites.has(provider.id);
  return (
    <button
      className={`favorite-button ${className}`}
      type="button"
      disabled={busy}
      aria-pressed={saved}
      aria-label={`${saved ? "Bỏ lưu" : "Lưu"} ${provider.name}`}
      onClick={async () => {
        if (!user) {
          navigate(
            `/login?next=${encodeURIComponent(`/creators/${provider.slug}`)}`,
          );
          return;
        }
        setBusy(true);
        try {
          await setFavorite(provider.id, !saved);
          toast(
            saved
              ? "Đã bỏ lưu creator."
              : "Đã lưu creator vào danh sách của bạn.",
          );
        } catch (error) {
          toast(errorText(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Heart
        size={19}
        fill={saved ? "currentColor" : "none"}
        aria-hidden="true"
      />
    </button>
  );
}
