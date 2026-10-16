import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { CATEGORIES, readPublicCatalogCache, writePublicCatalogCache } from "@/lib/catalog";
import { ProductCard } from "@/components/store/ProductCard";
import { ProductDialog } from "@/components/store/ProductDialog";
import { StoreNav, StoreFooter } from "@/components/store/StoreNav";

export default function Storefront() {
  const [products, setProducts] = useState(() => readPublicCatalogCache());
  const [category, setCategory] = useState("todos");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    api.get("/public/catalog")
      .then((r) => {
        if (!active) return;
        const nextProducts = Array.isArray(r.data) ? r.data : [];
        writePublicCatalogCache(nextProducts);
        setProducts(nextProducts);
      })
      .catch(() => {
        if (active) setProducts((current) => current === null ? [] : current);
      });
    return () => { active = false; };
  }, []);

  const list = useMemo(() => (products || []).filter((p) => category === "todos" || p.category === category), [products, category]);
  const title = category === "todos" ? "Todas as peças" : CATEGORIES.find((c) => c.value === category).label;

  const pick = (c) => {
    setCategory(c);
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#F3ECE2]">
      <StoreNav category={category} onPick={pick} />
      <Hero onShop={() => pick("todos")} />
      <main id="catalogo" className="max-w-7xl mx-auto px-5 sm:px-8 pt-12 pb-16 sm:pb-24 scroll-mt-28">
        <div className="flex items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8B7355]">Coleção</p>
            <h2 className="font-serif text-4xl sm:text-5xl text-[#2B1810] mt-2" data-testid="store-section-title">{title}</h2>
          </div>
          <p className="text-sm text-[#6B5A4E]" data-testid="store-product-count">{list.length} {list.length === 1 ? "peça" : "peças"}</p>
        </div>
        {products === null ? (
          <p className="text-[#8B7355]">Carregando...</p>
        ) : list.length === 0 ? (
          <p data-testid="store-empty" className="rounded-3xl border border-dashed border-[#8B7355]/40 p-14 text-center font-serif text-2xl text-[#2B1810]">Em breve novidades por aqui.</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-6" data-testid="store-grid">
            {list.map((p, i) => <ProductCard key={p.key} p={p} i={i} onOpen={() => setSelected(p)} />)}
          </div>
        )}
      </main>
      <StoreFooter />
      <ProductDialog product={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

const Hero = ({ onShop }) => (
  <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-20 sm:pt-28 pb-4 fade-up" data-testid="store-hero">
    <p className="text-xs uppercase tracking-[0.35em] text-[#8B7355]">Moda feminina</p>
    <h1 className="font-serif text-5xl sm:text-7xl lg:text-8xl text-[#2B1810] leading-[0.95] mt-4" data-testid="store-hero-title">
      Catálogo <span className="italic text-[#8B7355]">Madu Brand</span>
    </h1>
    <button data-testid="hero-shop-button" onClick={onShop} className="mt-8 text-sm text-[#2B1810] border-b border-[#2B1810]/40 pb-1 hover:border-[#2B1810] transition-colors">Ver peças</button>
  </section>
);
