import React, { useEffect, useState, useRef } from "react";
import { useFlow } from "../context/FlowContext";
import { apiClient } from "../context/AuthContext";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";

// NOTE: Replace with actual publishable key in prod
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUB_KEY || "pk_test_dummy",
);

const CheckoutForm = ({ contract_id }) => {
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) return;

    setLoading(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + `/payment-status/${contract_id}`,
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      setLoading(false);
      navigate(`/payment-status/${contract_id}`);
    } else {
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
        className={`mt-6 w-full rounded-full border border-brand-500 px-8 py-3 text-sm transition-colors ${
          !stripe || loading
            ? "bg-slate-300 border-transparent text-slate-100 cursor-not-allowed"
            : "bg-brand-500 text-white hover:bg-brand-600 shadow-sm"
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
  const fetched = useRef(false);

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
    <div className="animate-in fade-in zoom-in duration-300">
      <div className="flex items-center gap-3 bg-brand-500/10 px-6 sm:px-10 py-4 border-b border-brand-500/10">
        <h3 className="text-lg font-semibold text-brand-500 tracking-tight">
          Secure Checkout
        </h3>
        <span className="text-xs border border-brand-500/20 text-brand-500 px-3 py-1 bg-white rounded-full font-medium shadow-sm">
          Encrypted
        </span>
      </div>

      <div className="p-6 sm:p-10 max-w-2xl mx-auto">
        <div className="bg-gradient-to-r from-brand-50 to-brand-100 text-brand-900 rounded-2xl p-6 md:p-8 mb-8 text-center shadow-sm border border-brand-200 relative overflow-hidden">
          {/* subtle pattern overlay */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#0ea5e9_1px,transparent_1px)] [background-size:16px_16px]"></div>

          <div className="relative z-10">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-500 block mb-2">
              Total Amount Due
            </span>
            <span className="text-5xl font-semibold tracking-tighter text-brand-500">
              ${(servicePlan?.price - (servicePlan?.vehicleStatus === "USED" ? 400 : 0))?.toLocaleString()}
            </span>
            <div className="mt-4 flex flex-col items-center gap-2">
              <span className="text-sm text-brand-500 font-semibold bg-white/60 backdrop-blur-sm px-4 py-1.5 rounded-full inline-block shadow-sm">
                {servicePlan?.name} Base Plan
              </span>
              {servicePlan?.vehicleStatus === "USED" && (
                <span className="text-xs text-emerald-700 font-bold bg-emerald-100/80 backdrop-blur-sm px-3.5 py-1 rounded-full inline-block shadow-sm border border-emerald-200/50">
                  Includes -$400.00 Used Lift Inspection Credit
                </span>
              )}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-semibold flex items-center justify-center gap-2">
            <span className="text-lg">⚠</span> {errorMsg}
          </div>
        )}

        <div className="bg-slate-50 p-6 md:p-8 rounded-2xl border border-slate-100 shadow-inner">
          {clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm contract_id={contractId} />
            </Elements>
          ) : !errorMsg ? (
            <div className="flex flex-col items-center justify-center p-12 gap-5">
              <svg
                className="animate-spin h-10 w-10 text-brand-500"
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
                Initializing securely...
              </span>
            </div>
          ) : null}
        </div>

        <div className="p-8 border-t border-slate-100 flex flex-col items-center text-center bg-slate-50/30 -mx-6 sm:-mx-10 -mb-6 sm:-mb-10 mt-10">
          <p className="text-sm font-medium text-slate-500 mb-6">
            You can verify the payment payload or add another format to your
            order.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mb-5">
            <button
              type="button"
              onClick={onBack}
              disabled={!clientSecret && !errorMsg}
              className="border border-brand-500 text-brand-600 hover:bg-brand-50 bg-white rounded-full px-8 py-3 text-sm transition-colors w-full sm:w-auto min-w-[200px] disabled:opacity-50"
            >
              Go Back
            </button>
            <button
              type="button"
              disabled={true}
              className="rounded-full border border-transparent px-8 py-3 text-sm transition-colors w-full sm:w-auto min-w-[200px] bg-slate-300 text-slate-100 cursor-not-allowed"
            >
              Await Secure Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;
