import React, { useState, useEffect, useRef } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { apiClient } from "../context/AuthContext";
import { useFlow } from "../context/FlowContext";

const ContractExpiryTimer = ({ onExpire }) => {
  const { contractId, galtSubmittedAt } = useFlow();
  const [secondsRemaining, setSecondsRemaining] = useState(180);
  const expiredHandledRef = useRef(false);

  // Sync remaining seconds with galtSubmittedAt
  useEffect(() => {
    expiredHandledRef.current = false;

    const calculateRemaining = () => {
      if (!galtSubmittedAt) return 180;
      const elapsed = Math.floor((Date.now() - new Date(galtSubmittedAt).getTime()) / 1000);
      return Math.max(0, 180 - elapsed);
    };

    setSecondsRemaining(calculateRemaining());

    // 1-second countdown tick
    const tickInterval = setInterval(() => {
      const remaining = calculateRemaining();
      setSecondsRemaining(remaining);

      if (remaining <= 0 && !expiredHandledRef.current) {
        expiredHandledRef.current = true;
        clearInterval(tickInterval);
        if (onExpire) onExpire();
      }
    }, 1000);

    return () => clearInterval(tickInterval);
  }, [galtSubmittedAt, onExpire]);

  // Periodic server sync to handle background server sweeper
  useEffect(() => {
    if (!contractId) return;

    const checkServerStatus = async () => {
      try {
        const res = await apiClient.get(`/galt/expiry-status/${contractId}`);
        if (res.data?.is_expired && !expiredHandledRef.current) {
          expiredHandledRef.current = true;
          if (onExpire) onExpire();
        } else if (res.data?.seconds_remaining !== undefined) {
          setSecondsRemaining(res.data.seconds_remaining);
          if (res.data.seconds_remaining <= 0 && !expiredHandledRef.current) {
            expiredHandledRef.current = true;
            if (onExpire) onExpire();
          }
        }
      } catch (err) {
        // If 400 with is_expired
        if (err.response?.data?.is_expired && !expiredHandledRef.current) {
          expiredHandledRef.current = true;
          if (onExpire) onExpire();
        }
      }
    };

    const pollInterval = setInterval(checkServerStatus, 10000);
    return () => clearInterval(pollInterval);
  }, [contractId, onExpire]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isUrgent = secondsRemaining <= 60;
  const progressPercent = Math.min(100, Math.max(0, (secondsRemaining / 180) * 100));

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 overflow-hidden shadow-xs mb-6 ${
        isUrgent
          ? "bg-rose-50/95 border-rose-300 text-rose-900"
          : "bg-blue-50/80 border-blue-200 text-slate-800"
      }`}
    >
      <div className="p-4 sm:px-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              isUrgent ? "bg-rose-100 text-rose-700 animate-pulse" : "bg-blue-100 text-blue-700"
            }`}
          >
            {isUrgent ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs uppercase tracking-wider">
                {isUrgent ? "Payment Window Expiring Soon" : "Payment Window (3 Minutes)"}
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              {isUrgent
                ? "Complete payment to secure contract. Application document voids automatically at 00:00."
                : "Complete payment within 3 minutes before the application document expires and voids."}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0 pl-2">
          <div
            className={`font-mono text-xl sm:text-2xl font-black tracking-tight ${
              isUrgent ? "text-rose-700 animate-pulse" : "text-[#2f4269]"
            }`}
          >
            {formattedTime}
          </div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            remaining
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200/60 h-1.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${
            isUrgent ? "bg-rose-500" : "bg-brand-500"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};

export default ContractExpiryTimer;
