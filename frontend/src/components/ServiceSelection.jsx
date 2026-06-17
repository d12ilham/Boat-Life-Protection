import React, { useState, useEffect } from "react";
import { useFlow } from "../context/FlowContext";
import { useAuth } from "../context/AuthContext";
import {
  ChevronDown,
  PhoneCall,
  AlertTriangle,
  CheckCircle2,
  Check,
} from "lucide-react";

const liftData = {
  "Four-Post / Multi-Post Lift": [
    {
      category: "Category 1",
      weightRange: "4,500 lb – 9,000 lb",
      salePrice: 11100,
      retailPrice: 1665,
    },
    {
      category: "Category 2",
      weightRange: "16,000 lb – 24,000 lb",
      salePrice: 19000,
      retailPrice: 2850,
    },
    {
      category: "Category 3",
      weightRange: "30,000 lb – 42,000 lb",
      salePrice: 36000,
      retailPrice: 5400,
    },
    {
      category: "Category 4",
      weightRange: "50,000 lb – 80,000 lb",
      salePrice: 72500,
      retailPrice: 10875,
    },
    {
      category: "Category 5",
      weightRange: "100,000 lb and above",
      salePrice: 175000,
      retailPrice: 26250,
    },
  ],
  "Elevator Lift": [
    {
      category: "Category 1",
      weightRange: "5,000 lb – 10,000 lb",
      salePrice: 13000,
      retailPrice: 1950,
    },
    {
      category: "Category 2",
      weightRange: "12,000 lb – 15,000 lb",
      salePrice: 17000,
      retailPrice: 2550,
    },
    {
      category: "Category 3",
      weightRange: "17,000 lb – 20,000 lb",
      salePrice: 25000,
      retailPrice: 3750,
    },
    {
      category: "Category 4",
      weightRange: "24,000 lb – 40,000 lb",
      salePrice: 45500,
      retailPrice: 6825,
    },
    {
      category: "Category 5",
      weightRange: "54,000 lb – 72,000 lb",
      salePrice: "Custom Quote",
      retailPrice: "Custom Quote",
    },
  ],
  "No-Profile Hydraulic Platform Lift": [
    {
      category: "Category 1",
      weightRange: "5,000 lb – 10,000 lb",
      salePrice: 55000,
      retailPrice: 8250,
    },
    {
      category: "Category 2",
      weightRange: "15,000 lb – 20,000 lb",
      salePrice: 80000,
      retailPrice: 12000,
    },
    {
      category: "Category 3",
      weightRange: "30,000 lb – 50,000 lb",
      salePrice: 150000,
      retailPrice: 22500,
    },
  ],
};

// Coverage options per product
const MAINTENANCE_COVERAGE = ["1 Motor", "2 Motor", "4 Motor"];
const SERVICE_CONTRACT_COVERAGE = ["Gold", "Platinum"];
const SERVICE_CONTRACT_TYPES = ["Post", "Lean To"];

