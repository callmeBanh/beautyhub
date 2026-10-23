import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { db, listProviders, rpc } from "./api";
import {
  errorText,
  type Profile,
  type Provider,
  type Settings,
} from "./domain";
type State = {
  user: User | null;
  profile: Profile | null;
  providers: Provider[];
  settings: Settings | null;
  loading: boolean;
  authLoading: boolean;
  error: string;
  refresh: () => Promise<void>;
  toast: (s: string) => void;
  favorites: Set<string>;
  setFavorite: (provider: string, saved: boolean) => Promise<void>;
};
const Context = createContext<State>(null!);
export const useApp = () => useContext(Context);
export function AppProvider({ children }: { children: ReactNode }) {
  const generation = useRef(0);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<User | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [providers, setProviders] = useState<Provider[]>([]),
    [settings, setSettings] = useState<Settings | null>(null),
    [loading, setLoading] = useState(Boolean(db)),
    [authLoading, setAuthLoading] = useState(Boolean(db)),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function refresh() {
    if (!db) return;
    const version = ++generation.current;
    try {
      setError("");
      const [session, cfg] = await Promise.all([
        db.auth.getUser(),
        rpc<Settings[]>("public_settings"),
      ]);
      if (version !== generation.current) return;
      if (!cfg[0]) throw new Error("Không tải được cấu hình công khai.");
      let nextSettings = cfg[0];
      let nextProfile: Profile | null = null;
      let nextFavorites = new Set<string>();
      const current = session.data.user;
      const ps = await listProviders(current?.id);
      if (version !== generation.current) return;
      setUser(current);
      if (current) {
        const { data, error: e } = await db
          .from("profiles")
          .select("*")
          .eq("id", current.id)
          .single();
        if (version !== generation.current) return;
        if (e) throw e;
        nextProfile = data;
        const saved = await db.from("provider_favorites").select("provider_id");
        if (version !== generation.current) return;
        if (saved.error) throw saved.error;
        nextFavorites = new Set(
          (saved.data || []).map((row) => row.provider_id),
        );
        if (nextProfile?.role === "ADMIN") {
          const full = await db.from("settings").select("*").single();
          if (version !== generation.current) return;
          if (full.error) throw full.error;
          nextSettings = full.data;
        }
      }
      setProviders(ps);
      setSettings(nextSettings);
      setProfile(nextProfile);
      setFavorites(nextFavorites);
    } catch (e) {
      if (version === generation.current) setError(errorText(e));
    } finally {
      if (version === generation.current) {
        setLoading(false);
        setAuthLoading(false);
      }
    }
  }
  async function setFavorite(provider: string, saved: boolean) {
    const version = generation.current;
    if (!user) throw new Error("Vui lòng đăng nhập để lưu creator.");
    await rpc("set_favorite", { p_provider: provider, p_saved: saved });
    if (version !== generation.current) return;
    setFavorites((previous) => {
      const next = new Set(previous);
      saved ? next.add(provider) : next.delete(provider);
      return next;
    });
  }
  useEffect(() => {
    void refresh();
    if (!db) return;
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, u) => {
      if (_event === "SIGNED_OUT") {
        try {
          Object.keys(sessionStorage)
            .filter((key) => key.startsWith("bh-draft:"))
            .forEach((key) => sessionStorage.removeItem(key));
        } catch {
          /* Storage may be blocked. */
        }
      }
      generation.current++;
      setAuthLoading(true);
      setProfile(null);
      setFavorites(new Set());
      setSettings(null);
      setProviders([]);
      setUser(u?.user || null);
      if (!u) setProfile(null);
      setTimeout(() => void refresh(), 0);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  return (
    <Context.Provider
      value={{
        user,
        profile,
        providers,
        settings,
        loading,
        authLoading,
        error,
        refresh,
        toast: setMessage,
        favorites,
        setFavorite,
      }}
    >
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </Context.Provider>
  );
}
