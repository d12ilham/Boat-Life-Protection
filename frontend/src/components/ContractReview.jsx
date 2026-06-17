import React, { useState, useEffect, useRef } from "react";
import { useFlow } from "../context/FlowContext";
import { useAuth, apiClient } from "../context/AuthContext";
import {
  CheckCircle2,
  FileText,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

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
    galtPdf,
    galtSignatures,
  } = useFlow();

  const { user } = useAuth();
  const [signatureName, setSignatureName] = useState(signature || "");
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // â”€â”€ Multi-page PDF state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [pages, setPages] = useState([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const canvasRefs = useRef([]);

  // Load PDF.js dynamically then decode + render all pages
  useEffect(() => {
    if (!galtPdf) return;
    let cancelled = false;
    setPdfLoading(true);

    const ensurePdfjs = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          resolve();
        };
        document.body.appendChild(script);
      });
    };

    ensurePdfjs()
      .then(async () => {
        const raw = atob(galtPdf);
        const uint8 = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) uint8[i] = raw.charCodeAt(i);

        const doc = await window.pdfjsLib.getDocument({ data: uint8 }).promise;
        if (cancelled) return;

        const pageData = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const pg = await doc.getPage(i);
          const vp = pg.getViewport({ scale: 2.0 }); // 2x for crisp HiDPI rendering
          pageData.push({ page: pg, viewport: vp });
        }
        if (!cancelled) {
          setPages(pageData);
          setPdfLoading(false);
        }
      })
      .catch((err) => {
        console.error("[PDF.js] Failed to load/render PDF:", err);
        if (!cancelled) setPdfLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [galtPdf]);

  // Paint each page onto its canvas once page data is ready
  useEffect(() => {
    canvasRefs.current = canvasRefs.current.slice(0, pages.length);
    pages.forEach(({ page, viewport }, i) => {
      const canvas = canvasRefs.current[i];
      if (!canvas) return;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const ctx = canvas.getContext("2d");

      const renderTask = page.render({ canvasContext: ctx, viewport });

      renderTask.promise.then(() => {
        if (
          accepted &&
          signatureName &&
          galtSignatures &&
          galtSignatures.length > 0
        ) {
          const pageNum = i + 1;
          const pageHeight = viewport.viewBox[3]; // PDF page height in points
          const scale = viewport.scale;

          galtSignatures.forEach((sig) => {
            const { Type, Left, Right, Bottom, Top, Pages } = sig;
            const hasPage = Pages.some((p) => p.Page === pageNum);
            if (!hasPage) return;

            let text = "";
            let isCursive = false;
            if (Type === "CustomerSignature") {
              text = signatureName;
              isCursive = true;
            } else if (Type === "DealerSignature") {
              text = technicianName || "Authorized Representative";
              isCursive = true;
            } else if (Type === "CustomerDate") {
              text = new Date().toLocaleDateString("en-US");
            }

            if (!text) return;

            // Navy ink for signing
            ctx.fillStyle = "rgba(0, 30, 110, 0.9)";

            if (isCursive) {
              ctx.font = `italic bold ${Math.min(28, (Top - Bottom) * scale * 0.75)}px "Caveat", "Brush Script MT", cursive, serif`;
            } else {
              ctx.font = `bold ${Math.min(24, (Top - Bottom) * scale * 0.65)}px "Courier New", Courier, monospace`;
            }

            // Translate PDF bottom-left origin to HTML top-left canvas origin
            const x = (Left + 4) * scale;
            const y = (pageHeight - Bottom - 4) * scale;

            ctx.fillText(text, x, y);
          });
        }
      });
    });
  }, [pages, accepted, signatureName, galtSignatures]);

  // â”€â”€ Signature handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      setErrorMsg(
        err.response?.data?.message || "Error digitally signing the contract.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-300 flex flex-col">
      {/* Scrollable Content Body */}
      <div className="p-3 md:p-5 lg:p-10 space-y-8">
        {errorMsg && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-semibold flex items-center gap-3">
            <span className="text-lg">âš </span> {errorMsg}
          </div>
        )}

        {/* â”€â”€ GALT PDF Viewer â”€â”€ */}
        {galtPdf ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3 uppercase tracking-wide">
              <FileText className="w-4 h-4 text-[#2f4269] flex-shrink-0" />
              Official GALT Service Contract Document
              {galtContractNo && (
                <span className="ml-auto text-xs font-semibold text-emerald-600 normal-case">
                  #{galtContractNo}
                </span>
              )}
            </h4>

            {/* Loading spinner */}
            {pdfLoading && (
              <div className="flex flex-col items-center justify-center p-20 gap-4 bg-slate-50 rounded-xl">
                <svg
                  className="animate-spin h-8 w-8 text-[#2f4269]"
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
                <p className="text-sm text-slate-500 font-semibold">
                  Loading contract documentâ€¦
                </p>
              </div>
            )}

            {/* All-pages renderer */}
            {!pdfLoading && pages.length > 0 && (
              <div className="border border-slate-200 rounded-xl bg-slate-100 shadow-inner overflow-hidden mx-auto max-w-[850px]">
                {pages.map(({ viewport }, i) => {
                  return (
                    <div
                      key={i}
                      className={`relative${i < pages.length - 1 ? " border-b border-slate-300" : ""}`}
                    >
                      <canvas
                        ref={(el) => (canvasRefs.current[i] = el)}
                        className="w-full h-auto block bg-white"
                      />

                      {/* Page badge (multi-page only) */}
                      {pages.length > 1 && (
                        <div className="absolute top-2 right-3 text-[10px] font-bold text-slate-400 bg-white/80 backdrop-blur-sm rounded px-1.5 py-0.5 shadow-sm select-none pointer-events-none">
                          {i + 1} / {pages.length}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* â”€â”€ RED ERROR ALERT CARD (shown when no GALT PDF is available) â”€â”€ */
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 sm:p-8 text-center shadow-sm flex flex-col items-center gap-4">
            <div className="bg-red-100 p-4 rounded-full text-red-600 shadow-sm shrink-0">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-red-900 text-lg">
              Official GALT Contract Document Missing
            </h4>
            <p className="text-red-700 text-xs sm:text-sm font-semibold max-w-lg leading-relaxed">
              We did not receive the official contract PDF from the GALT API.
              Signing is disabled. Please go back to "Customer Details" to
              verify information and re-submit.
            </p>
          </div>
        )}

        {/* â”€â”€ Signature Section â”€â”€ */}
        <div className="space-y-6 max-w-2xl mx-auto md:max-w-none lg:w-3/4">
          <label
            className={`flex items-start gap-4 p-5 border-2 border-slate-200 rounded-xl bg-white shadow-sm cursor-pointer hover:border-brand-300 transition-all duration-200 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/30 group ${!galtPdf ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
          >
            <input
              type="checkbox"
              className="mt-0.5 md:mt-1 h-5 w-5 text-[#2f4269] focus:ring-[#2f4269] border-slate-300 rounded cursor-pointer transition-colors"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              disabled={!galtPdf}
            />
            <span className="text-base md:text-lg font-semibold text-slate-700 select-none group-has-[:checked]:text-brand-900 transition-colors">
              I acknowledge that I have read and agree to the Contract Terms.
            </span>
          </label>

          <div>
            <label
              className={`block text-base font-semibold text-slate-700 mb-2 ${!galtPdf ? "opacity-50" : ""}`}
            >
              Type Full Name for Digital Signature
            </label>
            <input
              type="text"
              className="input-field text-lg py-2 lg:py-4 placeholder-slate-300 shadow-inner disabled:bg-slate-100 disabled:cursor-not-allowed"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="e.g. John Doe"
              disabled={!galtPdf}
            />
          </div>
        </div>
      </div>

      {/* Footer Navigation Bar */}
      <div className="p-6 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between rounded-b-[22px]">
        <button
          type="button"
          onClick={() => {
            setSignature(signatureName);
            onBack();
          }}
          className="border border-slate-200 text-slate-600 hover:bg-slate-100/60 bg-white rounded-xl px-6 py-3 text-xs sm:text-sm transition-all shadow-sm"
        >
          Review Details
        </button>

        <button
          type="button"
          onClick={handleSign}
          disabled={!accepted || !signatureName.trim() || loading || !galtPdf}
          className={`rounded-xl px-6 py-3 text-xs sm:text-sm transition-all shadow-sm hover:shadow-md ${
            accepted && signatureName.trim() && !loading && galtPdf
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
              Signing contract...
            </span>
          ) : (
            "Continue to Payment"
          )}
        </button>
      </div>
    </div>
  );
};

export default ContractReview;
