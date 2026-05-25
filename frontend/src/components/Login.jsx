import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Lock, User, Eye, EyeOff, Shield, Waves } from "lucide-react";

const Login = ({ onSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(username, password);
      onSuccess?.();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Invalid credentials. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in zoom-in duration-300 p-8 sm:p-12">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <img
          src="/logo.png"
          alt="Boat Lift Protection"
          className="h-12 object-contain"
        />
      </div>

      <div className="text-center mb-10">
        <h3 className="text-2xl font-bold mb-1.5 text-slate-900 tracking-tight">
          Welcome back
        </h3>
        <p className="text-sm font-medium text-slate-500">
          Sign in to your technician portal
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          <span className="mt-0.5 shrink-0">⚠</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-5">
        {/* Username */}
        <div>
          <label
            htmlFor="login-username"
            className="block text-[11px] font-bold text-slate-700 mb-2"
          >
            Shared ID
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <User className="w-4 h-4 text-slate-400" />
            </div>
            <input
              id="login-username"
              type="text"
              className="block w-full pl-11 pr-4 py-3.5 bg-slate-100 border border-transparent rounded-full text-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-brand-500 focus:bg-white transition-all text-slate-800 font-medium"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="demo_vendor"
              autoComplete="username"
              required
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="login-password"
            className="block text-[11px] font-bold text-slate-700 mb-2"
          >
            Password
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Lock className="w-4 h-4 text-slate-400" />
            </div>
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              className="block w-full pl-11 pr-12 py-3.5 bg-slate-100 border border-transparent rounded-full text-sm placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-brand-500 focus:bg-white transition-all text-slate-800 font-medium"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600 transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <button
          id="login-submit"
          type="submit"
          disabled={loading}
          className={`w-full mt-8 rounded-full border border-brand-500 px-8 py-3.5 text-sm transition-all ${
            loading
              ? "bg-slate-300 border-transparent text-slate-100 cursor-not-allowed"
              : "bg-brand-500 text-white hover:bg-brand-600 shadow-sm"
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Authenticating…
            </span>
          ) : (
            "Sign In Securely"
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] font-semibold text-slate-400">
        <Waves className="w-3.5 h-3.5 text-slate-300" />
        <span>Boat Lift Protection - Field Portal</span>
      </div>
    </div>
  );
};

export default Login;
