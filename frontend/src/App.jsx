import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useSearchParams,
} from "react-router-dom";
import { FlowProvider } from "./context/FlowContext";
import { AuthProvider, useAuth, apiClient } from "./context/AuthContext";
import Wizard from "./pages/Wizard";
import PaymentStatus from "./pages/PaymentStatus";
import AdminSettings from "./pages/AdminSettings";
import {
  LogOut,
  Waves,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Settings,
} from "lucide-react";

const Header = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") return;

    const checkHealth = async () => {
      setHealthLoading(true);
      try {
        const res = await apiClient.get("/admin/system-status");
        setHealth(res.data);
      } catch (err) {
        console.error("Failed to fetch system status:", err);
      } finally {
        setHealthLoading(false);
      }
    };

    checkHealth();
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (event) => {
      const container = document.getElementById("profile-dropdown-container");
      if (container && !container.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  if (!isAuthenticated) return null;

  return (
    <header className="w-full mb-6 mx-auto select-none">
      <div className="flex flex-row justify-between gap-4 w-full pb-3 border-b border-slate-200/50 md:border-none">
        {/* Left Side: Logo & System Health Notice */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* Logo */}
          <div className="flex items-center">
            <img
              src="/logo.png"
              alt="Boat Lift Protection"
              className="h-9 sm:h-10 object-contain"
            />
          </div>

          {/* System Integration Notice for Admin */}
          {isAuthenticated && user?.role === "admin" && (
            <div className="flex items-center">
              {healthLoading ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-slate-200 shadow-xs text-xs font-medium text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-300 animate-ping" />
                  Checking status...
                </div>
              ) : health?.allOk ? (
                <Link
                  to="/admin/settings"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50/80 border border-emerald-200 shadow-xs text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>All Integrations Active</span>
                </Link>
              ) : (
                <Link
                  to="/admin/settings"
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-300 shadow-xs text-xs font-bold text-amber-900 hover:bg-amber-100 transition-all cursor-pointer animate-in fade-in duration-200"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span className="truncate max-w-[280px]">
                    {health?.unconfiguredCount === 1
                      ? `Notice: ${health.unconfiguredServices[0]} Disconnected`
                      : `Notice: ${health?.unconfiguredCount || 1} Services Require Setup`}
                  </span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Profile Dropdown */}
        {isAuthenticated && (
          <div className="relative" id="profile-dropdown-container">
            {/* Dropdown Trigger */}
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-1.5 py-1 md:px-3 md:py-1.5 rounded-full border border-slate-250 bg-white hover:bg-slate-50 cursor-pointer shadow-xs transition-all select-none"
            >
              {/* User Avatar circle */}
              <div className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-xs uppercase shadow-inner shrink-0">
                {user?.username?.[0] || "U"}
              </div>

              {/* Profile Details */}
              <div className="flex-col text-left pr-1 leading-tight hidden sm:flex">
                <span className="text-xs sm:text-sm font-bold text-slate-800">
                  {user?.username || "Technician"}
                </span>
                <span className="text-[9px] text-brand-600 font-bold uppercase tracking-wider hidden sm:inline">
                  {user?.role || "User"}
                </span>
              </div>

              {/* Chevron icon */}
              <ChevronDown
                className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-lg p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 border-b border-slate-100 sm:hidden">
                  <p className="text-xs font-bold text-slate-800">
                    {user?.username}
                  </p>
                  <p className="text-[9px] text-brand-600 font-bold uppercase tracking-wider">
                    {user?.role}
                  </p>
                </div>

                {user?.role === "admin" && (
                  <Link
                    to="/admin/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-slate-700 hover:text-brand-700 hover:bg-brand-50 rounded-xl transition-all cursor-pointer border-b border-slate-100 mb-1"
                  >
                    <Settings className="w-4 h-4 text-brand-600" />
                    Admin Settings
                  </Link>
                )}

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-slate-700 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-slate-500" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

const QboNotification = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get("qbo_connection");
  const message = searchParams.get("message");
  const [visible, setVisible] = useState(true);

  if (!status || !visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    setSearchParams({});
  };

  return (
    <div
      className={`p-4 mb-4 rounded-xl border text-sm flex items-center justify-between gap-4 ${
        status === "success"
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : "bg-red-50 text-red-800 border-red-200"
      }`}
    >
      <div className="flex items-center gap-3">
        {status === "success" ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
        )}
        <div>
          <p className="font-bold">
            {status === "success"
              ? "Successfully connected to QuickBooks!"
              : "QuickBooks connection failed."}
          </p>
          {message && <p className="text-xs mt-0.5">{message}</p>}
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="text-slate-400 hover:text-slate-600 font-bold px-2 cursor-pointer"
      >
        Dismiss
      </button>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <FlowProvider>
          {/* Background gradient & pattern */}
          <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/50 to-slate-200 relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-brand-200/40 rounded-full mix-blend-multiply filter blur-3xl" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-200/40 rounded-full mix-blend-multiply filter blur-3xl" />

            <div className="relative z-10 flex flex-col min-h-screen p-3 md:p-5 font-sans">
              <Header />

              <main className="w-full mx-auto flex-1 flex flex-col justify-start transition-all duration-300">
                <QboNotification />
                <Routes>
                  <Route path="/" element={<Wizard />} />
                  <Route
                    path="/payment-status/:contractId"
                    element={<PaymentStatus />}
                  />
                  <Route
                    path="/admin/settings"
                    element={<AdminSettings />}
                  />
                </Routes>
              </main>

              <footer className="mt-10 pb-2 text-sm text-slate-400 text-center">
                © {new Date().getFullYear()} Boat Lift Protection · All rights
                reserved
              </footer>
            </div>
          </div>
        </FlowProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
