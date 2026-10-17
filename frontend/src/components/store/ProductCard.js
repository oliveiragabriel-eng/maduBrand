import { Shirt } from "lucide-react";
import { brl } from "@/lib/api";
import { categoryLabel, effectivePrice, imgUrl, pixPrice } from "@/lib/catalog";

export const ProductPhoto = ({ id, alt, className, loading = "lazy", sizes = "(max-width: 640px) 50vw, 25vw" }) =>
  id ? (
    <img
      src={imgUrl(id, 800)}
      srcSet={[480, 800, 1200].map((width) => `${imgUrl(id, width)} ${width}w`).join(", ")}
      sizes={sizes}
      alt={alt}
      loading={loading}
      decoding="async"
      className={`object-cover ${className}`}
    />
  ) : (
    <div className={`flex items-center justify-center bg-[#E6D8C5] text-[#8B7355] ${className}`}><Shirt className="w-10 h-10" /></div>
  );

export const ProductCard = ({ p, i, onOpen }) => {
  const colors = [...new Set(p.variants.map((v) => v.color))];
  const sizes = [...new Set(p.variants.map((v) => v.size))];
  const effectivePrices = p.variants.map(effectivePrice);
  const minEffective = p.min_effective_price ?? Math.min(...effectivePrices);
  const maxEffective = p.max_effective_price ?? Math.max(...effectivePrices);
  const hasPromotion = p.variants.some((v) => v.promotional_price != null);
  const regularLabel = p.min_price === p.max_price ? brl(p.min_price) : `${brl(p.min_price)} – ${brl(p.max_price)}`;
  const effectiveLabel = minEffective === maxEffective ? brl(minEffective) : `${brl(minEffective)} – ${brl(maxEffective)}`;
  return (
    <button data-testid={`store-product-${p.key}`} onClick={onOpen} style={{ animationDelay: `${i * 60}ms` }} className="fade-up group text-left">
      <div className="overflow-hidden rounded-2xl aspect-[3/4] bg-[#E6D8C5]">
        <ProductPhoto id={p.photos[0]} alt={p.name} loading="lazy" className="w-full h-full transition-transform duration-700 group-hover:scale-105" />
      </div>
      <p className="text-[10px] uppercase tracking-[0.25em] text-[#8B7355] mt-4">{categoryLabel(p.category)}</p>
      <h3 className="font-serif text-xl text-[#2B1810] mt-1 leading-tight" data-testid="store-product-name">{p.name}</h3>
      <p className="text-sm font-semibold text-[#2B1810] mt-1" data-testid="store-product-price">
        {hasPromotion && <span className="block text-xs font-normal text-[#8B7355] line-through">{regularLabel}</span>}
        <span className={hasPromotion ? "text-[#7A3E24]" : ""}>{effectiveLabel}</span>
      </p>
      <p className="text-[11px] text-[#7A3E24] mt-1">-5% no Pix, dinheiro ou débito ({brl(pixPrice(minEffective))})</p>
      <p className="text-xs text-[#6B5A4E] mt-1">{colors.length} {colors.length === 1 ? "cor" : "cores"} · Tam. {sizes.join(", ")}</p>
    </button>
  );
};
