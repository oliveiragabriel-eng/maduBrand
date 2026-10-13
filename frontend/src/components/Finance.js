import { useEffect, useState } from "react";
import { api, brl } from "@/lib/api";

export default function Finance({ clothes }) {
  const [s, setS] = useState(null);

  useEffect(() => {
    api.get("/finance/summary").then((r) => setS(r.data));
  }, [clothes]);

  if (!s) return <p className="text-[#8B7355]">Carregando...</p>;
  const maxProfit = Math.max(1, ...s.items.map((i) => Math.abs(i.total_profit)));

  return (
    <section className="fade-up">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8B7355]">Finanças</p>
      <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[#2B1810] mt-2">Controle Financeiro</h1>
      <p className="text-sm text-[#6B5A4E] mt-2 mb-10">{s.models} modelos · {s.units} peças em estoque</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl brown-blend grain text-[#F3ECE2] p-8 sm:p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-[#D4A373]">Lucro total projetado</p>
          <p data-testid="financial-total-profit" className={`font-serif text-5xl sm:text-6xl mt-3 ${s.total_profit < 0 ? "text-red-300" : ""}`}>{brl(s.total_profit)}</p>
          <p className="mt-2 text-sm text-[#E8DCCB]/80">Se vender todo o estoque · margem de <span data-testid="financial-margin">{s.margin.toFixed(1)}%</span></p>
          <div className="grid grid-cols-2 gap-6 mt-10 pt-6 border-t border-[#F3ECE2]/15">
            <div><p className="text-xs uppercase tracking-wider text-[#D4A373]">Total investido</p><p data-testid="financial-total-cost" className="text-2xl mt-1">{brl(s.total_cost)}</p></div>
            <div><p className="text-xs uppercase tracking-wider text-[#D4A373]">Faturamento esperado</p><p data-testid="financial-total-revenue" className="text-2xl mt-1">{brl(s.total_revenue)}</p></div>
          </div>
        </div>
        <div className="grid gap-5">
          <Avg testid="financial-average-cost" label="Custo médio por peça" value={s.average_cost} />
          <Avg testid="financial-average-price" label="Venda média por peça" value={s.average_price} />
          <Avg testid="financial-average-profit" label="Lucro médio por peça" value={s.average_profit} accent />
        </div>
      </div>

      <h2 className="font-serif text-2xl sm:text-3xl text-[#2B1810] mt-14 mb-5">Lucro por peça</h2>
      {s.items.length === 0 ? (
        <p className="text-sm text-[#6B5A4E]" data-testid="finance-empty">Cadastre roupas no catálogo para ver o lucro de cada peça.</p>
      ) : (
        <div className="rounded-3xl bg-[#FAF6F0] border border-[#2B1810]/10 overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]" data-testid="finance-items-table">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-[#8B7355] border-b border-[#2B1810]/10">
                {["Peça", "Qtd.", "Custo", "Venda", "Lucro unit.", "Margem", "Lucro total"].map((h) => <th key={h} className="px-5 py-4 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {s.items.map((it) => <Row key={it.id} it={it} max={maxProfit} />)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const Avg = ({ testid, label, value, accent }) => (
  <div className={`rounded-3xl p-6 border border-[#2B1810]/10 ${accent ? "bg-[#E6D8C5]" : "bg-[#FAF6F0]"}`}>
    <p className="text-xs font-semibold uppercase tracking-wider text-[#8B7355]">{label}</p>
    <p data-testid={testid} className="font-serif text-3xl text-[#2B1810] mt-2">{brl(value)}</p>
  </div>
);

const Row = ({ it, max }) => (
  <tr className="border-b border-[#2B1810]/5 last:border-0 hover:bg-[#F3ECE2] transition-colors" data-testid={`finance-row-${it.id}`}>
    <td className="px-5 py-4">
      <p className="font-medium text-[#2B1810]">{it.name}</p>
      <p className="text-xs text-[#8B7355]">{it.size} · {it.color}</p>
    </td>
    <td className="px-5 py-4">{it.quantity}</td>
    <td className="px-5 py-4">{brl(it.cost)}</td>
    <td className="px-5 py-4">{brl(it.price)}</td>
    <td className={`px-5 py-4 font-medium ${it.unit_profit < 0 ? "text-red-700" : "text-[#2B1810]"}`}>{brl(it.unit_profit)}</td>
    <td className="px-5 py-4">{it.margin.toFixed(1)}%</td>
    <td className="px-5 py-4 w-48">
      <p className={`font-semibold ${it.total_profit < 0 ? "text-red-700" : "text-[#2B1810]"}`}>{brl(it.total_profit)}</p>
      <div className="h-1.5 mt-2 rounded-full bg-[#E6D8C5]">
        <div className={`h-full rounded-full ${it.total_profit < 0 ? "bg-red-700" : "bg-[#8B7355]"}`} style={{ width: `${(Math.abs(it.total_profit) / max) * 100}%` }} />
      </div>
    </td>
  </tr>
);