// Premium custom floating dropdown component
const CustomDropdown = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  disabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      const container = document.getElementById(
        `dropdown-${label.replace(/\s+/g, "-").toLowerCase()}`,
      );
      if (container && !container.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, label]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div
      id={`dropdown-${label.replace(/\s+/g, "-").toLowerCase()}`}
      className="relative space-y-2.5"
    >
      <label className="block text-sm font-bold text-slate-800">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full relative flex items-center rounded-2xl border-2 pl-5 pr-12 py-3.5 bg-white font-bold text-slate-800 text-left transition-all duration-205 cursor-pointer ${
            disabled
              ? "bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed"
              : isOpen
                ? "border-brand-500 ring-4 ring-brand-500/5 shadow-xs"
                : "border-slate-300 hover:border-slate-400 hover:shadow-xs"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={
                !selectedOption ? "text-slate-500 font-bold" : "text-slate-900"
              }
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
            <ChevronDown
              className={`w-5 h-5 transition-transform duration-200 ${
                disabled ? "text-slate-300" : "text-slate-600"
              } ${isOpen ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-200/80 rounded-2xl shadow-md shadow-slate-200/20 max-h-72 overflow-y-auto p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left rounded-xl px-4 py-3 flex items-center justify-between transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "bg-brand-50 text-brand-900 font-bold"
                      : "hover:bg-slate-50 text-slate-700 font-semibold"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm">{opt.label}</span>
                    {opt.subtext && (
                      <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                        {opt.subtext}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-brand-650 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// Premium custom option tiles with subtle active style
const RadioGroup = ({ label, options, value, onChange, required }) => {
  const getCardStyle = (opt, isActive) => {
    if (opt === "Gold") {
      return isActive
        ? "bg-amber-600 border-amber-700 text-white scale-[1.01] shadow-md"
        : "bg-white border-slate-300 text-slate-800 hover:border-slate-400 hover:shadow-xs";
    }
    if (opt === "Platinum") {
      return isActive
        ? "bg-indigo-700 border-indigo-800 text-white scale-[1.01] shadow-md"
        : "bg-white border-slate-300 text-slate-800 hover:border-slate-400 hover:shadow-xs";
    }
    return isActive
      ? "bg-[#2f4269] border-[#2f4269] text-white scale-[1.01] shadow-md"
      : "bg-white border-slate-300 text-slate-800 hover:border-slate-400 hover:shadow-xs";
  };

  const getSubtext = (opt) => {
    if (opt === "Gold") return "Standard parts & motor coverage";
    if (opt === "Platinum") return "Full comprehensive wrap cover (+$500)";
    if (opt === "1 Motor") return "1 boat lift motor supported";
    if (opt === "2 Motor") return "2 boat lift motors supported";
    if (opt === "4 Motor") return "4 boat lift motors supported";
    if (opt === "Post") return "Post mount lift setup";
    if (opt === "Lean To") return "Side mount lift setup";
    return "";
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold text-slate-600">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div
        className={`grid grid-cols-1 ${options.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"} gap-4`}
      >
        {options.map((opt) => {
          const isActive = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`py-5 px-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center ${getCardStyle(
                opt,
                isActive,
              )}`}
            >
              <span className="text-xl font-bold uppercase tracking-tight">
                {opt}
              </span>
              <span
                className={`text-sm mt-1 leading-normal ${
                  isActive ? "text-white/95" : "text-slate-500"
                }`}
              >
                {getSubtext(opt)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const ServiceSelection = ({ onNext }) => {
  const { servicePlan, setServicePlan, setInspectionPassed } = useFlow();
  const { user, logout } = useAuth();

  const [selectedPlanId, setSelectedPlanId] = useState(servicePlan?.id || "");
  const [liftType, setLiftType] = useState(servicePlan?.liftType || "");
  const [liftCategoryIndex, setLiftCategoryIndex] = useState("");
  const [vehicleStatus, setVehicleStatus] = useState(
    servicePlan?.vehicleStatus || "",
  );
  const [coverage, setCoverage] = useState(servicePlan?.coverage || "");
  const [contractType, setContractType] = useState(
    servicePlan?.contractType || "",
  );

  useEffect(() => {
    if (servicePlan?.id && servicePlan?.liftType && servicePlan?.liftCategory) {
      const cats = liftData[servicePlan.liftType];
      if (cats) {
        const idx = cats.findIndex(
          (c) => c.category === servicePlan.liftCategory,
        );
        if (idx !== -1) setLiftCategoryIndex(idx.toString());
      }
    }
  }, [servicePlan]);

  const handlePlanSelect = (planId) => {
    setSelectedPlanId(planId);
    setCoverage("");
    setContractType("");
  };

  const selectedCategories = liftType ? liftData[liftType] : [];
  const selectedCat =
    liftType && liftCategoryIndex !== ""
      ? selectedCategories[parseInt(liftCategoryIndex)]
      : null;
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
        coverage, // "1 Motor" | "2 Motor" | "4 Motor"
        contractType: null,
        liftType,
        liftCategory: selectedCat.category,
        weightRange: selectedCat.weightRange,
        vehicleSalePrice: selectedCat.salePrice,
        retailPrice: 3000,
      });
      onNext();
    } else if (
      selectedPlanId === "service_contract" &&
      selectedCat &&
      !isCustomQuote
    ) {
      const addonFee = coverage === "Platinum" ? 500 : 0;
      setServicePlan({
        id: "service_contract",
        productId: 103,
        name: "Boat Lift Service Contract (ESC)",
        price: selectedCat.retailPrice + addonFee,
        months: 60,
        vehicleStatus,
        coverage, // "Gold" | "Platinum"
        contractType, // "Post" | "Lean To"
        liftType,
        liftCategory: selectedCat.category,
        weightRange: selectedCat.weightRange,
        vehicleSalePrice: selectedCat.salePrice,
        retailPrice: selectedCat.retailPrice + addonFee,
      });
      onNext();
    }
  };

  const calculatedPrice = selectedCat
    ? selectedPlanId === "maintenance"
      ? 3000
      : selectedCat.retailPrice === "Custom Quote"
        ? "Custom Quote"
        : selectedCat.retailPrice +
          (selectedPlanId === "service_contract" && coverage === "Platinum"
            ? 500
            : 0)
    : 0;

  const isUsed = vehicleStatus === "USED";
  const finalCalculatedPrice = calculatedPrice;

  // Mapping options for our CustomDropdown
  const liftTypeOptions = Object.keys(liftData).map((type) => {
    let subtext = "";
    if (type === "Four-Post / Multi-Post Lift") {
      subtext = "Standard multi-post or marine frame";
    } else if (type === "Elevator Lift") {
      subtext = "Side-mounted vertical marine platform";
    } else if (type === "No-Profile Hydraulic Platform Lift") {
      subtext = "Flush ground-level hydraulic platform system";
    }
    return {
      value: type,
      label: type,
      subtext,
    };
  });

  const liftCategoryOptions = selectedCategories.map((c, idx) => ({
    value: idx.toString(),
    label: c.category,
    subtext: `Weight Range: ${c.weightRange}`,
  }));

  return (
    <div className="animate-in fade-in duration-300 flex flex-col">
      {/* Scrollable Content Body */}
      <div className="p-3 md:p-5 lg:p-10 space-y-8">
        {/* Info Alert Banner inside matching gray panel */}
        <div className="bg-slate-50/50 border border-slate-200/65 rounded-2xl px-5 py-4 shadow-sm animate-in fade-in duration-300">
          <p className="text-slate-800 text-xs sm:text-sm leading-relaxed">
            Select the product and lift details below. Pricing will
            auto-populate based on your selections — no manual entry required.
          </p>
        </div>

        {/* PRODUCT SELECTION inside matching gray panel */}
        <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-slate-50/50 p-6 rounded-2xl border border-slate-200/60 space-y-4 shadow-sm">
          <h5 className="font-bold text-slate-600 text-sm uppercase tracking-wider border-b border-slate-200/60 pb-2">
            Product Selection
          </h5>
          <label className="block text-sm font-bold text-slate-800">
            Product type <span className="text-red-500">*</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: Maintenance (PMP) */}
            <button
              type="button"
              onClick={() => handlePlanSelect("maintenance")}
              className={`py-6 px-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center ${
                selectedPlanId === "maintenance"
                  ? "border-[#2f4269] bg-[#2f4269] text-white scale-[1.01] shadow-md"
                  : "bg-white border-slate-300 text-slate-800 hover:border-slate-400 hover:shadow-xs"
              }`}
            >
              <span className="text-lg md:text-2xl font-bold uppercase tracking-tight">
                Maintenance Program
              </span>
              <span
                className={`text-sm mt-1 leading-normal ${
                  selectedPlanId === "maintenance"
                    ? "text-slate-200"
                    : "text-slate-500"
                }`}
              >
                Prepaid scheduled maintenance
              </span>
              <div className="mt-3 flex flex-col items-center">
                <span
                  className={`text-2xl font-extrabold ${selectedPlanId === "maintenance" ? "text-white" : "text-slate-900"}`}
                >
                  $3,000
                </span>
                <span
                  className={`text-sm mt-0.5 ${
                    selectedPlanId === "maintenance"
                      ? "text-slate-300"
                      : "text-slate-500"
                  }`}
                >
                  flat fee · 36 months
                </span>
              </div>
            </button>

            {/* Card 2: Service Contract (ESC) */}
            <button
              type="button"
              onClick={() => handlePlanSelect("service_contract")}
              className={`py-6 px-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center ${
                selectedPlanId === "service_contract"
                  ? "border-[#2f4269] bg-[#2f4269] text-white scale-[1.01] shadow-md"
                  : "bg-white border-slate-300 text-slate-800 hover:border-slate-400 hover:shadow-xs"
              }`}
            >
              <span className="text-lg md:text-2xl font-bold uppercase tracking-tight">
                Service Contract
              </span>
              <span
                className={`text-sm mt-1 leading-normal ${
                  selectedPlanId === "service_contract"
                    ? "text-slate-200"
                    : "text-slate-500"
                }`}
              >
                Component failure protection
              </span>
              <div className="mt-3 flex flex-col items-center">
                <span
                  className={`text-2xl font-extrabold ${selectedPlanId === "service_contract" ? "text-white" : "text-slate-900"}`}
                >
                  Price Varies
                </span>
                <span
                  className={`text-sm mt-0.5 ${
                    selectedPlanId === "service_contract"
                      ? "text-slate-300"
                      : "text-slate-500"
                  }`}
                >
                  by lift size · 60 months
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Lift Status Selection */}
        {selectedPlanId && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-slate-50/50 p-6 rounded-2xl border border-slate-200/60 space-y-4 shadow-sm">
            <h5 className="font-bold text-slate-600 text-sm uppercase tracking-wider border-b border-slate-200/60 pb-2">
              Lift Status
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {["NEW", "USED"].map((status) => {
                const isActive = vehicleStatus === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setVehicleStatus(status)}
                    className={`py-5 px-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center ${
                      isActive
                        ? status === "NEW"
                          ? "border-emerald-800 bg-emerald-700 text-white scale-[1.01] shadow-md"
                          : "border-amber-800 bg-amber-700 text-white scale-[1.01] shadow-md"
                        : "bg-white border-slate-300 text-slate-800 hover:border-slate-400 hover:shadow-xs"
                    }`}
                  >
                    <span className="text-xl font-bold tracking-tight uppercase">
                      {status === "NEW" ? "New Lift" : "Used Lift"}
                    </span>
                    <span
                      className={`text-sm mt-1 leading-normal ${
                        isActive ? "text-slate-200" : "text-slate-500"
                      }`}
                    >
                      {status === "NEW"
                        ? "Factory direct status"
                        : "Requires BLP inspection"}
                    </span>
                  </button>
                );
              })}
            </div>
            {vehicleStatus === "USED" && (
              <div className="flex items-start gap-3 p-4 bg-amber-50/80 border border-amber-200/70 rounded-xl text-sm shadow-inner animate-in slide-in-from-top-2">
                <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
                <div className="text-amber-950 text-sm leading-relaxed">
                  This service contract is only available for lifts that have
                  passed a 60-point pre-qualification inspection. You will
                  confirm the inspection outcome on the next step before
                  proceeding.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Coverage options */}
        {selectedPlanId && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-slate-50/50 p-6 rounded-2xl border border-slate-200/60 space-y-6 shadow-sm">
            <h5 className="font-bold text-slate-600 text-sm uppercase tracking-wider border-b border-slate-200/60 pb-2">
              Coverage Options
            </h5>

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
              <div className="space-y-6">
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
              </div>
            )}
          </div>
        )}

        {/* LIFT DETAILS */}
        {(selectedPlanId === "service_contract" ||
          selectedPlanId === "maintenance") && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-slate-50/50 p-6 rounded-2xl border border-slate-200/60 space-y-6 shadow-sm">
            <div className="font-bold text-slate-600 text-sm uppercase tracking-wider border-b border-slate-200/60 pb-2">
              LIFT DETAILS
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <CustomDropdown
                  label="Lift type"
                  value={liftType}
                  onChange={(val) => {
                    setLiftType(val);
                    setLiftCategoryIndex("");
                  }}
                  options={liftTypeOptions}
                  placeholder="-- Choose Lift Type --"
                  required
                />
              </div>

              <div>
                <CustomDropdown
                  label="Lift category"
                  value={liftCategoryIndex}
                  onChange={setLiftCategoryIndex}
                  options={liftCategoryOptions}
                  placeholder="-- Choose Category --"
                  disabled={!liftType}
                  required
                />
              </div>
            </div>

            <p className="text-sm text-slate-700 mt-1">
              Category determines the contract price based on lift weight
              capacity.
            </p>

            {/* Pricing Confirmed Banner Card */}
            {selectedCat && !isCustomQuote && (
              <div className="animate-in zoom-in-95 duration-200 bg-[#E3F9E9] border-2 border-[#A3E5B7] p-5 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-[#0A5C28] text-sm">
                  <CheckCircle2 className="w-4.5 h-4.5" />
                  Pricing confirmed — values auto-populated
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Contract Price white card */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-xs">
                    <div>
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        CONTRACT PRICE
                      </span>
                      <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                        ${finalCalculatedPrice.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-600 font-bold block mt-0.5">
                        charged to customer
                      </span>
                    </div>
                    <div className="mt-3">
                      <span className="inline-block bg-brand-50 border border-brand-200 text-brand-700 font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                        RetailPrice → API
                      </span>
                    </div>
                  </div>

                  {/* Lift Value midpoint white card */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-xs">
                    <div>
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        LIFT VALUE (MIDPOINT)
                      </span>
                      <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                        ${selectedCat.salePrice.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-600 font-bold block mt-0.5">
                        estimated lift value
                      </span>
                    </div>
                    <div className="mt-3">
                      <span className="inline-block bg-brand-50 border border-brand-200 text-brand-700 font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                        VehicleSalePrice → API
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Quote Box */}
            {isCustomQuote && (
              <div className="animate-in border-2 border-amber-200 bg-amber-50/50 p-5 rounded-2xl flex gap-4 items-start shadow-sm">
                <div className="bg-amber-100 p-2.5 rounded-xl text-amber-700 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h6 className="font-bold text-amber-900 text-[15px] mb-1">
                    Custom Quote Required
                  </h6>
                  <p className="text-amber-950 text-sm leading-relaxed mb-3 font-bold">
                    Elevator lifts exceeding 54,000 lb capacity are outside
                    standard automated rating scopes. Please record customer
                    details and contact support for manual processing.
                  </p>
                  <a
                    href="mailto:support@boatliftprotection.example.com?subject=Custom%20Quote%20Request%20-%20Elevator%20Category%205"
                    className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow-md"
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

      {/* Footer Navigation Bar */}
      <div className="p-6 bg-slate-50 border-t border-slate-200/80 flex items-center justify-end rounded-b-[22px]">
        <button
          type="button"
          onClick={handleContinue}
          disabled={isContinueDisabled}
          className={`rounded-xl px-6 py-3 text-sm transition-all shadow-sm hover:shadow-md ${
            !isContinueDisabled
              ? "bg-[#2f4269] text-white hover:bg-brand-600 cursor-pointer"
              : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
          }`}
        >
          {isCustomQuote
            ? "Manual Action Required"
            : "Continue to customer details"}
        </button>
      </div>
    </div>
  );
};

export default ServiceSelection;
