import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient, useAuth } from '../context/AuthContext';
import { CheckCircle, Clock, XCircle, Download } from 'lucide-react';

const PaymentStatus = () => {
    const { contractId } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [status, setStatus] = useState('loading'); // loading, paid, pending, error
    const [contract, setContract] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated) {
            navigate('/');
            return;
        }

        const fetchStatus = async () => {
            try {
                const response = await apiClient.get(`/contract/${contractId}`);
                const data = response.data;
                setContract(data);
                
                if (data.status === 'paid') {
                    setStatus('paid');
                } else {
                    // If it's still pending, we might want to poll for a few seconds 
                    // because webhooks can be slightly delayed.
                    if (retryCount < 5) {
                        setTimeout(() => setRetryCount(prev => prev + 1), 2000);
                        setStatus('pending');
                    } else {
                        setStatus('pending');
                    }
                }
            } catch (err) {
                console.error('Failed to fetch contract status', err);
                setStatus('error');
            }
        };

        if (contractId) {
            fetchStatus();
        }
    }, [contractId, retryCount, authLoading, isAuthenticated, navigate]);

    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <div className="flex flex-col items-center justify-center p-12 gap-5">
                        <svg className="animate-spin h-10 w-10 text-brand-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        <span className="text-slate-500 font-semibold text-lg">Verifying payment status...</span>
                    </div>
                );
            case 'paid':
                return (
                    <div className="animate-in fade-in zoom-in duration-500 text-center py-6">
                        <div className="flex justify-center mb-6">
                            <div className="bg-emerald-100 p-4 rounded-full shadow-sm ring-8 ring-emerald-50">
                                <CheckCircle className="w-12 h-12 text-emerald-600" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold mb-4 text-[#2F4269] tracking-tight">Payment Successful!</h3>
                        <p className="text-slate-505 text-sm mb-8 max-w-md mx-auto leading-relaxed font-semibold">
                            Thank you, <strong className="text-slate-800">{contract?.customer_name}</strong>. Your <strong className="text-slate-800">{contract?.service_plan}</strong> contract is now active. 
                            A certified copy has been emailed to you and our HQ team.
                        </p>

                        <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-6 mb-8 text-sm text-slate-600 text-left max-w-xl mx-auto shadow-sm">
                            <h4 className="font-bold text-[#2F4269] text-xs uppercase tracking-wider mb-4 border-b border-slate-200/60 pb-2">Automation Status</h4>
                            <ul className="space-y-3.5">
                                <li className="flex items-center gap-3 font-semibold text-xs text-slate-600">
                                    <CheckCircle className="w-4.5 h-4.5 text-emerald-600 shrink-0" /> Contract PDF Received from GALT & Emailed
                                </li>
                                <li className="flex items-center gap-3 font-semibold text-xs text-slate-600">
                                    <CheckCircle className="w-4.5 h-4.5 text-emerald-600 shrink-0" /> HubSpot CRM Updated
                                </li>
                                <li className="flex items-center gap-3 font-semibold text-xs text-slate-600">
                                    <CheckCircle className="w-4.5 h-4.5 text-emerald-600 shrink-0" /> QuickBooks Entry Created
                                </li>
                                <li className="flex items-center gap-3 font-semibold text-xs text-slate-600">
                                    <CheckCircle className="w-4.5 h-4.5 text-emerald-600 shrink-0" /> GALT Enterprises Synced
                                </li>
                            </ul>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto justify-center">
                            <button className="flex-1 bg-[#2f4269] text-white hover:bg-[#1a2844] rounded-xl px-6 py-3.5 text-xs sm:text-sm font-bold transition-all shadow-sm hover:shadow-md cursor-pointer flex justify-center items-center gap-2" onClick={() => navigate('/')}>
                                Start New Contract
                            </button>
                            <button className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-100/60 bg-white rounded-xl px-6 py-3.5 text-xs sm:text-sm font-bold transition-all shadow-sm hover:shadow-md cursor-pointer flex justify-center items-center gap-2">
                                <Download className="w-4 h-4" /> Download Receipt
                            </button>
                        </div>
                    </div>
                );
            case 'pending':
                return (
                    <div className="animate-in fade-in zoom-in duration-500 text-center py-6">
                        <div className="flex justify-center mb-6">
                            <div className="bg-amber-100 p-4 rounded-full shadow-sm ring-8 ring-amber-50">
                                <Clock className="w-12 h-12 text-amber-600" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold mb-4 text-[#2F4269] tracking-tight">Payment Pending</h3>
                        <p className="text-slate-550 text-sm mb-8 max-w-md mx-auto leading-relaxed font-semibold">
                            We're currently processing your payment for the <strong className="text-slate-800">{contract?.service_plan}</strong> plan. 
                            This usually takes a few seconds. Feel free to refresh or check back later.
                        </p>
                        <button className="w-full max-w-sm mx-auto bg-[#2f4269] text-white hover:bg-[#1a2844] rounded-xl px-6 py-3.5 text-xs sm:text-sm font-bold transition-all shadow-sm hover:shadow-md cursor-pointer flex justify-center items-center gap-2" onClick={() => window.location.reload()}>
                            Refresh Status
                        </button>
                    </div>
                );
            case 'error':
            default:
                return (
                    <div className="animate-in fade-in zoom-in duration-500 text-center py-6">
                        <div className="flex justify-center mb-6">
                            <div className="bg-red-100 p-4 rounded-full shadow-sm ring-8 ring-red-50">
                                <XCircle className="w-12 h-12 text-red-600" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold mb-4 text-[#2F4269] tracking-tight">Something went wrong</h3>
                        <p className="text-slate-550 text-sm mb-8 max-w-md mx-auto leading-relaxed font-semibold">
                            We couldn't retrieve the status of your payment. Please contact support if you believe the payment was successful.
                        </p>
                        <button className="w-full max-w-sm mx-auto bg-[#2f4269] text-white hover:bg-[#1a2844] rounded-xl px-6 py-3.5 text-xs sm:text-sm font-bold transition-all shadow-sm hover:shadow-md cursor-pointer flex justify-center items-center gap-2" onClick={() => navigate('/')}>
                            Back to Home
                        </button>
                    </div>
                );
        }
    };

    return (
        <div className="w-full flex-1 flex flex-col justify-start py-4">
            {/* Subtitles above the card */}
            <div className="text-center mb-8 flex flex-col items-center">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-brand-50 border border-brand-200 text-brand-700 font-bold text-[10px] tracking-wider uppercase rounded-full mb-3 shadow-xs select-none">
                    ⚓ Technician Field Portal
                </span>
                <h1 className="text-2xl sm:text-4xl font-bold text-[#2F4269] tracking-tight force-bold">
                    Service Contract — Payment Status
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-2">
                    Transaction verification and digital enrollment confirmation
                </p>
            </div>

            {/* Unified Frame Portal Card */}
            <div className="w-full max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-xl relative z-0 flex flex-col animate-in zoom-in-98 duration-400">
                {/* Navy Header Block */}
                <div className="bg-[#2F4269] px-6 sm:px-10 py-6 flex items-center justify-center rounded-t-[22px]">
                    <div className="flex items-center gap-4">
                        <h2 className="text-white text-base sm:text-lg tracking-tight leading-tight font-semibold">
                            Boat Lift Protection — Field Portal
                        </h2>
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-6 sm:p-10">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default PaymentStatus;
