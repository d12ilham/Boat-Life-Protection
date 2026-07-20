import { AlertTriangle } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { useFlow } from "../context/FlowContext";
import { apiClient } from "../context/AuthContext";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const CheckoutForm = ({ contract_id }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-status/${contract_id}`,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
    } else {
      console.log("[Payment] Confirm Payment succeeded / redirecting...");
      setErrorMessage(
        "Payment requires further action or is still processing.",
      );
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <PaymentElement />
      </div>
      {errorMessage && (
        <div className="text-red-700 text-sm font-semibold p-4 bg-red-50 rounded-xl border border-red-200">
          {errorMessage}
        </div>
      )}
      <button
        disabled={!stripe || loading}
        className={`w-full rounded-xl border px-8 py-3.5 text-sm transition-all shadow-sm hover:shadow-md font-bold ${
          !stripe || loading
            ? "bg-slate-200 border-transparent text-slate-400 cursor-not-allowed shadow-none"
            : "bg-[#2f4269] border-[#2f4269] text-white hover:bg-brand-600 cursor-pointer"
        }`}
      >
        {loading ? "Processing Payment..." : "Direct Secure Payment"}
      </button>
    </form>
  );
};

const Payment = ({ onNext, onBack }) => {
  const { contractId, servicePlan } = useFlow();
  const [clientSecret, setClientSecret] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [stripePromise, setStripePromise] = useState(() => {
    const defaultKey = import.meta.env.VITE_STRIPE_PUB_KEY;
    return defaultKey ? loadStripe(defaultKey) : null;
  });
  const fetched = useRef(false);

  const [isTestMode, setIsTestMode] = useState(false);

  useEffect(() => {
    const fetchStripeKey = async () => {
      try {
        const res = await apiClient.get("/stripe/config");
        const key =
          res.data.publishableKey || import.meta.env.VITE_STRIPE_PUB_KEY;
        if (key) {
          setStripePromise(loadStripe(key));
        }
        if (res.data.testMode !== undefined) {
          setIsTestMode(res.data.testMode);
        }
      } catch (err) {
        console.error("Could not fetch active Stripe key from API:", err);
      }
    };
    fetchStripeKey();
  }, []);

  useEffect(() => {
    if (fetched.current) return;
    const fetchIntent = async () => {
      try {
        fetched.current = true;
        // Must use apiClient to include Auth headers
        const response = await apiClient.post("/create-payment-intent", {
          contract_id: contractId,
        });
        setClientSecret(response.data.clientSecret);
      } catch (err) {
        console.error("Failed to init payment", err);
        setErrorMsg(
          "Failed to initialize Stripe payment. Please try again or go back.",
        );
        fetched.current = false;
      }
    };
    if (contractId) {
      fetchIntent();
    }
  }, [contractId]);

  return (
    <div className="animate-in fade-in duration-300 flex flex-col">
      {/* Scrollable Content Body */}
      <div className="p-6 sm:p-10 max-w-2xl mx-auto space-y-6 w-full">
        {/* Test Mode $1.00 Banner */}
        {isTestMode && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 flex items-start sm:items-center gap-3 sm:gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="p-2.5 bg-amber-100 rounded-xl shrink-0 text-amber-700">
              <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <h4 className="font-extrabold text-amber-950 text-sm sm:text-base flex items-center gap-2">
                Stripe Test Mode Active ($1.00 Payment)
              </h4>
              <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
                Stripe is currently operating in Test Mode. Your card will only
                be charged <strong>$1.00</strong> for this test transaction, and
                all contract records across QuickBooks, Galt Warranty, and
                HubSpot will sync as a <strong>$1.00</strong> test order.
              </p>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-[#0b1a30]/5 to-[#0b1a30]/10 text-[#0b1a30] rounded-2xl p-6 sm:p-8 text-center shadow-sm border border-slate-200/80 relative overflow-hidden">
          {/* subtle pattern overlay */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#0ea5e9_1px,transparent_1px)] [background-size:16px_16px]"></div>

          <div className="relative z-10">
            <span className="text-xs font-bold uppercase tracking-widest text-[#2f4269] block mb-1">
              Total Amount Due
            </span>
            <span className="text-5xl font-extrabold tracking-tight text-[#0b1a30]">
              $
              {isTestMode
                ? "1.00"
                : servicePlan?.price?.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
            </span>
            <div className="mt-4 flex flex-col items-center gap-2">
              <span className="text-xs text-[#2f4269] font-bold bg-white border border-[#D0E2FF] px-4 py-1.5 rounded-xl inline-block shadow-sm">
                {servicePlan?.name} Base Plan
              </span>
              {!isTestMode && servicePlan?.taxAmount > 0 && (
                <span className="text-xs text-emerald-800 font-bold bg-[#E3F9E9] border border-[#A3E5B7] px-4 py-1.5 rounded-xl inline-block shadow-sm animate-in fade-in duration-200">
                  {servicePlan.taxCounty
                    ? `Includes ${(servicePlan.taxRate * 100).toFixed(1)}% Florida Sales Tax - ${servicePlan.taxCounty} (+$${servicePlan.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                    : `Includes Florida Sales Tax (+$${servicePlan.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
                </span>
              )}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-semibold flex items-center justify-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-700 inline-block shrink-0" />{" "}
            {errorMsg}
          </div>
        )}

        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
          {clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm contract_id={contractId} />
            </Elements>
          ) : !errorMsg ? (
            <div className="flex flex-col items-center justify-center p-12 gap-5">
              <svg
                className="animate-spin h-10 w-10 text-[#2f4269]"
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
              <span className="text-slate-500 font-semibold text-lg">
                Initializing payment gateway...
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer Navigation Bar */}
      <div className="p-6 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between rounded-b-[22px]">
        <button
          type="button"
          onClick={onBack}
          disabled={!clientSecret && !errorMsg}
          className="border border-slate-200 text-slate-600 hover:bg-slate-100/60 bg-white rounded-xl px-6 py-3 text-xs sm:text-sm transition-all shadow-sm disabled:opacity-50"
        >
          Go Back
        </button>

        <button
          type="button"
          disabled={true}
          className="rounded-xl px-6 py-3 text-xs sm:text-sm font-bold transition-all shadow-none bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/50"
        >
          Await Payment Details Above
        </button>
      </div>
    </div>
  );
};

export default Payment;
