export const CATEGORIES = [
  { value: "bodies", label: "Bodies" },
  { value: "croppeds", label: "Croppeds" },
  { value: "vestidos", label: "Vestidos" },
  { value: "saias", label: "Saias" },
  { value: "calcas", label: "Calças" },
];

export const categoryLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label || v;

export const imgUrl = (id, width) => `${process.env.REACT_APP_BACKEND_URL}/api/public/images/${id}${width ? `?w=${width}` : ""}`;

export const effectivePrice = (variant) => variant?.promotional_price ?? variant?.price ?? 0;
export const pixPrice = (price) => Number(price || 0) * 0.95;

const PUBLIC_CATALOG_CACHE_KEY = "madu_public_catalog_v1";
const PUBLIC_CATALOG_MAX_STALE_MS = 10 * 60 * 1000;

export const readPublicCatalogCache = () => {
  if (typeof window === "undefined") return null;
  try {
    const cached = JSON.parse(window.localStorage.getItem(PUBLIC_CATALOG_CACHE_KEY) || "null");
    if (!Array.isArray(cached?.data) || !Number.isFinite(cached?.savedAt)) return null;
    if (Date.now() - cached.savedAt > PUBLIC_CATALOG_MAX_STALE_MS) return null;
    return cached.data;
  } catch {
    return null;
  }
};

export const writePublicCatalogCache = (data) => {
  if (typeof window === "undefined" || !Array.isArray(data)) return;
  try {
    window.localStorage.setItem(PUBLIC_CATALOG_CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // Private browsing or storage limits must not affect the storefront.
  }
};

export const ADMIN_PATH = "/painel-mb";


export const WHATSAPP_NUMBER = "5516991956085";
