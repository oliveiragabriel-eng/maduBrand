import { useState } from "react";
import { Phone, Lock, ArrowRight } from "lucide-react";
import { api, formatError } from "@/lib/api";

const IMG = "/hero.jpg";

export default function Login({ onLogin }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { phone, password });
      localStorage.setItem("madu_token", data.token);
      onLogin(data.user);
    } catch (err) {
      setError(formatError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:block brown-blend grain overflow-hidden">
        <img src={IMG} alt="Madu Brand" className="absolute inset-0 w-full h-full object-cover mix-blend-soft-light opacity-70" />
        <div className="relative z-10 h-full flex flex-col justify-end p-14 text-[#F3ECE2]">
          <p className="text-xs uppercase tracking-[0.35em] text-[#D4A373]">Gestão da loja</p>
          <h2 className="font-serif text-6xl mt-4 leading-none">Madu Brand</h2>
          <p className="mt-4 max-w-sm text-[#E8DCCB]/80">Seu acervo, seus custos e seus lucros — tudo em um só lugar.</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-16 bg-[#F3ECE2]">
        <form onSubmit={submit} className="w-full max-w-sm fade-up" data-testid="login-form">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8B7355]">Bem-vinda</p>
          <h1 className="font-serif text-5xl text-[#2B1810] mt-3">Entrar</h1>
          <p className="text-sm text-[#6B5A4E] mt-2 mb-10">Acesse o painel da Madu Brand.</p>
          <Field icon={Phone} label="Telefone">
            <input data-testid="login-phone-input" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="<REMOVED_PHONE>" className="w-full bg-transparent outline-none py-3" required />
          </Field>
          <Field icon={Lock} label="Senha">
            <input data-testid="login-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-transparent outline-none py-3" required />
          </Field>
          {error && <p data-testid="login-error" className="text-sm text-red-700 mb-4">{error}</p>}
          <button data-testid="login-submit-button" disabled={loading} className="group w-full mt-4 flex items-center justify-center gap-2 rounded-full bg-[#2B1810] text-[#F3ECE2] py-4 font-medium transition-colors hover:bg-[#5A3A26] disabled:opacity-60">
            {loading ? "Entrando..." : "Entrar"}
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </form>
      </div>
    </div>
  );
}

const Field = ({ icon: Icon, label, children }) => (
  <label className="block mb-6">
    <span className="text-xs font-semibold uppercase tracking-wider text-[#8B7355]">{label}</span>
    <div className="flex items-center gap-3 border-b border-[#2B1810]/20 focus-within:border-[#2B1810] transition-colors">
      <Icon className="w-4 h-4 text-[#8B7355]" />
      {children}
    </div>
  </label>
);
