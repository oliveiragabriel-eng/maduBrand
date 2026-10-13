import { useCallback, useEffect, useState } from "react";
import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import { LogOut, Shirt, Wallet, Sparkles, ShoppingBag } from "lucide-react";
import { api } from "@/lib/api";
import Inventory from "@/components/Inventory";
import Finance from "@/components/Finance";
import Assistant from "@/components/Assistant";
import Sales from "@/components/Sales";
import { ADMIN_PATH } from "@/lib/catalog";

const tabCls = ({ isActive }) =>
  `flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ${isActive ? "bg-[#2B1810] text-[#F3ECE2]" : "text-[#6B5A4E] hover:bg-[#E6D8C5]"}`;

export default function Dashboard({ onLogout }) {
  const [clothes, setClothes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await api.get("/clothes");
    setClothes(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-[#F3ECE2]/90 backdrop-blur-md border-b border-[#2B1810]/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <span className="font-serif text-2xl text-[#2B1810]" data-testid="brand-logo">Madu <span className="text-[#8B7355] italic">Brand</span></span>
          <nav className="flex items-center gap-1">
            <NavLink to={ADMIN_PATH} end className={tabCls} data-testid="nav-inventory-tab"><Shirt className="w-4 h-4" /><span className="hidden sm:inline">Catálogo de Roupas</span></NavLink>
            <NavLink to={`${ADMIN_PATH}/vendas`} className={tabCls} data-testid="nav-sales-tab"><ShoppingBag className="w-4 h-4" /><span className="hidden sm:inline">Vendas</span></NavLink>
            <NavLink to={`${ADMIN_PATH}/financeiro`} className={tabCls} data-testid="nav-financial-tab"><Wallet className="w-4 h-4" /><span className="hidden sm:inline">Controle Financeiro</span></NavLink>
            <NavLink to={`${ADMIN_PATH}/assistente`} className={tabCls} data-testid="nav-assistant-tab"><Sparkles className="w-4 h-4" /><span className="hidden sm:inline">Assistente</span></NavLink>
          </nav>
          <button onClick={onLogout} data-testid="logout-button" className="flex items-center gap-2 text-sm text-[#6B5A4E] hover:text-[#2B1810] transition-colors">
            <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <Routes>
          <Route path="/" element={<Inventory clothes={clothes} loading={loading} reload={load} />} />
          <Route path="/financeiro" element={<Finance clothes={clothes} />} />
          <Route path="/vendas" element={<Sales clothes={clothes} reloadClothes={load} />} />
          <Route path="/assistente" element={<Assistant />} />
          <Route path="*" element={<Navigate to={ADMIN_PATH} />} />
        </Routes>
      </main>
    </div>
  );
}
