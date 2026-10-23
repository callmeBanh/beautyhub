import { useEffect, useState } from "react";
import { catalog, providerDetail, type CatalogPage } from "./api";
import { errorText, type Provider } from "./domain";

export function useCatalog(
  filters: Record<string, unknown>,
  page: number,
  saved = false,
  version = "",
) {
  const key = JSON.stringify(filters);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    key: string;
    result: CatalogPage;
    error: string;
  }>({
    key: "",
    result: { items: [], total: 0, page, size: 12 },
    error: "",
  });
  const requestKey = `${key}:${page}:${saved}:${version}:${retry}`;
  useEffect(() => {
    let active = true;
    // Debounce typing; switching pages never starts a request per creator/package.
    const timer = setTimeout(() => {
      void catalog(JSON.parse(key), page, 12, saved)
        .then((result) => {
          if (active) setState({ key: requestKey, result, error: "" });
        })
        .catch((e) => {
          if (active)
            setState({
              key: requestKey,
              result: { items: [], total: 0, page, size: 12 },
              error: errorText(e),
            });
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [requestKey]);
  return {
    ...state.result,
    loading: state.key !== requestKey,
    error: state.key === requestKey ? state.error : "",
    retry: () => setRetry((n) => n + 1),
  };
}

export function useProvider(slug?: string, packageId?: string) {
  const key = `${slug || ""}:${packageId || ""}`;
  const [attempt, retry] = useState(0);
  const [state, setState] = useState<{
    key: string;
    provider: Provider | null;
    error: string;
  }>({ key: "", provider: null, error: "" });
  const requestKey = `${key}:${attempt}`;
  useEffect(() => {
    let active = true;
    void providerDetail(slug, packageId)
      .then((provider) => {
        if (active) setState({ key: requestKey, provider, error: "" });
      })
      .catch((e) => {
        if (active)
          setState({ key: requestKey, provider: null, error: errorText(e) });
      });
    return () => {
      active = false;
    };
  }, [requestKey]);
  return {
    provider: state.key === requestKey ? state.provider : null,
    loading: state.key !== requestKey,
    error: state.key === requestKey ? state.error : "",
    retry: () => retry((n) => n + 1),
  };
}
