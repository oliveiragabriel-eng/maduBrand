import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X, MessageCircle, Instagram, Lock } from "lucide-react";
import { ADMIN_PATH, CATEGORIES, WHATSAPP_NUMBER } from "@/lib/catalog";

const INSTAGRAM_URL = "https://www.instagram.com/madu_braand?mdxt=MWQxZ2pyeTh2c2lncQ==";

const ALL = [{ value: "todos", label: "Todos" }, ...CATEGORIES];

export const StoreNav = ({ category, onPick }) => {
  const [open, setOpen] = useState(false);
  const item = (c, mobile) => (
    <button
      key={c.value}
      data-testid={`store-nav-${c.value}${mobile ? "-mobile" : ""}`}
      onClick={() => { onPick(c.value); setOpen(false); }}
      className={`text-sm tracking-wide transition-colors ${mobile ? "block w-full text-left py-3 border-b border-[#2B1810]/10" : "relative py-2"} ${category === c.value ? "text-[#2B1810] font-semibold" : "text-[#6B5A4E] hover:text-[#2B1810]"}`}
    >
      {c.label}
      {!mobile && category === c.value && <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-[#2B1810]" />}
    </button>
  );

  return (
    <header className="sticky top-0 z-40 bg-[#F3ECE2]/90 backdrop-blur-md border-b border-[#2B1810]/10">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-6">
        <span className="font-serif text-2xl text-[#2B1810]" data-testid="store-logo">Madu <span className="italic text-[#8B7355]">Brand</span></span>
        <nav className="hidden md:flex items-center gap-8">{ALL.map((c) => item(c))}</nav>
        <button className="md:hidden p-2 text-[#2B1810]" onClick={() => setOpen(!open)} data-testid="store-nav-toggle">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {open && <nav className="md:hidden px-5 pb-4 bg-[#F3ECE2]">{ALL.map((c) => item(c, true))}</nav>}
    </header>
  );
};

export const StoreFooter = () => (
  <footer className="bg-[#2B1810] text-[#E8DCCB]">
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 flex flex-col sm:flex-row justify-between gap-6">
      <div>
        <p className="font-serif text-3xl text-[#F3ECE2]">Madu Brand</p>
        <p className="text-sm text-[#E8DCCB]/70 mt-2">Moda feminina com elegância.</p>
      </div>
      <div className="flex flex-wrap gap-3 self-start">
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" data-testid="footer-instagram-link" className="inline-flex items-center gap-2 rounded-full border border-[#D4A373]/50 px-5 py-3 text-sm hover:bg-[#D4A373] hover:text-[#2B1810] transition-colors">
          <Instagram className="w-4 h-4" /> Siga no Instagram
        </a>
        <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" data-testid="footer-whatsapp-link" className="inline-flex items-center gap-2 rounded-full border border-[#D4A373]/50 px-5 py-3 text-sm hover:bg-[#D4A373] hover:text-[#2B1810] transition-colors">
          <MessageCircle className="w-4 h-4" /> Fale conosco no WhatsApp
        </a>
      </div>
    </div>
    <div className="max-w-7xl mx-auto px-5 sm:px-8 pb-6 flex justify-between items-center text-xs text-[#E8DCCB]/40">
      <span>© {new Date().getFullYear()} Madu Brand</span>
      <Link to={`${ADMIN_PATH}/login`} data-testid="footer-admin-link" className="inline-flex items-center gap-1 hover:text-[#E8DCCB] transition-colors">
        <Lock className="w-3 h-3" /> Admin
      </Link>
    </div>
  </footer>
);
