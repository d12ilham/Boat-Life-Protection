import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useFlow } from "../context/FlowContext";
import Login from "../components/Login";
import ServiceSelection from "../components/ServiceSelection";
import CustomerForm from "../components/CustomerForm";
import ContractReview from "../components/ContractReview";
import Payment from "../components/Payment";

const STEP_LOGIN = 1;
const STEP_START = 2; // First real step after login

const Wizard = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { technicianName } = useFlow();
  const [step, setStep] = useState(isAuthenticated ? STEP_START : STEP_LOGIN);

  // When auth status changes (e.g. token refreshed on load), jump to step 2
  useEffect(() => {
    if (!isLoading) {
      setStep(isAuthenticated ? STEP_START : STEP_LOGIN);
    }
  }, [isAuthenticated, isLoading]);

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <svg
          className="animate-spin h-8 w-8 text-brand-500"
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
        <p className="text-sm text-slate-400">Verifying session…</p>
      </div>
    );
  }

  const getStepContent = () => {
    switch (step) {
      case 1:
        return <Login onSuccess={() => setStep(STEP_START)} />;
      case 2:
        return <ServiceSelection onNext={nextStep} />;
      case 3:
        return <CustomerForm onNext={nextStep} onBack={prevStep} />;
      case 4:
        return <ContractReview onNext={nextStep} onBack={prevStep} />;
      case 5:
        return <Payment onBack={prevStep} />;
      default:
        return <Login onSuccess={() => setStep(STEP_START)} />;
    }
  };

  if (step === 1) {
    return (
      <div className="w-full flex-1 max-w-md mx-auto flex flex-col justify-center py-8">
        <div className="card">{getStepContent()}</div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col justify-start py-4">
      {/* Subtitles above the card */}
      <div className="text-center mb-8 flex flex-col items-center">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-brand-50 border border-brand-200 text-brand-700 font-bold text-[10px] tracking-wider uppercase rounded-full mb-3 shadow-xs select-none">
          ⚓ Technician Field Portal
        </span>
        <h1 className="text-2xl sm:text-4xl font-bold text-[#2F4269] tracking-tight force-bold">
          Service Contract — Lift Selection Flow
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-2">
          Step {step - 1} of the technician portal: plan selection and checkout
        </p>
      </div>

      {/* Unified Frame Portal Card */}
      <div className="w-full max-w-5xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-xl relative z-0 flex flex-col animate-in zoom-in-98 duration-400">
        {/* Navy Header Block */}
        <div className="bg-[#2F4269] px-6 sm:px-10 py-6 flex items-center justify-center rounded-t-[22px]">
          <div className="flex items-center gap-4">
            <h2 className="text-white text-base sm:text-lg tracking-tight leading-tight font-semibold">
              Boat Lift Protection — Field Portal
            </h2>
          </div>
        </div>

        {/* Steps Navigation Bar */}
        <div className="bg-slate-50/50 border-b border-slate-200/80 px-6 py-4 flex overflow-x-auto scrollbar-none gap-3 sm:gap-4 justify-center items-center select-none">
          {[
            { num: 1, title: "Service Plan", emoji: "🔧" },
            { num: 2, title: "Customer Details", emoji: "👤" },
            { num: 3, title: "Contract Review", emoji: "📄" },
            { num: 4, title: "Secure Payment", emoji: "💳" },
          ].map((s) => {
            const currentStepNum = step - 1; // step 2 = 1, step 3 = 2, step 4 = 3, step 5 = 4
            const isActive = currentStepNum === s.num;
            const isCompleted = currentStepNum > s.num;

            return (
              <div
                key={s.num}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all duration-200 relative whitespace-nowrap text-xs sm:text-sm font-semibold tracking-tight shadow-xs ${
                  isActive
                    ? "bg-brand-50 border-brand-500 text-brand-900 scale-102 ring-4 ring-brand-500/5"
                    : isCompleted
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-white border-slate-200 text-slate-400"
                }`}
              >
                <span className="text-sm">{isCompleted ? "✓" : s.emoji}</span>
                <span className={isActive ? "font-bold text-brand-900" : ""}>
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Page Content Area */}
        <div className="flex-1">{getStepContent()}</div>
      </div>
    </div>
  );
};

export default Wizard;
