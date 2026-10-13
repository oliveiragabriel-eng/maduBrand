import { useCallback, useEffect, useState } from "react";
import { Plus, Check, Undo2, Trash2, CheckCircle2, Clock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api, brl, formatError } from "@/lib/api";
import { SaleForm, PAYMENTS } from "@/components/SaleForm";

const currentMonth = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
const FILTERS = [["todas", "Todas"], ["vendida", "Vendidas"], ["condicional", "Condicional"], ["pendente", "Não pagas"], ["devolvida", "Devolvidas"]];
const fmtDate = (d) => (d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("pt-BR") : "");

export default function Sales({ clothes, reloadClothes }) {
  const [sales, setSales] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState("todas");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [s, m] = await Promise.all([api.get("/sales"), api.get("/sales/summary", { params: { month } })]);
    setSales(s.data);
    setSummary(m.data);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn, msg) => {
    try {
      await fn();
      if (msg) toast.success(msg);
      await Promise.all([load(), reloadClothes()]);
      return true;
    } catch (e) {
      toast.error(formatError(e.response?.data?.detail));
      return false;
    }
  };

  const save = async (payload) => {
    setSaving(true);
    if (await run(() => api.post("/sales", payload), payload.type === "venda" ? "Venda registrada" : "Condicional registrada")) setOpen(false);
    setSaving(false);
  };

  const list = sales.filter((s) => filter === "todas" || (filter === "pendente" ? !s.paid && s.status !== "devolvida" : s.status === filter));

  return (
    <section className="fade-up">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8B7355]">Movimento</p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[#2B1810] mt-2">Vendas</h1>
        </div>
        <div className="flex gap-3">
          <input data-testid="sales-month-input" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="rounded-full border border-[#2B1810]/15 bg-[#FAF6F0] px-4 py-3 text-sm outline-none" />
          <button data-testid="add-sale-button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-[#2B1810] text-[#F3ECE2] px-6 py-3 text-sm font-medium hover:bg-[#5A3A26] transition-colors">
            <Plus className="w-4 h-4" /> Lançar venda
          </button>
        </div>
      </div>

      {summary && <MonthSummary s={summary} />}

      <div className="flex flex-wrap gap-2 mt-12 mb-5">
        {FILTERS.map(([v, label]) => (
          <button key={v} data-testid={`sales-filter-${v}`} onClick={() => setFilter(v)} className={`rounded-full px-4 py-2 text-sm transition-colors ${filter === v ? "bg-[#2B1810] text-[#F3ECE2]" : "bg-[#E6D8C5] text-[#5A3A26] hover:bg-[#D9C6AE]"}`}>{label}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-[#6B5A4E] rounded-3xl border border-dashed border-[#8B7355]/40 p-10 text-center" data-testid="sales-empty">Nenhum lançamento encontrado.</p>
      ) : (
        <div className="space-y-3" data-testid="sales-list">
          {list.map((s) => <SaleRow key={s.id} s={s} run={run} />)}
        </div>
      )}

      <SaleForm open={open} onOpenChange={setOpen} clothes={clothes} onSave={save} saving={saving} />
    </section>
  );
}

const MonthSummary = ({ s }) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
    <div className="lg:col-span-2 relative overflow-hidden rounded-3xl brown-blend grain text-[#F3ECE2] p-8">
      <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373]">Lucro real do mês</p>
      <p data-testid="sales-month-profit" className={`font-serif text-5xl mt-3 ${s.profit < 0 ? "text-red-300" : ""}`}>{brl(s.profit)}</p>
      <p className="mt-2 text-sm text-[#E8DCCB]/80"><span data-testid="sales-month-count">{s.sales}</span> vendas · {s.units} peças</p>
      <div className="grid grid-cols-2 gap-6 mt-8 pt-6 border-t border-[#F3ECE2]/15">
        <div><p className="text-xs uppercase tracking-wider text-[#D4A373]">Faturamento</p><p data-testid="sales-month-revenue" className="text-2xl mt-1">{brl(s.revenue)}</p></div>
        <div><p className="text-xs uppercase tracking-wider text-[#D4A373]">Custo das peças</p><p data-testid="sales-month-cost" className="text-2xl mt-1">{brl(s.cost)}</p></div>
      </div>
    </div>
    <div className="grid gap-5">
      <Card testid="sales-month-received" label="Recebido" value={brl(s.received)} />
      <Card testid="sales-month-pending" label="A receber" value={brl(s.pending)} />
      <Card testid="sales-open-conditionals" label="Condicionais em aberto" value={s.open_conditionals} accent />
    </div>
  </div>
);

