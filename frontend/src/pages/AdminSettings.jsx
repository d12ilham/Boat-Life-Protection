import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Save,
  Unplug,
  CheckCircle2,
  AlertCircle,
  Lock,
  RefreshCw,
  ArrowLeft,
  Briefcase,
  CreditCard,
  Mail,
  Zap,
  Globe,
} from "lucide-react";
import { useAuth, apiClient } from "../context/AuthContext";

const CATEGORIES = [
  {
    id: "quickbooks",
    name: "QuickBooks",
    icon: Globe,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    id: "stripe",
    name: "Stripe",
    icon: CreditCard,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    icon: Briefcase,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    id: "galt",
    name: "Galt Warranty",
    icon: Zap,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    id: "email",
    name: "Email / SMTP",
    icon: Mail,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
];

export default function AdminSettings() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("quickbooks");
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qboStatus, setQboStatus] = useState(null);

  // Local state for modified inputs: { [key]: value }
  const [formState, setFormState] = useState({});
  // Unmasked keys state: { [key]: value }
  const [revealedKeys, setRevealedKeys] = useState({});

  // Password confirmation modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState(null); // 'save' | 'reveal' | 'disconnect'
  const [targetKeyToReveal, setTargetKeyToReveal] = useState(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  // Global alert message state
  const [alert, setAlert] = useState(null); // { type: 'success'|'error', text: '' }

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || user?.role !== "admin") {
      navigate("/");
      return;
    }

    fetchSettings();
    fetchQboStatus();
  }, [authLoading, isAuthenticated, user]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/admin/settings");
      const data = res.data;
      setSettings(data.settings || []);

      // Initialize form state
      const initialForm = {};
      (data.settings || []).forEach((item) => {
        initialForm[item.key] = item.value;
      });
      setFormState(initialForm);
    } catch (err) {
      console.error("Error fetching settings:", err);
      showAlert("error", "Failed to load system settings");
    } finally {
      setLoading(false);
    }
  };

  const fetchQboStatus = async () => {
    try {
      const res = await apiClient.get("/qbo/status");
      setQboStatus(res.data);
    } catch (err) {
      console.error("Failed to fetch QBO status:", err);
    }
  };

  const showAlert = (type, text) => {
    setAlert({ type, text });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleInputChange = (key, val) => {
    setFormState((prev) => ({ ...prev, [key]: val }));
  };

  const openSaveModal = () => {
    setModalError("");
    setAdminPassword("");
    setModalAction("save");
    setModalOpen(true);
  };

  const openRevealModal = (key) => {
    setModalError("");
    setAdminPassword("");
    setModalAction("reveal");
    setTargetKeyToReveal(key);
    setModalOpen(true);
  };

  const openDisconnectModal = () => {
    setModalError("");
    setAdminPassword("");
    setModalAction("disconnect");
    setModalOpen(true);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!adminPassword) {
      setModalError("Please enter your admin password");
      return;
    }

    setModalLoading(true);
    setModalError("");

    try {
      if (modalAction === "save") {
        // Save ONLY settings belonging to activeTab
        const activeCategorySettings = settings.filter(
          (s) => s.category === activeTab,
        );
        const updatedList = activeCategorySettings
          .filter((s) => formState[s.key] !== undefined)
          .map((s) => ({
            key: s.key,
            value: formState[s.key],
            category: s.category,
            is_secret: s.isSecret,
          }));

        const res = await apiClient.post("/admin/settings", {
          settings: updatedList,
          password: adminPassword,
        });

        if (res.data.success) {
          setModalOpen(false);
          const categoryName =
            CATEGORIES.find((c) => c.id === activeTab)?.name || "Tab";
          showAlert(
            "success",
            `${categoryName} settings updated and encrypted successfully!`,
          );
          fetchSettings();
        } else {
          setModalError(
            res.data.message || "Incorrect password or update failed",
          );
        }
      } else if (modalAction === "reveal") {
        const res = await apiClient.post("/admin/settings/reveal", {
          key: targetKeyToReveal,
          password: adminPassword,
        });

        if (res.data.value !== undefined) {
          setRevealedKeys((prev) => ({
            ...prev,
            [targetKeyToReveal]: res.data.value,
          }));
          setFormState((prev) => ({
            ...prev,
            [targetKeyToReveal]: res.data.value,
          }));
          setModalOpen(false);
          showAlert("success", `Unmasked key: ${targetKeyToReveal}`);
        } else {
          setModalError("Failed to reveal key");
        }
      } else if (modalAction === "disconnect") {
        const res = await apiClient.post("/admin/qbo/disconnect", {
          password: adminPassword,
        });

        if (res.data.success) {
          setModalOpen(false);
          showAlert("success", "QuickBooks disconnected successfully.");
          fetchQboStatus();
        } else {
          setModalError(res.data.message || "Failed to disconnect QuickBooks");
        }
      }
    } catch (err) {
      const msg =
        err.response?.data?.message || "Incorrect password or network error";
      setModalError(msg);
    } finally {
      setModalLoading(false);
    }
  };

  const handleQboConnect = () => {
    window.location.href = `${API_URL}/qbo/connect`;
  };

  const activeCategory = CATEGORIES.find((c) => c.id === activeTab);
  const activeSettings = settings.filter((s) => s.category === activeTab);

  // Helper to determine status for non-QuickBooks categories
  const getTabStatusSummary = () => {
    if (activeTab === "stripe") {
      const secretKey = settings.find((s) => s.key === "STRIPE_SECRET_KEY");
      const webhook = settings.find((s) => s.key === "STRIPE_WEBHOOK_SECRET");
      const testMode = settings.find((s) => s.key === "STRIPE_TEST_MODE");
      const isTestModeActive = testMode?.value === "true";
      const isConfigured = secretKey?.isSet;
      return {
        title: "Stripe Payment Gateway",
        statusText: isConfigured ? (isTestModeActive ? "Configured (Test Mode $1.00)" : "Configured (Live Mode)") : "Missing Secret Key",
        isOk: isConfigured,
        details: isConfigured
          ? `Webhook: ${webhook?.isSet ? "Configured" : "Not Set"} | Mode: ${isTestModeActive ? "Test Mode Enabled ($1.00 Charges)" : "Live Mode (Full Charges)"}`
          : "Configure your Stripe Secret Key to process payments.",
      };
    } else if (activeTab === "hubspot") {
      const apiKey = settings.find((s) => s.key === "HUBSPOT_API_KEY");
      const accId = settings.find((s) => s.key === "HUBSPOT_ACCOUNT_ID");
      const isConfigured = apiKey?.isSet;
      return {
        title: "HubSpot CRM Integration",
        statusText: isConfigured ? "Configured" : "Missing Access Token",
        isOk: isConfigured,
        details: isConfigured
          ? `Account ID: ${accId?.value || "Default"}`
          : "Configure Private App Token to sync contacts and deals.",
      };
    } else if (activeTab === "galt") {
      const baseUrl = settings.find((s) => s.key === "GALT_API_BASE_URL");
      const userKey = settings.find((s) => s.key === "GALT_USERNAME");
      const isConfigured = baseUrl?.isSet && userKey?.isSet;
      return {
        title: "Galt Warranty Integration",
        statusText: isConfigured ? "Configured" : "Incomplete Credentials",
        isOk: isConfigured,
        details: isConfigured
          ? `User: ${userKey?.value || "Configured"}`
          : "Configure Base URL and credentials for warranty generation.",
      };
    } else if (activeTab === "email") {
      const host = settings.find((s) => s.key === "SMTP_HOST");
      const sender = settings.find((s) => s.key === "EMAIL_FROM");
      const isConfigured = host?.isSet;
      return {
        title: "Email / SMTP Service",
        statusText: isConfigured ? "Configured" : "Not Configured",
        isOk: isConfigured,
        details: isConfigured
          ? `Sender: ${sender?.value || "Default"}`
          : "Configure SMTP host and credentials to send automated contract emails.",
      };
    }
    return null;
  };

  const statusSummary = getTabStatusSummary();

  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center font-bold text-slate-400 text-sm">
        Authenticating session...
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8 select-none animate-in fade-in duration-300 overflow-x-clip">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-slate-200/80">
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 sm:gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 mb-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Back to
            Dashboard
          </button>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5 sm:gap-3">
            <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-brand-600 shrink-0" />
            Admin System Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage live integration keys, webhook secrets, and authentication
            parameters with AES-256 encryption.
          </p>
        </div>
      </div>

      {/* Alert Banner */}
      {alert && (
        <div
          className={`p-3.5 sm:p-4 mb-5 sm:mb-6 rounded-xl sm:rounded-2xl border flex items-center gap-2.5 sm:gap-3 text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-top-2 duration-200 ${
            alert.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          {alert.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 shrink-0" />
          )}
          <span>{alert.text}</span>
        </div>
      )}

      {/* Category Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 border-b border-slate-200/80 pb-3.5 mb-6">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeTab === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                isActive
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-white/80 text-slate-600 hover:bg-white border border-slate-200/60"
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? "text-white" : cat.color}`}
              />
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* QuickBooks Live Status Summary Box */}
      {activeTab === "quickbooks" && (
        <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
              <div
                className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl shrink-0 ${qboStatus?.connected ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
              >
                <Globe className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex flex-wrap items-center gap-2">
                  QuickBooks Connection Status
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold uppercase ${
                      qboStatus?.connected
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-rose-100 text-rose-800 border border-rose-300"
                    }`}
                  >
                    {qboStatus?.connected ? "Connected" : "Disconnected"}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5 break-all sm:break-normal">
                  {qboStatus?.connected
                    ? `Active Realm / Company ID: ${qboStatus.realmId}`
                    : "Not connected to any QuickBooks Online company."}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto shrink-0">
              {qboStatus?.connected ? (
                <>
                  <button
                    type="button"
                    onClick={handleQboConnect}
                    className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer w-full sm:w-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reconnect QBO
                  </button>
                  <button
                    type="button"
                    onClick={openDisconnectModal}
                    className="inline-flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-4 py-2.5 rounded-xl border border-rose-200 transition-all cursor-pointer w-full sm:w-auto"
                  >
                    <Unplug className="w-3.5 h-3.5" /> Disconnect
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleQboConnect}
                  className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer w-full sm:w-auto"
                >
                  <Globe className="w-3.5 h-3.5" /> Connect QuickBooks
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Non-QuickBooks Status Summary Box */}
      {activeTab !== "quickbooks" && statusSummary && (
        <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-xs">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
            <div
              className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl shrink-0 ${statusSummary.isOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
            >
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex flex-wrap items-center gap-2">
                {statusSummary.title}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold uppercase ${
                    statusSummary.isOk
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-amber-100 text-amber-800 border border-amber-300"
                  }`}
                >
                  {statusSummary.statusText}
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                {statusSummary.details}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Settings Form */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center text-slate-400 font-bold text-xs sm:text-sm">
          Loading settings...
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xs">
          <div className="space-y-4 sm:space-y-6">
            {activeSettings.map((setting) => {
              const value =
                formState[setting.key] !== undefined
                  ? formState[setting.key]
                  : setting.value;
              const isRevealed = !!revealedKeys[setting.key];

              return (
                <div
                  key={setting.key}
                  className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-slate-50/70 border border-slate-200/80 transition-all min-w-0"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 mb-2">
                    <div className="min-w-0">
                      <label className="block font-bold text-slate-800 text-xs sm:text-sm flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {setting.label}
                        {setting.isSecret && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-md">
                            <Lock className="w-2.5 h-2.5" /> Secret
                          </span>
                        )}
                        {setting.isCustomDb && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-md">
                            DB Override
                          </span>
                        )}
                      </label>
                      <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                        {setting.description}
                      </p>
                    </div>

                    {setting.isSecret && !isRevealed && (
                      <button
                        type="button"
                        onClick={() => openRevealModal(setting.key)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-800 cursor-pointer self-start sm:self-auto mt-1 sm:mt-0"
                      >
                        <Eye className="w-3.5 h-3.5" /> Reveal Key
                      </button>
                    )}
                  </div>

                  {setting.options ? (
                    <select
                      value={value}
                      onChange={(e) =>
                        handleInputChange(setting.key, e.target.value)
                      }
                      className="w-full mt-2 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    >
                      {setting.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt === 'true'
                            ? 'ENABLED (Charge $1.00 for Testing)'
                            : opt === 'false'
                              ? 'DISABLED (Charge Full Contract Amount)'
                              : opt.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="relative mt-2">
                      <input
                        type={
                          setting.isSecret && !isRevealed ? "password" : "text"
                        }
                        value={value}
                        onChange={(e) =>
                          handleInputChange(setting.key, e.target.value)
                        }
                        placeholder={`Enter ${setting.label}`}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none pr-10"
                      />
                      {setting.isSecret && (
                        <div className="absolute right-3 top-3 text-slate-400">
                          {isRevealed ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Lock className="w-4 h-4" />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-200 flex justify-end">
            <button
              onClick={openSaveModal}
              className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl sm:rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer w-full sm:w-auto"
            >
              <Save className="w-4 h-4" /> Save {activeCategory?.name} Settings
            </button>
          </div>
        </div>
      )}

      {/* Password Re-Verification Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4 text-brand-600">
              <div className="p-2.5 sm:p-3 bg-brand-50 rounded-xl sm:rounded-2xl shrink-0">
                <KeyRound className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                  Admin Password Verification
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-semibold">
                  Security re-authentication required
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-medium mb-5 sm:mb-6 leading-relaxed">
              {modalAction === "save" &&
                `Please enter your password to encrypt and save ${activeCategory?.name} settings.`}
              {modalAction === "reveal" &&
                `Please enter your password to unmask secret key: ${targetKeyToReveal}`}
              {modalAction === "disconnect" &&
                "Please enter your password to confirm disconnecting QuickBooks."}
            </p>

            {modalError && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {modalError}
              </div>
            )}

            <form onSubmit={handleModalSubmit}>
              <div className="mb-5 sm:mb-6">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  autoFocus
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter your account password"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 text-center"
                >
                  {modalLoading ? "Verifying..." : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
