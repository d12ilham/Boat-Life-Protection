import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../context/AuthContext';
import { Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing password reset token. Please request a new reset link.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError('Missing reset token');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await apiClient.post('/auth/reset-password', {
        token,
        newPassword: password,
      });
      setSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reset password. The link may have expired.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-10 px-4 sm:px-6 select-none animate-in fade-in duration-300">
      <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-3xl shadow-xl p-8 sm:p-10">
        
        {/* Header Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="Boat Lift Protection" className="h-12 object-contain" />
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-brand-50 rounded-2xl text-brand-600 mb-3">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Reset Password</h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Enter your new secure account password below
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success State */}
        {success ? (
          <div className="text-center py-4 space-y-6">
            <div className="inline-flex p-4 bg-emerald-100 rounded-full text-emerald-600 animate-in zoom-in duration-200">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Password Reset Successful!</h3>
              <p className="text-xs font-medium text-slate-600 mt-2">
                Your password has been updated. You can now log into your account using your new credentials.
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-full shadow-md transition-all cursor-pointer"
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">New Password</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={!token}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="block w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Confirm Password</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={!token}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full mt-6 py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-sm rounded-full shadow-md transition-all cursor-pointer flex justify-center items-center gap-2"
            >
              {loading ? 'Updating Password...' : 'Save New Password'}
            </button>

            <div className="text-center pt-4 border-t border-slate-100">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
