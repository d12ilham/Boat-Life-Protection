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
          // VehicleSalePrice for Maintenance = comes from lift dropdown (stored in servicePlan.vehicleSalePrice)
          // but if there was no lift selection (PMP has no mandatory lift dropdown), default to 0
          // RetailPrice for Maintenance is always 3000 (flat)
          const vehicleSalePrice =
            servicePlan.id === "maintenance"
              ? parseFloat(servicePlan.vehicleSalePrice || 0) // populated if liftType was also chosen
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
            VehicleStatus: servicePlan.vehicleStatus || "NEW", // MUST be NEW or USED
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
          // Non-fatal â€” we still proceed to contract review with legacy mock
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
    <div className="animate-in fade-in duration-500 max-h-[85vh] overflow-y-auto pr-2">
      {/* Header */}
      <div className="flex items-center gap-3 bg-brand-500/10 px-6 sm:px-10 py-4 border-b border-brand-500/10">
        <h3 className="text-lg font-semibold text-brand-500 tracking-tight">
          Contract Details
        </h3>
        <span className="text-xs border border-brand-500/20 text-brand-500 px-3 py-1 bg-white rounded-full font-semibold shadow-sm">
          {servicePlan?.name} &bull; {servicePlan?.vehicleStatus}
          {servicePlan?.coverage && <> &bull; {servicePlan.coverage}</>}
        </span>
      </div>

      {/* Used Lift Inspection Gate */}
      {isUsed && (
        <div className="mx-6 sm:mx-10 mt-6 rounded-2xl border overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 bg-amber-50 border-b border-amber-200">
            <div className="bg-amber-100 p-2 rounded-lg text-amber-600 flex-shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 text-sm">
                60-Point Inspection Required â€” Used Lift
              </h4>
              <p className="text-amber-700 text-xs mt-0.5">
                A $400 inspection fee applies. If the lift passes, the $400 is
                applied toward the contract price. If it fails, remediation work
                is required before the contract can be issued.
              </p>
            </div>
          </div>

          <div className="bg-white px-5 py-5">
            <p className="text-sm font-semibold text-slate-700 mb-3">
              Confirm inspection result to unlock contract submission:
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleInspectionSet("PASS")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-all duration-150 ${
                  inspectionResult === "PASS"
                    ? "bg-emerald-500 border-emerald-500 text-white shadow-md"
                    : "bg-white border-slate-300 text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                Inspection PASSED â€” Proceed
              </button>
              <button
                type="button"
                onClick={() => handleInspectionSet("FAIL")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-all duration-150 ${
                  inspectionResult === "FAIL"
                    ? "bg-red-500 border-red-500 text-white shadow-md"
                    : "bg-white border-slate-300 text-slate-600 hover:border-red-300 hover:text-red-600"
                }`}
              >
                <XCircle className="w-4 h-4" />
                Inspection FAILED
              </button>
            </div>

            {inspectionResult === "PASS" && (
              <div className="mt-3 flex items-center gap-2 text-emerald-700 text-xs font-semibold bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
                Inspection confirmed passed. The $400 fee will be applied toward
                the contract. Submission unlocked.
              </div>
            )}
            {inspectionResult === "FAIL" && (
              <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
                <p className="font-bold text-red-800 mb-1">
                  Lift failed inspection
                </p>
                <p className="text-red-700 text-xs">
                  The customer may opt for service/remediation work (additional
                  charge). Once BLP signs off on completion, return to this
                  screen, mark as PASSED, and proceed with the contract.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-6 sm:p-10">
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-semibold flex items-center gap-3">
            <span className="text-lg">âš </span> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Technician Info */}
          <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200/60">
            <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-wide">
              <span className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg">
                <BadgeCheck className="w-4 h-4" />
              </span>
              Service Technician
            </h4>
            <div className="grid grid-cols-1 gap-6 items-center">
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
              <p className="text-xs text-slate-500 font-medium">
                Please enter your full name since this is a shared shop portal
                login.
              </p>
            </div>
          </div>

          {/* Two-Column Form */}
          <div className="grid grid-cols-1 gap-8">
            {/* Column 1: Customer */}
            <div className="space-y-6">
              <h4 className="text-md font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                <span className="bg-sky-100 text-sky-600 p-1.5 rounded-lg">
                  <User className="w-4 h-4" />
                </span>
                Customer Information
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    State <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="state"
                    required
                    className="input-field uppercase"
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
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
            <div className="space-y-6">
              <h4 className="text-md font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg">
                  <Anchor className="w-4 h-4" />
                </span>
                Lift &amp; Equipment Specifications
              </h4>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Date of Sale <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="date_of_sale"
                    required
                    className="input-field"
                    value={formData.date_of_sale}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    In-Service Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="in_service_date"
                    required
                    className="input-field"
                    value={formData.in_service_date}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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

              {/* Fixed / Auto-Populated Parameters */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-[11px] text-slate-400 font-semibold space-y-1">
                <div className="text-slate-500 uppercase tracking-wider font-bold mb-1 border-b pb-1">
                  Auto-Populated API Parameters
                </div>
                <div>
                  VehicleStatus:{" "}
                  <strong className="text-slate-600">
                    {servicePlan?.vehicleStatus || "NEW"}
                  </strong>
                </div>
                <div>
                  Odometer Reading:{" "}
                  <strong className="text-slate-600">0</strong> &bull; Type:{" "}
                  <strong className="text-slate-600">no</strong>
                </div>
                <div>
                  Term Miles Cap:{" "}
                  <strong className="text-slate-600">999,999</strong>
                </div>
                <div>
                  Deductible: <strong className="text-slate-600">$0</strong>
                </div>
                <div>
                  Coverage:{" "}
                  <strong className="text-slate-600">
                    {servicePlan?.coverage || "â€”"}
                  </strong>
                  {servicePlan?.contractType && (
                    <>
                      {" "}
                      &bull; Contract Type:{" "}
                      <strong className="text-slate-600">
                        {servicePlan.contractType}
                      </strong>
                    </>
                  )}
                </div>
                <div>
                  Surcharges / ReqFields:{" "}
                  <strong className="text-slate-600">[] (empty)</strong>
                </div>
                <div className="pt-1 border-t mt-1 text-slate-400 italic">
                  Lienholder, AmountFinanced, APR, EngineSize â€” omitted (not
                  applicable to lifts)
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-8 border-t border-slate-100 flex flex-col items-center text-center bg-slate-50/30 -mx-6 sm:-mx-10 -mb-6 sm:-mb-10 mt-10">
            {submitBlocked && (
              <div className="mb-4 flex items-center gap-2 text-amber-700 text-sm font-semibold bg-amber-50 border border-amber-200 px-5 py-3 rounded-xl">
                <AlertTriangle className="w-4 h-4" />
                Confirm the 60-point inspection result above to unlock
                submission.
              </div>
            )}
            <p className="text-sm font-medium text-slate-500 mb-6">
              You can review the digitally generated service agreement on the
              next step.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mb-5">
              <button
                type="button"
                onClick={() => {
                  setCustomer({ ...customer, ...formData });
                  setTechnicianName(techName);
                  onBack();
                }}
                className="border border-brand-500 text-brand-600 hover:bg-brand-50 bg-white rounded-full px-8 py-3.5 text-sm transition-colors w-full sm:w-auto min-w-[200px] font-semibold"
              >
                Go Back
              </button>
              <button
                type="submit"
                disabled={loading || submitBlocked}
                className={`rounded-full border border-accent-500 px-8 py-3.5 text-sm transition-colors w-full sm:w-auto min-w-[200px] font-semibold tracking-wide ${
                  !loading && !submitBlocked
                    ? "bg-accent-500 text-white hover:bg-accent-600 shadow-md"
                    : "bg-slate-200 border-transparent text-slate-400 cursor-not-allowed"
                }`}
              >
                {loading
                  ? "Processingâ€¦"
                  : submitBlocked
                    ? "Inspection Required"
                    : "Continue to Review"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerForm;

