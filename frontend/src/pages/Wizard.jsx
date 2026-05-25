import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import Login from "../components/Login";
import ServiceSelection from "../components/ServiceSelection";
import CustomerForm from "../components/CustomerForm";
import ContractReview from "../components/ContractReview";
import Payment from "../components/Payment";

const STEP_LOGIN = 1;
const STEP_START = 2; // First real step after login

const Wizard = () => {
  const { isAuthenticated, isLoading } = useAuth();
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
    <div className="w-full flex-1 flex flex-col justify-start">
      {/* Step progress indicator (attached near the header) */}
      {isAuthenticated && step > 1 && step <= 5 && (
        <div className="w-full max-w-5xl mx-auto bg-white bg-opacity-90 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row items-center justify-center overflow-x-auto gap-4 sm:gap-8 rounded-xl !mb-0 z-10 transition-all">
          <div className="flex items-center">
            {[
              {
                num: 1,
                title: "Service Plan",
                subtitle: "Select protection tier",
              },
              {
                num: 2,
                title: "Customer Details",
                subtitle: "Property & Contact info",
              },
              {
                num: 3,
                title: "Contract Review",
                subtitle: "Digital signature",
              },
              { num: 4, title: "Secure Payment", subtitle: "Finalize order" },
            ].map((s, index, arr) => {
              const currentStepNum = step - 1;
              const isComplete = currentStepNum > s.num;
              const isCurrent = currentStepNum === s.num;

              return (
                <React.Fragment key={s.num}>
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                        isComplete || isCurrent
                          ? "bg-brand-500 text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {isComplete ? (
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        s.num
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span
                        className={`text-sm font-semibold tracking-tight ${isComplete || isCurrent ? "text-[#111111]" : "text-slate-500"}`}
                      >
                        {s.title}
                      </span>
                    </div>
                  </div>
                  {index < arr.length - 1 && (
                    <div className="mx-4 sm:mx-6 w-8 sm:w-12 border-t-2 border-dashed border-slate-300"></div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center items-center py-8">
        <div className="card w-full max-w-5xl relative z-0">
          {getStepContent()}
        </div>
      </div>
    </div>
  );
};

export default Wizard;
