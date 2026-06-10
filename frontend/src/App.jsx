import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useSearchParams } from "react-router-dom";
import { FlowProvider } from "./context/FlowContext";
import { AuthProvider, useAuth, apiClient } from "./context/AuthContext";
import Wizard from "./pages/Wizard";
import PaymentStatus from "./pages/PaymentStatus";
import { LogOut, Waves, CheckCircle2, XCircle } from "lucide-react";

const Header = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [qboConnected, setQboConnected] = useState(false);
  const [qboLoading, setQboLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') return;

    const checkQboStatus = async () => {
      setQboLoading(true);
      try {
        const res = await apiClient.get('/qbo/status');
        setQboConnected(res.data.connected);
      } catch (err) {
        console.error('Failed to fetch QBO status:', err);
      } finally {
        setQboLoading(false);
      }
    };

    checkQboStatus();
  }, [isAuthenticated, user]);

  if (!isAuthenticated) return null;

  const handleQboConnect = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/qbo/connect`;
  };

  return (
    <header className="w-full mb-8 mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center mb-1">
            <img
              src="/logo.png"
              alt="Boat Lift Protection"
              className="h-10 object-contain"
            />
          </div>
          
          {user?.role === 'admin' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-slate-200 shadow-sm text-xs font-bold transition-all">
              <span className={`w-2 h-2 rounded-full ${qboConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'}`} />
              <span className="text-slate-600">QuickBooks:</span>
              {qboLoading ? (
                <span className="text-slate-400 font-medium">Checking...</span>
              ) : qboConnected ? (
                <span className="text-emerald-700">Connected</span>
              ) : (
                <button
                  onClick={handleQboConnect}
                  className="text-brand-600 hover:text-brand-800 underline decoration-dotted cursor-pointer"
                >
                  Connect QBO
                </button>
              )}
            </div>
          )}
        </div>

        {isAuthenticated && (
          <div className="flex items-center justify-between md:justify-end gap-4 bg-white/50 md:bg-transparent p-3 md:p-0 rounded-2xl md:rounded-none shadow-sm md:shadow-none border border-white md:border-transparent">
            <div className="text-left md:text-right">
              <p className="text-sm font-semibold text-slate-800">
                {user?.username || "Technician"}
              </p>
              <p className="text-[10px] text-brand-600 uppercase tracking-wider">
                {user?.role || "User"}
              </p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-xl transition-all duration-200 shadow-sm shadow-slate-100"
            >
              <LogOut className="w-4 h-4" />
              <span className="md:hidden">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

const QboNotification = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('qbo_connection');
  const message = searchParams.get('message');
  const [visible, setVisible] = useState(true);

  if (!status || !visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    setSearchParams({});
  };

  return (
    <div className={`p-4 mb-4 rounded-xl border text-sm flex items-center justify-between gap-4 ${
      status === 'success'
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
        : 'bg-red-50 text-red-800 border-red-200'
    }`}>
      <div className="flex items-center gap-3">
        {status === 'success' ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
        )}
        <div>
          <p className="font-bold">
            {status === 'success' ? 'Successfully connected to QuickBooks!' : 'QuickBooks connection failed.'}
          </p>
          {message && <p className="text-xs mt-0.5">{message}</p>}
        </div>
      </div>
      <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-600 font-bold px-2 cursor-pointer">
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

            <div className="relative z-10 flex flex-col min-h-screen p-5 font-sans">
              <Header />

              <main className="w-full mx-auto flex-1 flex flex-col justify-start transition-all duration-300">
                <QboNotification />
                <Routes>
                  <Route path="/" element={<Wizard />} />
                  <Route
                    path="/payment-status/:contractId"
                    element={<PaymentStatus />}
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
