import React, { useState } from "react";
import { useAuth, apiClient } from "../context/AuthContext";
import { Lock, User, Eye, EyeOff, Waves, AlertTriangle, Mail, ArrowLeft, CheckCircle2, ExternalLink } from "lucide-react";

const Login = ({ onSuccess }) => {
  const [mode, setMode] = useState("login"); // 'login' | 'forgot'
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(null); // { message, previewUrl }
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

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setForgotSuccess(null);

    try {
      const res = await apiClient.post('/auth/forgot-password', { email: forgotEmail });
      setForgotSuccess({
        message: res.data.message || 'Password reset link sent to your email.',
        previewUrl: res.data.previewUrl,
      });
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to send reset link. Please try again.";
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

      {mode === "login" ? (
        <>
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold mb-1.5 text-slate-900 tracking-tight">
              Welcome back
            </h3>
            <p className="text-sm font-bold text-slate-600">
              Sign in to your technician portal
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 text-red-750 text-sm rounded-xl font-semibold">
              <AlertTriangle className="w-4.5 h-4.5 text-red-600 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username / Email */}
            <div>
              <label
                htmlFor="login-username"
                className="block text-[11px] font-bold text-slate-700 mb-2"
              >
                Username or Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
                <input
                  id="login-username"
                  type="text"
                  className="block w-full pl-11 pr-4 py-3.5 bg-slate-100 border border-transparent rounded-full text-sm placeholder-slate-500 focus:outline-none focus:ring-0 focus:border-brand-500 focus:bg-white transition-all text-slate-900 font-semibold"
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
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="login-password"
                  className="block text-[11px] font-bold text-slate-700"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setMode("forgot");
                  }}
                  className="text-xs font-bold text-brand-600 hover:text-brand-800 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <Lock className="w-4 h-4 text-slate-500" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  className="block w-full pl-11 pr-12 py-3.5 bg-slate-100 border border-transparent rounded-full text-sm placeholder-slate-500 focus:outline-none focus:ring-0 focus:border-brand-500 focus:bg-white transition-all text-slate-900 font-semibold"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-500 hover:text-slate-700 transition-colors"
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
              className={`w-full mt-8 rounded-full border border-brand-500 px-8 py-3.5 text-sm font-bold transition-all cursor-pointer ${
                loading
                  ? "bg-slate-300 border-transparent text-slate-500 cursor-not-allowed"
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
        </>
      ) : (
        <>
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold mb-1.5 text-slate-900 tracking-tight">
              Reset Password
            </h3>
            <p className="text-xs font-semibold text-slate-600">
              Enter your registered email address to receive a password reset link.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 text-red-750 text-sm rounded-xl font-semibold">
              <AlertTriangle className="w-4.5 h-4.5 text-red-600 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {forgotSuccess ? (
            <div className="text-center space-y-4 py-2">
              <div className="inline-flex p-3 bg-emerald-100 text-emerald-600 rounded-full">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <p className="text-xs font-bold text-slate-800 leading-relaxed">
                {forgotSuccess.message}
              </p>
              {forgotSuccess.previewUrl && (
                <div className="p-3 bg-slate-100 rounded-xl text-left text-[11px] font-mono text-slate-700 border border-slate-200 break-all">
                  <span className="font-bold text-brand-700 block mb-1">Ethereal Email Preview Link:</span>
                  <a
                    href={forgotSuccess.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-600 underline hover:text-brand-800 inline-flex items-center gap-1"
                  >
                    View Reset Email <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setForgotSuccess(null);
                  setMode("login");
                }}
                className="w-full mt-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-full cursor-pointer transition-all"
              >
                Return to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Mail className="w-4 h-4 text-slate-500" />
                  </div>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="admin@boatliftprotection.com"
                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-100 border border-transparent rounded-full text-sm placeholder-slate-500 focus:outline-none focus:ring-0 focus:border-brand-500 focus:bg-white transition-all text-slate-900 font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 rounded-full border border-brand-500 bg-brand-500 hover:bg-brand-600 text-white px-8 py-3.5 text-sm font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? "Sending Reset Link..." : "Send Reset Link"}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setMode("login");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </button>
              </div>
            </form>
          )}
        </>
      )}

      <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-500">
        <Waves className="w-3.5 h-3.5 text-slate-400" />
        <span>Boat Lift Protection - Field Portal</span>
      </div>
    </div>
  );
};

export default Login;
