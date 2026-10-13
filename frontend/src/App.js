import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { api } from "@/lib/api";
import { ADMIN_PATH } from "@/lib/catalog";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Storefront from "@/pages/Storefront";

const Admin = ({ login }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem("madu_token")) {
      setUser(false);
      return;
    }
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => {
      localStorage.removeItem("madu_token");
      setUser(false);
    });
  }, []);

  const logout = () => {
    localStorage.removeItem("madu_token");
    setUser(false);
  };

  if (user === null) {
    return <div className="min-h-screen flex items-center justify-center font-serif text-2xl text-[#8B7355]">Madu Brand</div>;
  }
  if (login) return user ? <Navigate to={ADMIN_PATH} /> : <Login onLogin={setUser} />;
  return user ? <Dashboard user={user} onLogout={logout} /> : <Navigate to={`${ADMIN_PATH}/login`} />;
};

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/" element={<Storefront />} />
        <Route path={`${ADMIN_PATH}/login`} element={<Admin login />} />
        <Route path={`${ADMIN_PATH}/*`} element={<Admin />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
