export function isPublicKey(key) {
  if (typeof key !== "string") return false;
  if (key.startsWith("sb_publishable_")) return key.length > 15;
  try {
    return (
      JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
        .role === "anon"
    );
  } catch {
    return false;
  }
}
