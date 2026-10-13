import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { api, brl, formatError } from "@/lib/api";
import { ClothingForm } from "@/components/ClothingForm";
import { categoryLabel, imgUrl } from "@/lib/catalog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Inventory({ clothes, loading, reload }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return clothes.filter((c) => [c.name, c.color, c.size].some((v) => v.toLowerCase().includes(s)));
  }, [clothes, q]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (c) => { setEditing(c); setOpen(true); };

  const save = async (payload) => {
    setSaving(true);
    try {
      if (editing) await api.put(`/clothes/${editing.id}`, payload);
      else await api.post("/clothes", payload);
      toast.success(editing ? "Peça atualizada" : "Peça adicionada");
      setOpen(false);
      await reload();
    } catch (e) {
      toast.error(formatError(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/clothes/${toDelete.id}`);
      toast.success("Peça excluída");
      setToDelete(null);
      await reload();
    } catch (e) {
      toast.error(formatError(e.response?.data?.detail));
    }
  };

  return (
    <section className="fade-up">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8B7355]">Acervo</p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[#2B1810] mt-2">Catálogo de Roupas</h1>
          <p className="text-sm text-[#6B5A4E] mt-2" data-testid="inventory-count">{clothes.length} {clothes.length === 1 ? "modelo" : "modelos"} cadastrados</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 rounded-full border border-[#2B1810]/15 bg-[#FAF6F0] px-4">
            <Search className="w-4 h-4 text-[#8B7355]" />
            <input data-testid="inventory-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, cor, tamanho" className="bg-transparent outline-none py-3 text-sm w-full sm:w-60" />
          </div>
          <button data-testid="add-clothing-button" onClick={openNew} className="flex items-center justify-center gap-2 rounded-full bg-[#2B1810] text-[#F3ECE2] px-6 py-3 text-sm font-medium hover:bg-[#5A3A26] transition-colors">
            <Plus className="w-4 h-4" /> Adicionar roupa
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-[#8B7355]">Carregando...</p>
      ) : list.length === 0 ? (
        <EmptyState hasItems={clothes.length > 0} onAdd={openNew} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="clothes-grid">
          {list.map((c, i) => (
            <ClothingCard key={c.id} c={c} i={i} onEdit={() => openEdit(c)} onDelete={() => setToDelete(c)} />
          ))}
        </div>
      )}

      <ClothingForm open={open} onOpenChange={setOpen} initial={editing} onSave={save} saving={saving} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="bg-[#F3ECE2]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-2xl text-[#2B1810]">Excluir peça?</AlertDialogTitle>
            <AlertDialogDescription>"{toDelete?.name}" será removida permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel-button" className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="delete-confirm-button" onClick={remove} className="rounded-full bg-[#2B1810] hover:bg-[#5A3A26]">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

const ClothingCard = ({ c, i, onEdit, onDelete }) => {
  const profit = c.price - c.cost;
  return (
    <article data-testid={`clothing-card-${c.id}`} style={{ animationDelay: `${i * 50}ms` }} className="fade-up group rounded-3xl bg-[#FAF6F0] border border-[#2B1810]/10 p-6 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(43,24,16,0.35)] transition-[transform,box-shadow] duration-300">
      <div className="flex items-start justify-between gap-3">
        {c.photos?.[0] && <img src={imgUrl(c.photos[0])} alt={c.name} data-testid="clothing-card-photo" className="w-16 h-20 rounded-xl object-cover flex-shrink-0" />}
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-2xl text-[#2B1810] truncate" data-testid="clothing-card-name">{c.name}</h3>
          <div className="flex flex-wrap gap-2 mt-2">
            <Tag>{categoryLabel(c.category)}</Tag><Tag>Tam. {c.size}</Tag><Tag>{c.color}</Tag>
          </div>
          <StockStatus c={c} />
        </div>
        <div className="flex gap-1 opacity-80 group-hover:opacity-100">
          <IconBtn testid="clothing-edit-button" onClick={onEdit}><Pencil className="w-4 h-4" /></IconBtn>
          <IconBtn testid="clothing-delete-button" onClick={onDelete}><Trash2 className="w-4 h-4" /></IconBtn>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-6 pt-5 border-t border-[#2B1810]/10 text-sm">
        <Stat label="Custo" value={brl(c.cost)} />
        <Stat label="Venda" value={brl(c.price)} />
        <Stat label="Lucro" value={brl(profit)} strong negative={profit < 0} />
      </div>
    </article>
  );
};

const StockStatus = ({ c }) => (
  <div className="flex flex-wrap gap-2 mt-3">
    {c.quantity > 0 ? (
      <Badge testid="stock-status-available" cls="bg-green-100 text-green-800" icon={CheckCircle2}>{c.quantity} disponível{c.quantity > 1 ? "is" : ""}</Badge>
    ) : (
      <Badge testid="stock-status-out" cls="bg-red-100 text-red-800" icon={XCircle}>Sem estoque</Badge>
    )}
    {c.on_conditional > 0 && (
      <Badge testid="stock-status-conditional" cls="bg-amber-100 text-amber-800" icon={Clock}>{c.on_conditional} em condicional</Badge>
    )}
  </div>
);

const Badge = ({ testid, cls, icon: Icon, children }) => (
  <span data-testid={testid} className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 ${cls}`}>
    <Icon className="w-3.5 h-3.5" />{children}
  </span>
);

const Tag = ({ children }) => <span className="text-xs rounded-full bg-[#E6D8C5] text-[#5A3A26] px-3 py-1">{children}</span>;
const IconBtn = ({ testid, onClick, children }) => (
  <button data-testid={testid} onClick={onClick} className="p-2 rounded-full text-[#8B7355] hover:bg-[#2B1810] hover:text-[#F3ECE2] transition-colors">{children}</button>
);
const Stat = ({ label, value, strong, negative }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-[#8B7355]">{label}</p>
    <p className={`mt-1 ${strong ? "font-semibold" : ""} ${negative ? "text-red-700" : "text-[#2B1810]"}`}>{value}</p>
  </div>
);

const EmptyState = ({ hasItems, onAdd }) => (
  <div className="rounded-3xl border border-dashed border-[#8B7355]/40 p-14 text-center" data-testid="inventory-empty">
    <p className="font-serif text-3xl text-[#2B1810]">{hasItems ? "Nada encontrado" : "Seu catálogo está vazio"}</p>
    <p className="text-sm text-[#6B5A4E] mt-2">{hasItems ? "Tente outra busca." : "Comece adicionando a primeira peça da Madu Brand."}</p>
    {!hasItems && <button onClick={onAdd} data-testid="empty-add-button" className="mt-6 rounded-full bg-[#2B1810] text-[#F3ECE2] px-6 py-3 text-sm hover:bg-[#5A3A26] transition-colors">Adicionar roupa</button>}
  </div>
);
