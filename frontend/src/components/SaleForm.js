import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl } from "@/lib/api";

export const PAYMENTS = { pix: "Pix", credito: "Crédito", crediario: "Crediário" };
const inputCls = "w-full rounded-xl border border-[#2B1810]/15 bg-[#FAF6F0] px-4 py-3 outline-none focus:border-[#8B7355] transition-colors";
const EMPTY = { clothing_id: "", quantity: "1", unit_price: "", type: "venda", client: "", payment_method: "pix", installments: "1", due_date: "", paid: true };

export const SaleForm = ({ open, onOpenChange, clothes, onSave, saving }) => {
  const [f, setF] = useState(EMPTY);
  const available = clothes.filter((c) => c.quantity > 0);
  const item = clothes.find((c) => c.id === f.clothing_id);

  useEffect(() => {
    if (open) setF(EMPTY);
  }, [open]);

  const set = (patch) => setF((p) => ({ ...p, ...patch }));
  const pickItem = (id) => set({ clothing_id: id, unit_price: String(clothes.find((c) => c.id === id)?.price ?? ""), quantity: "1" });
  const pickPayment = (m) => set({ payment_method: m, paid: m !== "crediario" && f.type === "venda" });
  const pickType = (t) => set({ type: t, paid: t === "venda" && f.payment_method !== "crediario" });

  const surcharge = f.payment_method === "credito" && Number(f.installments) > 1 ? 5 : 0;
  const total = useMemo(() => (parseFloat(f.unit_price) || 0) * (parseInt(f.quantity, 10) || 0) * (1 + surcharge / 100), [f, surcharge]);
  const installs = Number(f.installments);

  const submit = (e) => {
    e.preventDefault();
    onSave({ ...f, quantity: parseInt(f.quantity, 10), unit_price: parseFloat(f.unit_price) || 0, installments: installs, due_date: f.due_date || null });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-[#F3ECE2] border-[#2B1810]/10 overflow-y-auto w-full sm:max-w-md" data-testid="sale-form-sheet">
        <SheetHeader className="text-left">
          <SheetTitle className="font-serif text-3xl text-[#2B1810]">Lançar venda</SheetTitle>
          <SheetDescription className="text-[#6B5A4E]">Registre uma venda ou saída para condicional.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <Segmented value={f.type} onChange={pickType} options={[["venda", "Venda"], ["condicional", "Condicional"]]} testid="sale-type" />
          <L label="Peça">
            <Select value={f.clothing_id} onValueChange={pickItem}>
              <SelectTrigger data-testid="sale-item-select" className="h-[50px] rounded-xl border-[#2B1810]/15 bg-[#FAF6F0]"><SelectValue placeholder="Selecione a peça" /></SelectTrigger>
              <SelectContent className="bg-[#FAF6F0]">
                {available.map((c) => <SelectItem key={c.id} value={c.id} data-testid={`sale-item-option-${c.id}`}>{c.name} · {c.size} · {c.color} ({c.quantity})</SelectItem>)}
              </SelectContent>
            </Select>
          </L>
          <div className="grid grid-cols-2 gap-4">
            <L label="Quantidade"><input data-testid="sale-quantity-input" type="number" min="1" max={item?.quantity || 1} className={inputCls} value={f.quantity} onChange={(e) => set({ quantity: e.target.value })} required /></L>
            <L label="Preço unit. (R$)"><input data-testid="sale-price-input" type="number" step="0.01" min="0" className={inputCls} value={f.unit_price} onChange={(e) => set({ unit_price: e.target.value })} required /></L>
          </div>
          <L label="Cliente"><input data-testid="sale-client-input" className={inputCls} value={f.client} onChange={(e) => set({ client: e.target.value })} placeholder="Nome da cliente" required /></L>
          <L label="Forma de pagamento">
            <Segmented value={f.payment_method} onChange={pickPayment} options={Object.entries(PAYMENTS)} testid="sale-payment" />
          </L>
          {f.payment_method === "credito" && (
            <L label="Parcelas (2x ou 3x: +5%)">
              <Segmented value={f.installments} onChange={(v) => set({ installments: v })} options={[["1", "1x"], ["2", "2x"], ["3", "3x"]]} testid="sale-installments" />
            </L>
          )}
          {f.payment_method === "crediario" && (
            <L label="Pagar no dia"><input data-testid="sale-due-date-input" type="date" className={inputCls} value={f.due_date} onChange={(e) => set({ due_date: e.target.value })} required /></L>
          )}
          <label className="flex items-center gap-3 cursor-pointer">
            <input data-testid="sale-paid-checkbox" type="checkbox" checked={f.paid} onChange={(e) => set({ paid: e.target.checked })} className="w-5 h-5 accent-[#2B1810]" />
            <span className="text-sm text-[#2B1810]">Já foi paga</span>
          </label>
          <div className="rounded-2xl brown-blend text-[#F3ECE2] p-5" data-testid="sale-total-preview">
            <p className="text-xs uppercase tracking-wider text-[#D4A373]">Total{surcharge ? " (com 5% de acréscimo)" : ""}</p>
            <p className="font-serif text-3xl mt-1">{brl(total)}</p>
            {f.payment_method === "credito" && installs > 1 && <p className="text-sm text-[#E8DCCB]/80 mt-1">{installs}x de {brl(total / installs)}</p>}
          </div>
          <button data-testid="sale-save-button" disabled={saving || !f.clothing_id} className="w-full rounded-full bg-[#2B1810] text-[#F3ECE2] py-4 font-medium hover:bg-[#5A3A26] transition-colors disabled:opacity-60">
            {saving ? "Salvando..." : f.type === "venda" ? "Registrar venda" : "Registrar condicional"}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
};

const Segmented = ({ value, onChange, options, testid }) => (
  <div className="flex gap-1 rounded-full bg-[#E6D8C5] p-1">
    {options.map(([v, label]) => (
      <button type="button" key={v} data-testid={`${testid}-${v}`} onClick={() => onChange(v)} className={`flex-1 rounded-full py-2 text-sm transition-colors ${value === v ? "bg-[#2B1810] text-[#F3ECE2]" : "text-[#5A3A26] hover:bg-[#D9C6AE]"}`}>{label}</button>
    ))}
  </div>
);

const L = ({ label, children }) => (
  <div>
    <span className="block mb-2 text-xs font-semibold uppercase tracking-wider text-[#8B7355]">{label}</span>
    {children}
  </div>
);
