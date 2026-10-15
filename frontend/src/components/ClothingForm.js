import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl } from "@/lib/api";
import { CATEGORIES } from "@/lib/catalog";
import { PhotoUploader } from "@/components/PhotoUploader";

const SIZES = ["PP", "P", "M", "G", "GG", "XG", "Único", "34", "36", "38", "40", "42", "44", "46"];
const EMPTY = { name: "", category: "bodies", description: "", photos: [], size: "M", color: "", cost: "", price: "", promotional_price: "", quantity: "1" };
const inputCls = "w-full rounded-xl border border-[#2B1810]/15 bg-[#FAF6F0] px-4 py-3 outline-none focus:border-[#8B7355] transition-colors";

export const ClothingForm = ({ open, onOpenChange, initial, onSave, saving }) => {
  const [f, setF] = useState(EMPTY);

  useEffect(() => {
    if (open) {
      setF(initial ? { ...EMPTY, ...initial, cost: String(initial.cost), price: String(initial.price), promotional_price: initial.promotional_price == null ? "" : String(initial.promotional_price), quantity: String(initial.quantity) } : EMPTY);
    }
  }, [open, initial]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const profit = (parseFloat(f.price) || 0) - (parseFloat(f.cost) || 0);
  const promotionalPrice = parseFloat(f.promotional_price);
  const promotionalProfit = Number.isFinite(promotionalPrice) ? promotionalPrice - (parseFloat(f.cost) || 0) : null;

  const submit = (e) => {
    e.preventDefault();
    const price = parseFloat(f.price) || 0;
    const promotional_price = f.promotional_price.trim() === "" ? null : promotionalPrice;
    onSave({ name: f.name.trim(), category: f.category, description: f.description.trim(), photos: f.photos, size: f.size, color: f.color.trim(), cost: parseFloat(f.cost) || 0, price, promotional_price, quantity: parseInt(f.quantity, 10) || 0 });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-[#F3ECE2] border-[#2B1810]/10 overflow-y-auto w-full sm:max-w-md" data-testid="clothing-form-sheet">
        <SheetHeader className="text-left">
          <SheetTitle className="font-serif text-3xl text-[#2B1810]">{initial ? "Editar peça" : "Nova peça"}</SheetTitle>
          <SheetDescription className="text-[#6B5A4E]">Preencha os dados da roupa.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <L label="Nome da peça"><input data-testid="clothing-name-input" className={inputCls} value={f.name} onChange={set("name")} required placeholder="Ex.: Vestido midi linho" /></L>
          <L label="Categoria">
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger data-testid="clothing-category-select" className="h-[50px] rounded-xl border-[#2B1810]/15 bg-[#FAF6F0]"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#FAF6F0]">
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value} data-testid={`category-option-${c.value}`}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </L>
          <L label="Fotos"><PhotoUploader photos={f.photos} onChange={(photos) => setF((p) => ({ ...p, photos }))} /></L>
          <L label="Descrição (aparece no site)"><textarea data-testid="clothing-description-input" rows={3} className={inputCls} value={f.description} onChange={set("description")} placeholder="Ex.: Tecido canelado, alcinha regulável" /></L>
          <div className="grid grid-cols-2 gap-4">
            <L label="Tamanho">
              <Select value={f.size} onValueChange={(v) => setF({ ...f, size: v })}>
                <SelectTrigger data-testid="clothing-size-select" className="h-[50px] rounded-xl border-[#2B1810]/15 bg-[#FAF6F0]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#FAF6F0]">
                  {SIZES.map((s) => <SelectItem key={s} value={s} data-testid={`size-option-${s}`}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </L>
            <L label="Cor"><input data-testid="clothing-color-input" className={inputCls} value={f.color} onChange={set("color")} required placeholder="Ex.: Caramelo" /></L>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <L label="Custo pago (R$)"><input data-testid="clothing-cost-input" type="number" step="0.01" min="0" className={inputCls} value={f.cost} onChange={set("cost")} required /></L>
            <L label="Preço de venda (R$)"><input data-testid="clothing-price-input" type="number" step="0.01" min="0" className={inputCls} value={f.price} onChange={set("price")} required /></L>
          </div>
          <L label="Valor promocional (R$)">
            <input data-testid="clothing-promotional-price-input" type="number" step="0.01" min="0" className={inputCls} value={f.promotional_price} onChange={set("promotional_price")} placeholder="Opcional" />
            <span className="block mt-1 text-xs text-[#8B7355]">Se preenchido, aparece como oferta no catálogo.</span>
          </L>
          <L label="Quantidade em estoque"><input data-testid="clothing-stock-input" type="number" min="0" step="1" className={inputCls} value={f.quantity} onChange={set("quantity")} required /></L>
          <div className="rounded-2xl brown-blend text-[#F3ECE2] p-5" data-testid="clothing-form-profit-preview">
            <p className="text-xs uppercase tracking-wider text-[#D4A373]">Lucro por peça</p>
            <p className="font-serif text-3xl mt-1">{brl(profit)}</p>
            {promotionalProfit !== null && <p className="text-sm text-[#E8DCCB]/80 mt-1">Com promoção: {brl(promotionalProfit)}</p>}
          </div>
          <button data-testid="clothing-save-button" disabled={saving} className="w-full rounded-full bg-[#2B1810] text-[#F3ECE2] py-4 font-medium hover:bg-[#5A3A26] transition-colors disabled:opacity-60">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
};

const L = ({ label, children }) => (
  <label className="block">
    <span className="block mb-2 text-xs font-semibold uppercase tracking-wider text-[#8B7355]">{label}</span>
    {children}
  </label>
);
