import { Shirt } from "lucide-react";
import { brl } from "@/lib/api";
import { categoryLabel, imgUrl } from "@/lib/catalog";

export const ProductPhoto = ({ id, alt, className }) =>
  id ? (
    <img src={imgUrl(id)} alt={alt} className={`object-cover ${className}`} />
  ) : (
    <div className={`flex items-center justify-center bg-[#E6D8C5] text-[#8B7355] ${className}`}><Shirt className="w-10 h-10" /></div>
  );

export const ProductCard = ({ p, i, onOpen }) => {
  const colors = [...new Set(p.variants.map((v) => v.color))];
  const sizes = [...new Set(p.variants.map((v) => v.size))];
  return (
    <button data-testid={`store-product-${p.key}`} onClick={onOpen} style={{ animationDelay: `${i * 60}ms` }} className="fade-up group text-left">
      <div className="overflow-hidden rounded-2xl aspect-[3/4] bg-[#E6D8C5]">
        <ProductPhoto id={p.photos[0]} alt={p.name} className="w-full h-full transition-transform duration-700 group-hover:scale-105" />
      </div>
      <p className="text-[10px] uppercase tracking-[0.25em] text-[#8B7355] mt-4">{categoryLabel(p.category)}</p>
      <h3 className="font-serif text-xl text-[#2B1810] mt-1 leading-tight" data-testid="store-product-name">{p.name}</h3>
      <p className="text-sm font-semibold text-[#2B1810] mt-1" data-testid="store-product-price">
        {p.min_price === p.max_price ? brl(p.min_price) : `${brl(p.min_price)} – ${brl(p.max_price)}`}
      </p>
      <p className="text-xs text-[#6B5A4E] mt-1">{colors.length} {colors.length === 1 ? "cor" : "cores"} · Tam. {sizes.join(", ")}</p>
    </button>
  );
};
