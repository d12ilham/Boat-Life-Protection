import React, { useState } from "react";
import { useFlow } from "../context/FlowContext";
import { useAuth, apiClient } from "../context/AuthContext";
import {
  User,
  Phone,
  Mail,
  MapPin,
  BadgeCheck,
  Anchor,
  Settings2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ClipboardList,
  ChevronDown,
} from "lucide-react";

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
];

const CustomerForm = ({ onNext, onBack }) => {
  const {
    servicePlan,
    customer,
    setCustomer,
    technicianName,
    setTechnicianName,
    setContractId,
    setGaltPdf,
    setGaltContractNo,
    setGaltApplicationId,
    setGaltDealerCost,
    inspectionPassed,
    setInspectionPassed,
  } = useFlow();

  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isUsed = servicePlan?.vehicleStatus === "USED";

  // Inspection flow state (only relevant when isUsed)
  const [inspectionResult, setInspectionResult] = useState(
    inspectionPassed ? "PASS" : "",
  );
  const [showInspectionConfirm, setShowInspectionConfirm] = useState(false);

  const [formData, setFormData] = useState({
    first_name: customer?.first_name || "",
    last_name: customer?.last_name || "",
    middle_initial: customer?.middle_initial || "",
    suffix: customer?.suffix || "",
    home_phone: customer?.home_phone || customer?.phone || "",
    business_phone: customer?.business_phone || "",
    street_address: customer?.street_address || customer?.address || "",
    city: customer?.city || "",
    state: customer?.state || "",
    zip_code: customer?.zip_code || "",
    email: customer?.email || "",
    // Lift specifications
    serial_number: customer?.serial_number || "",
    year: customer?.year || "",
    make: customer?.make || "",
    model: customer?.model || "",
    date_of_sale: customer?.date_of_sale || "",
    in_service_date: customer?.in_service_date || "",
    mnf_warranty_length: customer?.mnf_warranty_length || "12",
  });

  const [techName, setTechName] = useState(technicianName || "");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleInspectionSet = (result) => {
    setInspectionResult(result);
    if (result === "PASS") {
      setInspectionPassed(true);
    } else {
      setInspectionPassed(false);
    }
  };

  // Determine if the submit should be blocked (used lift not inspected)
  const submitBlocked = isUsed && !inspectionPassed;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitBlocked) return;
    setLoading(true);
    setErrorMsg("");

    try {
      // 1. Save customer + contract locally
      const response = await apiClient.post("/customer-init", {
        technician_id: user?.id,
        technician_name: techName,
        customer: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          middle_initial: formData.middle_initial,
          suffix: formData.suffix,
          home_phone: formData.home_phone,
          business_phone: formData.business_phone,
          street_address: formData.street_address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
          email: formData.email,
        },
        contract: {
          service_plan: servicePlan.name,
          amount:
            servicePlan.price === "Custom Quote"
              ? 0
              : servicePlan.price - (isUsed ? 400 : 0),
          serial_number: formData.serial_number,
          year: formData.year ? parseInt(formData.year) : null,
          make: formData.make,
          model: formData.model,
          lift_type: servicePlan.liftType,
          lift_category: servicePlan.liftCategory,
          date_of_sale: formData.date_of_sale || null,
          in_service_date: formData.in_service_date || null,
          mnf_warranty_length: formData.mnf_warranty_length
            ? parseInt(formData.mnf_warranty_length)
            : 12,
          vehicle_sale_price: servicePlan.vehicleSalePrice
            ? parseFloat(servicePlan.vehicleSalePrice)
            : 0.0,
          retail_price:
            servicePlan.price === "Custom Quote"
              ? 0
              : parseFloat(servicePlan.price || 0),
          vehicle_status: servicePlan.vehicleStatus || "NEW",
        },
      });

      // Reset GALT state
      setGaltPdf(null);
      setGaltContractNo("");
      setGaltApplicationId(null);
      setGaltDealerCost(null);

      // 2. Submit to GALT via two-step orchestrated endpoint
      const isCustomQuote = servicePlan.price === "Custom Quote";
      if (!isCustomQuote) {
        try {
          const vehicleSalePrice =
            servicePlan.id === "maintenance"
              ? parseFloat(servicePlan.vehicleSalePrice || 0)
              : parseFloat(servicePlan.vehicleSalePrice || 0);
          const retailPrice =
            servicePlan.id === "maintenance"
              ? 3000.0
              : parseFloat(servicePlan.retailPrice || 0);

          const galtResponse = await apiClient.post("/galt/submit", {
            contractId: response.data.contract_id,
            // Technician
            FIManager: techName || user?.username || "N/A",

            // Customer
            FirstName: formData.first_name,
            LastName: formData.last_name,
            MiddleInitial: formData.middle_initial || "",
            Suffix: formData.suffix || "",
            HomePhoneNo: formData.home_phone,
            BusinessPhoneNo: formData.business_phone || "",
            Address1: formData.street_address,
            City: formData.city,
            State: formData.state,
            ZipCode: formData.zip_code,
            Email: formData.email || "",

            // Lift (VIN = serial number, not a vehicle VIN)
            VIN: formData.serial_number,
            VehicleStatus: servicePlan.vehicleStatus || "NEW",
            Year: formData.year ? parseInt(formData.year) : null,
            Make: formData.make,
            Model: formData.model,
            DateOfSale: formData.date_of_sale || null,
            InServiceDate: formData.in_service_date || null,
            VehicleSalePrice: vehicleSalePrice,
            MnfWarrantyLength: formData.mnf_warranty_length
              ? parseInt(formData.mnf_warranty_length)
              : 12,

            // Product selection (backend uses this to call Rate API)
            ProductType: servicePlan.id,
            Coverage: servicePlan.coverage,
            ContractType: servicePlan.contractType || null,
            RetailPrice: retailPrice,
          });

          const galtData = galtResponse.data;
          if (galtData?.App?.ApplicationID || galtData?.ApplicationID) {
            const app = galtData.App || galtData;
            setGaltPdf(app.PDF || galtData.PDF || null);
            setGaltContractNo(app.ContractNo || galtData.ContractNo || "");
            setGaltApplicationId(
              app.ApplicationID || galtData.ApplicationID || null,
            );
            setGaltDealerCost(galtData._rateUsed?.DealerCost || null);
          } else if (galtData?.Result === "SUCCESS") {
            setGaltPdf(galtData.PDF || null);
            setGaltContractNo(galtData.ContractNo || "");
            setGaltApplicationId(galtData.ApplicationID || null);
          } else {
            console.warn(
              "[GALT] Non-success or unexpected response:",
              galtData,
            );
          }
        } catch (galtErr) {
          console.error(
            "[GALT] Error submitting to GALT /galt/submit:",
            galtErr,
          );
          // Non-fatal — we still proceed to contract review with legacy mock
        }
      }

      setCustomer({ ...formData, id: response.data.customer_id });
      setTechnicianName(techName);
      setContractId(response.data.contract_id);
      onNext();
    } catch (err) {
      console.error(err);
      setErrorMsg(
        err.response?.data?.message ||
          "Failed to initialize contract. Please verify your connection.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* Scrollable Content Body */}
        <div className="p-6 sm:p-10 space-y-8 ">
          {errorMsg && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-semibold flex items-center gap-3">
              <span className="text-lg">⚠</span> {errorMsg}
            </div>
          )}

          {/* Used Lift Inspection Gate */}
          {isUsed && (
            <div className="rounded-2xl border-2 border-amber-200 overflow-hidden shadow-xs">
              <div className="flex items-center gap-3 px-5 py-4 bg-amber-50 border-b border-amber-200">
                <div className="bg-amber-100 p-2 rounded-lg text-amber-600 flex-shrink-0">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-900 text-sm">
                    60-Point Inspection Required — Used Lift
                  </h4>
                  <p className="text-amber-700 text-xs mt-0.5 font-semibold">
                    A $400 inspection fee applies. If the lift passes, the $400
                    is applied toward the contract price. If it fails,
                    remediation work is required before the contract can be
                    issued.
                  </p>
                </div>
              </div>

              <div className="bg-white px-5 py-5 space-y-3">
                <p className="text-xs sm:text-sm font-bold text-slate-700">
                  Confirm inspection result to unlock contract submission:
                </p>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => handleInspectionSet("PASS")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-all duration-150 ${
                      inspectionResult === "PASS"
                        ? "bg-emerald-500 border-emerald-500 text-white shadow-sm scale-[1.01]"
                        : "bg-white border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Inspection PASSED
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInspectionSet("FAIL")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-all duration-150 ${
                      inspectionResult === "FAIL"
                        ? "bg-red-500 border-red-500 text-white shadow-sm scale-[1.01]"
                        : "bg-white border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    Inspection FAILED
                  </button>
                </div>

                {inspectionResult === "PASS" && (
                  <div className="mt-3 flex items-center gap-2 text-[#0A5C28] text-xs font-semibold bg-[#E3F9E9] border border-[#A3E5B7] px-4 py-2.5 rounded-lg shadow-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    Inspection confirmed passed. The $400 fee will be applied
                    toward the contract. Submission unlocked.
                  </div>
                )}
                {inspectionResult === "FAIL" && (
                  <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold leading-relaxed">
                    <p className="font-bold text-red-800 mb-1">
                      Lift failed inspection
                    </p>
                    <p className="text-red-700">
                      The customer may opt for service/remediation work
                      (additional charge). Once BLP signs off on completion,
                      return to this screen, mark as PASSED, and proceed with
                      the contract.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Technician Info */}
          <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200/60 space-y-4 shadow-sm">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider border-b border-slate-200/60 pb-2">
              <span className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg">
                <BadgeCheck className="w-4 h-4" />
              </span>
              Service Technician
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Technician On-Site Name{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    className="input-field pl-11"
                    placeholder="e.g. Mike Smith"
                    value={techName}
                    onChange={(e) => setTechName(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Please enter your full name since this is a shared shop portal
                login. This will be stamped on the official contract submission.
              </p>
            </div>
          </div>

          {/* Customer & Equipment specs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Column 1: Customer */}
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200/60 space-y-5 shadow-sm">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider border-b border-slate-200/60 pb-2">
                <span className="bg-sky-100 text-sky-600 p-1.5 rounded-lg">
                  <User className="w-4 h-4" />
                </span>
                Customer Information
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    required
                    className="input-field"
                    placeholder="John"
                    value={formData.first_name}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    required
                    className="input-field"
                    placeholder="Doe"
                    value={formData.last_name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Middle Initial
                  </label>
                  <input
                    type="text"
                    name="middle_initial"
                    maxLength={1}
                    className="input-field"
                    placeholder="A"
                    value={formData.middle_initial}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Suffix
                  </label>
                  <input
                    type="text"
                    name="suffix"
                    className="input-field"
                    placeholder="Jr."
                    value={formData.suffix}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    className="input-field pl-11"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Home Phone <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="tel"
                      name="home_phone"
                      required
                      className="input-field pl-11"
                      placeholder="(555) 123-4567"
                      value={formData.home_phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Business Phone
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="tel"
                      name="business_phone"
                      className="input-field pl-11"
                      placeholder="(555) 987-6543"
                      value={formData.business_phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Street Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <MapPin className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    name="street_address"
                    required
                    className="input-field pl-11"
                    placeholder="123 Marina Way"
                    value={formData.street_address}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    required
                    className="input-field"
                    placeholder="Waterfront City"
                    value={formData.city}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    State <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      name="state"
                      required
                      className="input-field pl-4 pr-10 appearance-none bg-white cursor-pointer"
                      value={formData.state}
                      onChange={handleChange}
                    >
                      <option value="">--</option>
                      {US_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Zip Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="zip_code"
                  required
                  className="input-field"
                  placeholder="33400"
                  value={formData.zip_code}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Column 2: Lift Specs */}
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200/60 space-y-5 shadow-sm">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider border-b border-slate-200/60 pb-2">
                <span className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg">
                  <Anchor className="w-4 h-4" />
                </span>
                Lift Specifications
              </h4>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Serial Number (VIN / SN){" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Settings2 className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    name="serial_number"
                    required
                    className="input-field pl-11 uppercase"
                    placeholder="Enter Serial Number"
                    value={formData.serial_number}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Year <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="year"
                    required
                    className="input-field"
                    placeholder="2024"
                    value={formData.year}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Make <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="make"
                    required
                    className="input-field"
                    placeholder="e.g. ShoreStation"
                    value={formData.make}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Model <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="model"
                  required
                  className="input-field"
                  placeholder="e.g. Four-Post Max 8000"
                  value={formData.model}
                  onChange={handleChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Date of Sale <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="date_of_sale"
                    required
                    className="input-field px-4"
                    value={formData.date_of_sale}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    In-Service Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="in_service_date"
                    required
                    className="input-field px-4"
                    value={formData.in_service_date}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Manufacturer Warranty Length (Months){" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="mnf_warranty_length"
                  required
                  min={0}
                  className="input-field"
                  placeholder="e.g. 12"
                  value={formData.mnf_warranty_length}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div className="p-6 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-[22px]">
          {submitBlocked ? (
            <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl shadow-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Confirm 60-point inspection above to unlock submission.
            </div>
          ) : (
            <div className="text-xs text-slate-400 font-semibold leading-relaxed">
              Confirm all details. Continuing will generate the official digital
              GALT contract.
            </div>
          )}

          <div className="flex items-center gap-4 shrink-0 self-stretch sm:self-auto justify-between sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setCustomer({ ...customer, ...formData });
                setTechnicianName(techName);
                onBack();
              }}
              className="border border-slate-200 text-slate-600 hover:bg-slate-100/60 bg-white rounded-xl px-6 py-3 text-xs sm:text-sm transition-all font-bold shadow-sm"
            >
              Go back
            </button>

            <button
              type="submit"
              disabled={loading || submitBlocked}
              className={`rounded-xl px-6 py-3 text-xs sm:text-sm font-bold transition-all shadow-sm hover:shadow-md ${
                !loading && !submitBlocked
                  ? "bg-[#2f4269] text-white hover:bg-brand-600 cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
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
                  Generating GALT contract...
                </span>
              ) : submitBlocked ? (
                "Inspection Required"
              ) : (
                "Continue to contract review"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CustomerForm;
