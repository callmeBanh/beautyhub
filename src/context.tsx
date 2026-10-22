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
};
const Context = createContext<State>(null!);
export const useApp = () => useContext(Context);
export function AppProvider({ children }: { children: ReactNode }) {
  const generation = useRef(0);
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
      const [ps, cfg] = await Promise.all([
        listProviders(),
        rpc<Settings[]>("public_settings"),
      ]);
      if (version !== generation.current) return;
      if (!cfg[0]) throw new Error("Không tải được cấu hình công khai.");
      let nextSettings = cfg[0];
      let nextProfile: Profile | null = null;
      const {
        data: { user: current },
      } = await db.auth.getUser();
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
    } catch (e) {
      if (version === generation.current) setError(errorText(e));
    } finally {
      if (version === generation.current) {
        setLoading(false);
        setAuthLoading(false);
      }
    }
  }
  useEffect(() => {
    void refresh();
    if (!db) return;
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, u) => {
      generation.current++;
      setAuthLoading(true);
      setProfile(null);
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
