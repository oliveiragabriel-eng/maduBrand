import { lazy, Suspense, useEffect, useState } from "react";
import "@/App.css";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { api } from "@/lib/api";
import { ADMIN_PATH } from "@/lib/catalog";
import Storefront from "@/pages/Storefront";

const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));

const AdminLoading = () => (
  <div className="min-h-screen flex items-center justify-center font-serif text-2xl text-[#8B7355]">
    Madu Brand
  </div>
);

const Admin = ({ login }) => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

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
    navigate("/");
  };

  if (user === null) {
    return <div className="min-h-screen flex items-center justify-center font-serif text-2xl text-[#8B7355]">Madu Brand</div>;
  }
  if (login) return user ? <Navigate to={ADMIN_PATH} /> : <Suspense fallback={<AdminLoading />}><Login onLogin={setUser} /></Suspense>;
  return user ? <Suspense fallback={<AdminLoading />}><Dashboard user={user} onLogout={logout} /></Suspense> : <Navigate to={`${ADMIN_PATH}/login`} />;
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
