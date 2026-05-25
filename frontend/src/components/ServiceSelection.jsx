import React, { useState, useEffect } from "react";
import { useFlow } from "../context/FlowContext";
import { useAuth } from "../context/AuthContext";
import { ShieldCheck, Anchor, ChevronDown, PhoneCall, AlertTriangle, CheckCircle2 } from "lucide-react";

const liftData = {
  "Four-Post / Multi-Post Lift": [
    { category: "Category 1", weightRange: "4,500 lb – 9,000 lb",   salePrice: 11100,  retailPrice: 1665 },
    { category: "Category 2", weightRange: "16,000 lb – 24,000 lb", salePrice: 19000,  retailPrice: 2850 },
    { category: "Category 3", weightRange: "30,000 lb – 42,000 lb", salePrice: 36000,  retailPrice: 5400 },
    { category: "Category 4", weightRange: "50,000 lb – 80,000 lb", salePrice: 72500,  retailPrice: 10875 },
    { category: "Category 5", weightRange: "100,000 lb and above",   salePrice: 175000, retailPrice: 26250 },
  ],
  "Elevator Lift": [
    { category: "Category 1", weightRange: "5,000 lb – 10,000 lb",  salePrice: 13000,  retailPrice: 1950 },
    { category: "Category 2", weightRange: "12,000 lb – 15,000 lb", salePrice: 17000,  retailPrice: 2550 },
    { category: "Category 3", weightRange: "17,000 lb – 20,000 lb", salePrice: 25000,  retailPrice: 3750 },
    { category: "Category 4", weightRange: "24,000 lb – 40,000 lb", salePrice: 45500,  retailPrice: 6825 },
    { category: "Category 5", weightRange: "54,000 lb – 72,000 lb", salePrice: "Custom Quote", retailPrice: "Custom Quote" },
  ],
  "No-Profile Hydraulic Platform Lift": [
    { category: "Category 1", weightRange: "5,000 lb – 10,000 lb",  salePrice: 55000,  retailPrice: 8250 },
    { category: "Category 2", weightRange: "15,000 lb – 20,000 lb", salePrice: 80000,  retailPrice: 12000 },
    { category: "Category 3", weightRange: "30,000 lb – 50,000 lb", salePrice: 150000, retailPrice: 22500 },
  ],
};

// Coverage options per product
const MAINTENANCE_COVERAGE = ["1 Motor", "2 Motor", "4 Motor"];
const SERVICE_CONTRACT_COVERAGE = ["Gold", "Platinum"];
const SERVICE_CONTRACT_TYPES = ["Post", "Lean To"];

