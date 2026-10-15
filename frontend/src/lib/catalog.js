export const CATEGORIES = [
  { value: "bodies", label: "Bodies" },
  { value: "croppeds", label: "Croppeds" },
  { value: "vestidos", label: "Vestidos" },
  { value: "saias", label: "Saias" },
  { value: "calcas", label: "Calças" },
];

export const categoryLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label || v;

export const imgUrl = (id) => `${process.env.REACT_APP_BACKEND_URL}/api/public/images/${id}`;

export const effectivePrice = (variant) => variant?.promotional_price ?? variant?.price ?? 0;
export const pixPrice = (price) => Number(price || 0) * 0.95;

export const ADMIN_PATH = "/painel-mb";


export const WHATSAPP_NUMBER = "5516991956085";
