import React, { useState } from "react";
import { useFlow } from "../context/FlowContext";
import { useAuth, apiClient } from "../context/AuthContext";
import { CheckCircle2, FileText, ShieldCheck, Anchor } from "lucide-react";

const ContractReview = ({ onNext, onBack }) => {
  const {
    customer,
    servicePlan,
    contractId,
    signature,
    setSignature,
    technicianName,
    galtContractNo,
    galtApplicationId,
  } = useFlow();

  const { user } = useAuth();
  const [signatureName, setSignatureName] = useState(signature || "");
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSign = async () => {
    const trimmedSignature = signatureName.trim();
    if (!accepted || !trimmedSignature) return;
    setLoading(true);
    setErrorMsg("");
    try {
      await apiClient.post("/contract-signature", {
        contract_id: contractId,
        signature_name: trimmedSignature,
      });
      setSignature(trimmedSignature);
      onNext();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || "Error digitally signing the contract.");
    } finally {
      setLoading(false);
    }
  };

  const fullName = [
    customer?.first_name,
    customer?.middle_initial ? customer.middle_initial + "." : "",
    customer?.last_name,
    customer?.suffix,
  ].filter(Boolean).join(" ").trim() || customer?.name || "N/A";

  const fullAddress = [customer?.street_address, customer?.city, customer?.state, customer?.zip_code]
    .filter(Boolean).join(", ").trim() || customer?.address || "N/A";

  const formattedPhone = customer?.home_phone || customer?.phone || "N/A";
  const contractPrice = servicePlan?.price === "Custom Quote"
    ? "Custom Quote"
    : `$${(servicePlan?.price - (servicePlan?.vehicleStatus === "USED" ? 400 : 0))?.toLocaleString()}`;

  return (
    <div className="animate-in fade-in duration-500 max-h-[85vh] overflow-y-auto pr-2">
      {/* Header */}
      <div className="flex items-center gap-3 bg-brand-500/10 px-6 sm:px-10 py-4 border-b border-brand-500/10">
        <h3 className="text-lg font-semibold text-brand-500 tracking-tight">Contract Review</h3>
        <span className="text-xs border border-brand-500/20 text-brand-500 px-3 py-1 bg-white rounded-full font-medium shadow-sm">
          Digital Signature
        </span>
        {galtContractNo && (
          <span className="text-xs border border-emerald-300 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full font-semibold shadow-sm ml-auto">
            Contract #{galtContractNo}
          </span>
        )}
      </div>

      <div className="p-6 sm:p-10">
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-semibold flex items-center gap-3">
            <span className="text-lg">⚠</span> {errorMsg}
          </div>
        )}

        {/* GALT Contract Confirmation Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-md mb-8 overflow-hidden">
          {/* Card Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="bg-brand-500/10 p-2 rounded-lg">
              <FileText className="w-4 h-4 text-brand-500" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">GALT Service Contract Confirmed</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Issued by Galt Enterprises, Inc. &bull; Contract received from GALT API
              </p>
            </div>
            {galtContractNo && (
              <div className="ml-auto text-right">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Contract No.</p>
                <p className="font-bold text-emerald-700 text-sm">#{galtContractNo}</p>
              </div>
            )}
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Plan & Coverage */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b pb-2">
                Plan & Coverage
              </h4>
              <Row label="Product" value={servicePlan?.name} />
              <Row label="Coverage" value={servicePlan?.coverage} />
              {servicePlan?.contractType && <Row label="Contract Type" value={servicePlan.contractType} />}
              <Row label="Term" value={`${servicePlan?.months} months`} />
              <Row label="Deductible" value="$0" />
              <Row label="Lift Status" value={servicePlan?.vehicleStatus} />
              {servicePlan?.vehicleStatus === "USED" && (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  60-Point Inspection Credit: −$400.00
                </div>
              )}
              <div className="pt-2 border-t">
                <Row label="Contract Price" value={contractPrice} highlight />
              </div>
            </div>

            {/* Customer & Lift */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b pb-2">
                Customer & Lift Details
              </h4>
              <Row label="Customer" value={fullName} />
              <Row label="Address" value={fullAddress} />
              <Row label="Phone" value={formattedPhone} />
              {customer?.email && <Row label="Email" value={customer.email} />}
              <div className="pt-2 border-t space-y-3">
                <Row label="Serial No." value={customer?.serial_number || "—"} mono />
                <Row label="Equipment" value={`${customer?.year || ""} ${customer?.make || ""} ${customer?.model || ""}`.trim() || "—"} />
                {servicePlan?.liftType && (
                  <>
                    <Row label="Lift Type" value={servicePlan.liftType} />
                    <Row label="Weight Class" value={`${servicePlan.liftCategory} (${servicePlan.weightRange})`} />
                  </>
                )}
                <Row label="Date of Sale" value={customer?.date_of_sale || "—"} />
                <Row label="In-Service Date" value={customer?.in_service_date || "—"} />
                <Row label="Mfr. Warranty" value={`${customer?.mnf_warranty_length || 0} months`} />
              </div>
            </div>
          </div>

          {/* Technician */}
          <div className="px-6 pb-5">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 flex items-center gap-3 text-sm">
              <ShieldCheck className="w-4 h-4 text-brand-400 flex-shrink-0" />
              <span className="text-slate-500 font-medium">Service Technician:</span>
              <span className="font-bold text-slate-800">{technicianName || user?.username || "—"}</span>
              {galtApplicationId && (
                <span className="ml-auto text-xs text-slate-400 font-mono">App ID: {galtApplicationId}</span>
              )}
            </div>
          </div>
        </div>

        {/* Signature Section */}
        <div className="space-y-6 max-w-2xl mx-auto md:max-w-none md:w-3/4">
          <label className="flex items-start gap-4 p-5 border-2 border-slate-200 rounded-xl bg-white shadow-sm cursor-pointer hover:border-brand-300 transition-all duration-200 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/30 group">
            <input
              type="checkbox"
              className="mt-0.5 md:mt-1 h-5 w-5 text-brand-600 focus:ring-brand-500 border-slate-300 rounded cursor-pointer transition-colors"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span className="text-base md:text-lg font-semibold text-slate-700 select-none group-has-[:checked]:text-brand-900 transition-colors">
              I acknowledge that I have read and agree to the Contract Terms.
            </span>
          </label>

          <div>
            <label className="block text-base font-semibold text-slate-700 mb-2">Type Full Name for Digital Signature</label>
            <input
              type="text"
              className="input-field text-lg py-4 placeholder-slate-300 shadow-inner"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="e.g. John Doe"
            />
          </div>

          <div className="p-8 border-t border-slate-100 flex flex-col items-center text-center bg-slate-50/30 -mx-6 sm:-mx-10 -mb-6 sm:-mb-10 mt-10">
            <p className="text-sm font-medium text-slate-500 mb-6">You can continue to complete this order or review existing terms.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mb-5">
              <button
                type="button"
                onClick={() => { setSignature(signatureName); onBack(); }}
                className="border border-brand-500 text-brand-600 hover:bg-brand-50 bg-white rounded-full px-8 py-3.5 text-sm transition-colors w-full sm:w-auto min-w-[200px] font-semibold"
              >
                Review Details
              </button>
              <button
                type="button"
                onClick={handleSign}
                disabled={!accepted || !signatureName.trim() || loading}
                className={`rounded-full border border-brand-500 px-8 py-3.5 text-sm transition-colors w-full sm:w-auto min-w-[200px] font-semibold tracking-wide ${
                  accepted && signatureName.trim() && !loading
                    ? "bg-brand-500 text-white hover:bg-brand-600 shadow-md"
                    : "bg-slate-300 border-transparent text-slate-100 cursor-not-allowed"
                }`}
              >
                {loading ? "Processing..." : "Continue to Payment"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Small helper row component
const Row = ({ label, value, highlight, mono }) => (
  <div className="flex justify-between items-start gap-2 text-sm">
    <span className="text-slate-500 font-medium flex-shrink-0">{label}</span>
    <span className={`text-right font-semibold ${highlight ? "text-brand-600 text-base" : "text-slate-800"} ${mono ? "font-mono uppercase text-xs tracking-wide" : ""}`}>
      {value}
    </span>
  </div>
);

export default ContractReview;