const RadioGroup = ({ label, options, value, onChange, required }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all duration-150 ${
            value === opt
              ? "bg-brand-500 border-brand-500 text-white shadow-md scale-105"
              : "bg-white border-slate-300 text-slate-600 hover:border-brand-400 hover:text-brand-600"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  </div>
);

const ServiceSelection = ({ onNext }) => {
  const { servicePlan, setServicePlan, setInspectionPassed } = useFlow();
  const { user } = useAuth();

  const [selectedPlanId, setSelectedPlanId] = useState(servicePlan?.id || "");
  const [liftType, setLiftType] = useState(servicePlan?.liftType || "");
  const [liftCategoryIndex, setLiftCategoryIndex] = useState("");
  const [vehicleStatus, setVehicleStatus] = useState(servicePlan?.vehicleStatus || "");
  const [coverage, setCoverage] = useState(servicePlan?.coverage || "");
  const [contractType, setContractType] = useState(servicePlan?.contractType || "");

  useEffect(() => {
    if (servicePlan?.id && servicePlan?.liftType && servicePlan?.liftCategory) {
      const cats = liftData[servicePlan.liftType];
      if (cats) {
        const idx = cats.findIndex((c) => c.category === servicePlan.liftCategory);
        if (idx !== -1) setLiftCategoryIndex(idx.toString());
      }
    }
  }, [servicePlan]);

  const handlePlanSelect = (planId) => {
    setSelectedPlanId(planId);
    setCoverage("");
    setContractType("");
  };

  const handleLiftTypeChange = (e) => {
    setLiftType(e.target.value);
    setLiftCategoryIndex("");
  };

  const selectedCategories = liftType ? liftData[liftType] : [];
  const selectedCat = liftType && liftCategoryIndex !== "" ? selectedCategories[parseInt(liftCategoryIndex)] : null;
  const isCustomQuote = selectedCat?.retailPrice === "Custom Quote";

  // Validation
  const coverageValid =
    selectedPlanId === "maintenance"
      ? !!coverage
      : selectedPlanId === "service_contract"
      ? !!coverage && !!contractType
      : false;

  const isContinueDisabled =
    !selectedPlanId ||
    !vehicleStatus ||
    !coverageValid ||
    !selectedCat ||
    isCustomQuote;

  const handleContinue = () => {
    // Reset inspection gate whenever we start a new flow
    setInspectionPassed(false);

    if (selectedPlanId === "maintenance" && selectedCat && !isCustomQuote) {
      setServicePlan({
        id: "maintenance",
        productId: 102,
        name: "Boat Lift Preferred Maintenance Protection (PMP)",
        price: 3000,
        months: 36,
        vehicleStatus,
        coverage,          // "1 Motor" | "2 Motor" | "4 Motor"
        contractType: null,
        liftType,
        liftCategory: selectedCat.category,
        weightRange: selectedCat.weightRange,
        vehicleSalePrice: selectedCat.salePrice,
        retailPrice: 3000,
      });
      onNext();
    } else if (selectedPlanId === "service_contract" && selectedCat && !isCustomQuote) {
      setServicePlan({
        id: "service_contract",
        productId: 103,
        name: "Boat Lift Service Contract (ESC)",
        price: selectedCat.retailPrice,
        months: 60,
        vehicleStatus,
        coverage,          // "Gold" | "Platinum"
        contractType,      // "Post" | "Lean To"
        liftType,
        liftCategory: selectedCat.category,
        weightRange: selectedCat.weightRange,
        vehicleSalePrice: selectedCat.salePrice,
        retailPrice: selectedCat.retailPrice,
      });
      onNext();
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3 bg-brand-500/10 px-6 sm:px-10 py-4 border-b border-brand-500/10 rounded-t-2xl">
        <h3 className="text-lg font-semibold text-brand-500 tracking-tight">Select Product Type</h3>
        <span className="text-[11px] uppercase tracking-wider border border-brand-500/20 text-brand-500 px-3 py-0.5 bg-white rounded-full font-semibold shadow-sm">
          Tech: {user?.username || "Unknown"}
        </span>
      </div>

      <div className="p-6 sm:p-10 space-y-8">
        {/* Product Cards */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-4">
            Product type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Maintenance (PMP) */}
            <div
              onClick={() => handlePlanSelect("maintenance")}
              className={`border rounded-2xl p-6 md:p-8 cursor-pointer transition-all duration-200 bg-white relative flex flex-col justify-between min-h-[160px] ${
                selectedPlanId === "maintenance"
                  ? "border-brand-500 ring-2 ring-brand-500/10 shadow-md"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <h4 className="font-bold text-[17px] text-slate-900">Maintenance Program</h4>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-400 bg-brand-50 px-2 py-0.5 rounded-full mt-1 inline-block">PMP · Product 102</span>
                  </div>
                  {selectedPlanId === "maintenance" && (
                    <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    </div>
                  )}
                </div>
                <p className="text-slate-400 text-sm mb-4">Prepaid scheduled maintenance · Non-transferable</p>
              </div>
              <div className="mt-auto">
                <div className="font-extrabold text-slate-800 text-3xl mb-1">$3,000</div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">flat fee · 36 months · $0 deductible</div>
              </div>
            </div>

            {/* Card 2: Service Contract (ESC) */}
            <div
              onClick={() => handlePlanSelect("service_contract")}
              className={`border rounded-2xl p-6 md:p-8 cursor-pointer transition-all duration-200 bg-white relative flex flex-col justify-between min-h-[160px] ${
                selectedPlanId === "service_contract"
                  ? "border-brand-500 ring-2 ring-brand-500/10 shadow-md"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <h4 className="font-bold text-[17px] text-slate-900">Service Contract</h4>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full mt-1 inline-block">ESC · Product 103</span>
                  </div>
                  {selectedPlanId === "service_contract" && (
                    <div className="w-5 h-5 rounded-full bg-brand-50 flex items-center justify-center border border-brand-500">
                      <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                    </div>
                  )}
                </div>
                <p className="text-slate-400 text-sm mb-4">Component failure protection · Transferable to new owner</p>
              </div>
              <div className="mt-auto">
                <div className="font-extrabold text-slate-800 text-3xl mb-1">Price varies</div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">by lift size · 60 months · $0 deductible</div>
              </div>
            </div>
          </div>
        </div>

        {/* Lift Status - always visible once plan selected */}
        {selectedPlanId && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-slate-50/55 p-6 rounded-2xl border border-slate-200/60 space-y-4">
            <h5 className="font-bold text-slate-600 text-sm border-b pb-2 uppercase tracking-wide">Lift Status</h5>
            <div className="flex gap-4">
              {["NEW", "USED"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setVehicleStatus(status)}
                  className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all duration-150 ${
                    vehicleStatus === status
                      ? status === "NEW"
                        ? "bg-emerald-500 border-emerald-500 text-white shadow-md"
                        : "bg-amber-500 border-amber-500 text-white shadow-md"
                      : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {status === "NEW" ? "✓ New Lift" : "⚠ Used Lift"}
                </button>
              ))}
            </div>
            {vehicleStatus === "USED" && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-amber-800">
                  <strong>Used lift requires a 60-point inspection</strong> ($400 fee) before the contract can be submitted.
                  You will be prompted to confirm the inspection result before proceeding.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Coverage Selection — shown once plan is selected */}
        {selectedPlanId && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-slate-50/55 p-6 rounded-2xl border border-slate-200/60 space-y-6">
            <h5 className="font-bold text-slate-600 text-sm border-b pb-2 uppercase tracking-wide">Coverage Options</h5>

            {selectedPlanId === "maintenance" && (
              <RadioGroup
                label="Motor Coverage"
                options={MAINTENANCE_COVERAGE}
                value={coverage}
                onChange={setCoverage}
                required
              />
            )}

            {selectedPlanId === "service_contract" && (
              <>
                <RadioGroup
                  label="Coverage Tier"
                  options={SERVICE_CONTRACT_COVERAGE}
                  value={coverage}
                  onChange={setCoverage}
                  required
                />
                <RadioGroup
                  label="Contract Type"
                  options={SERVICE_CONTRACT_TYPES}
                  value={contractType}
                  onChange={setContractType}
                  required
                />
              </>
            )}
          </div>
        )}

        {/* Lift Rating Details */}
        {(selectedPlanId === "service_contract" || selectedPlanId === "maintenance") && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-slate-50/55 p-6 rounded-2xl border border-slate-200/60 space-y-6">
            <h5 className="font-bold text-slate-600 text-sm border-b pb-2 uppercase tracking-wide">Lift Rating Details</h5>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Select Lift Type <span className="text-red-500">*</span>
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <select
                    value={liftType}
                    onChange={handleLiftTypeChange}
                    className="w-full rounded-xl border border-slate-300 pl-4 pr-10 py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white font-medium text-slate-800 appearance-none cursor-pointer transition-all"
                  >
                    <option value="">-- Choose Lift Type --</option>
                    {Object.keys(liftData).map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Select Weight Capacity Category <span className="text-red-500">*</span>
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <select
                    value={liftCategoryIndex}
                    onChange={(e) => setLiftCategoryIndex(e.target.value)}
                    disabled={!liftType}
                    className="w-full rounded-xl border border-slate-300 pl-4 pr-10 py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white font-medium text-slate-800 appearance-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-all"
                  >
                    <option value="">-- Choose Category --</option>
                    {selectedCategories.map((c, idx) => (
                      <option key={idx} value={idx}>
                        {c.category} ({c.weightRange})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Selection Result Card */}
            {selectedCat && (
              <div className="animate-in zoom-in-95 duration-250 bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h6 className="font-bold text-slate-800 text-md">{liftType}</h6>
                  <p className="text-sm text-slate-500 font-medium mt-1">
                    {selectedCat.category} &bull; Capacity: <strong className="text-slate-700">{selectedCat.weightRange}</strong>
                  </p>
                  {!isCustomQuote && (
                    <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-3 text-xs text-slate-400 font-medium">
                      <span>Midpoint Value (VehicleSalePrice): <strong className="text-slate-600">${selectedCat.salePrice.toLocaleString()}</strong></span>
                      <span>Contract Base (RetailPrice): <strong className="text-slate-600">${selectedPlanId === "maintenance" ? "3,000" : selectedCat.retailPrice.toLocaleString()}</strong></span>
                    </div>
                  )}
                </div>
                <div className="text-right self-stretch md:self-auto flex flex-row md:flex-col justify-between items-center md:items-end gap-2 border-t md:border-t-0 pt-3 md:pt-0 mt-3 md:mt-0 border-slate-100">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Base Plan Price</span>
                  {isCustomQuote ? (
                    <span className="text-xl font-bold text-amber-600 uppercase tracking-tight">Custom Quote</span>
                  ) : (
                    <span className="text-3xl font-extrabold text-brand-500">
                      ${selectedPlanId === "maintenance" ? "3,000" : selectedCat.retailPrice.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Custom Quote Box */}
            {isCustomQuote && (
              <div className="animate-in fade-in duration-300 border border-amber-200 bg-amber-50/50 p-5 rounded-xl flex gap-4 items-start">
                <div className="bg-amber-100 p-2.5 rounded-lg text-amber-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h6 className="font-bold text-amber-900 text-[15px] mb-1">Custom Quote Required</h6>
                  <p className="text-amber-700 text-xs leading-relaxed mb-3">
                    Elevator lifts exceeding 54,000 lb capacity are outside standard automated rating scopes. Please record customer details and contact support for manual processing.
                  </p>
                  <a
                    href="mailto:support@boatliftprotection.example.com?subject=Custom%20Quote%20Request%20-%20Elevator%20Category%205"
                    className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors shadow-sm"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    Request Custom Quote
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-8 border-t border-slate-100 flex flex-col items-center text-center bg-slate-50/30">
        {isContinueDisabled && selectedPlanId && (
          <p className="text-xs text-slate-400 mb-3">
            {!vehicleStatus && "Select lift status (New or Used). "}
            {vehicleStatus && !coverageValid && "Select all required coverage options. "}
            {selectedPlanId === "service_contract" && vehicleStatus && coverageValid && !selectedCat && "Select lift type and category. "}
          </p>
        )}
        <p className="text-sm font-medium text-slate-500 mb-6">
          You can continue to configure your customer and lift specifications on the next step.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mb-5">
          <button
            type="button"
            onClick={handleContinue}
            disabled={isContinueDisabled}
            className={`rounded-full border border-accent-500 px-8 py-3.5 text-sm transition-colors w-full sm:w-auto min-w-[240px] font-semibold tracking-wide ${
              !isContinueDisabled
                ? "bg-accent-500 text-white hover:bg-accent-600 shadow-md"
                : "bg-slate-200 border-transparent text-slate-400 cursor-not-allowed"
            }`}
          >
            {isCustomQuote ? "Manual Action Required" : "Continue to Details"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceSelection;
