import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { FlowProvider } from "./context/FlowContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Wizard from "./pages/Wizard";
import PaymentStatus from "./pages/PaymentStatus";
import { LogOut, Waves } from "lucide-react";

const Header = () => {
  const { isAuthenticated, user, logout } = useAuth();

  if (!isAuthenticated) return null;

  return (
    <header className="w-full mb-8 mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center mb-1">
            <img
              src="/logo.png"
              alt="Boat Lift Protection"
              className="h-14 object-contain"
            />
          </div>
        </div>

        {isAuthenticated && (
          <div className="flex items-center justify-between md:justify-end gap-4 bg-white/50 md:bg-transparent p-3 md:p-0 rounded-2xl md:rounded-none shadow-sm md:shadow-none border border-white md:border-transparent">
            <div className="text-left md:text-right">
              <p className="text-sm font-bold text-slate-800">
                {user?.username || "Technician"}
              </p>
              <p className="text-xs text-brand-600 font-semibold uppercase tracking-wider">
                {user?.role || "User"}
              </p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-xl transition-all duration-200 shadow-sm"
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

function App() {
  return (
    <Router>
      <AuthProvider>
        <FlowProvider>
          {/* Background gradient & pattern */}
          <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/50 to-slate-200 relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-brand-200/40 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-200/40 rounded-full mix-blend-multiply filter blur-3xl animate-pulse [animation-delay:2s]" />

            <div className="relative z-10 flex flex-col min-h-screen p-5 font-sans">
              <Header />

              <main className="w-full mx-auto flex-1 flex flex-col justify-start transition-all duration-300">
                <Routes>
                  <Route path="/" element={<Wizard />} />
                  <Route
                    path="/payment-status/:contractId"
                    element={<PaymentStatus />}
                  />
                </Routes>
              </main>

              <footer className="mt-6 pb-2 text-sm text-slate-400 text-center">
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