const Card = ({ testid, label, value, accent }) => (
  <div className={`rounded-3xl p-6 border border-[#2B1810]/10 ${accent ? "bg-amber-50" : "bg-[#FAF6F0]"}`}>
    <p className="text-xs font-semibold uppercase tracking-wider text-[#8B7355]">{label}</p>
    <p data-testid={testid} className="font-serif text-3xl text-[#2B1810] mt-2">{value}</p>
  </div>
);

const STATUS = {
  vendida: ["Vendida", "bg-green-100 text-green-800", CheckCircle2],
  condicional: ["Condicional", "bg-amber-100 text-amber-800", Clock],
  devolvida: ["Devolvida", "bg-[#E6D8C5] text-[#5A3A26]", RotateCcw],
};

const SaleRow = ({ s, run }) => {
  const [label, cls, Icon] = STATUS[s.status];
  const pay = `${PAYMENTS[s.payment_method]}${s.payment_method === "credito" ? ` ${s.installments}x` : ""}${s.surcharge_pct ? " (+5%)" : ""}${s.due_date ? ` · pagar em ${fmtDate(s.due_date)}` : ""}`;
  return (
    <article data-testid={`sale-row-${s.id}`} className="rounded-2xl bg-[#FAF6F0] border border-[#2B1810]/10 p-5 flex flex-col lg:flex-row lg:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span data-testid="sale-status" className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 ${cls}`}><Icon className="w-3.5 h-3.5" />{label}</span>
          {s.status !== "devolvida" && (
            <span data-testid="sale-paid-status" className={`text-xs font-medium rounded-full px-3 py-1 ${s.paid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{s.paid ? "Paga" : "Não paga"}</span>
          )}
          <span className="text-xs text-[#8B7355]">{fmtDate(s.created_at)}</span>
        </div>
        <p className="font-serif text-xl text-[#2B1810] mt-2" data-testid="sale-client">{s.client}</p>
        <p className="text-sm text-[#6B5A4E]">{s.quantity}x {s.clothing_name} · {s.size} · {s.color} — {pay}</p>
      </div>
      <div className="lg:text-right">
        <p className="font-semibold text-[#2B1810]" data-testid="sale-total">{brl(s.total)}</p>
        <p className="text-xs text-[#8B7355]">lucro {brl(s.profit)}</p>
      </div>
      <SaleActions s={s} run={run} />
    </article>
  );
};

const SaleActions = ({ s, run }) => (
  <div className="flex flex-wrap gap-2">
    {s.status !== "devolvida" && (
      <Act testid="sale-toggle-paid-button" onClick={() => run(() => api.patch(`/sales/${s.id}`, { paid: !s.paid }), s.paid ? "Marcada como não paga" : "Marcada como paga")}>
        <Check className="w-4 h-4" />{s.paid ? "Desmarcar paga" : "Marcar paga"}
      </Act>
    )}
    {s.status === "condicional" && (
      <>
        <Act testid="sale-convert-button" onClick={() => run(() => api.patch(`/sales/${s.id}`, { action: "vender" }), "Condicional convertida em venda")}><CheckCircle2 className="w-4 h-4" />Ficou com a peça</Act>
        <Act testid="sale-return-button" onClick={() => run(() => api.patch(`/sales/${s.id}`, { action: "devolver" }), "Peça devolvida ao estoque")}><Undo2 className="w-4 h-4" />Devolveu</Act>
      </>
    )}
    <Act testid="sale-delete-button" onClick={() => window.confirm("Excluir este lançamento?") && run(() => api.delete(`/sales/${s.id}`), "Lançamento excluído")}><Trash2 className="w-4 h-4" /></Act>
  </div>
);

const Act = ({ testid, onClick, children }) => (
  <button data-testid={testid} onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full border border-[#2B1810]/15 px-3 py-2 text-xs text-[#5A3A26] hover:bg-[#2B1810] hover:text-[#F3ECE2] transition-colors">{children}</button>
);
