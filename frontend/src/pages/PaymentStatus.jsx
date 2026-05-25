import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient, useAuth } from '../context/AuthContext';
import { CheckCircle, Clock, XCircle, Download, ArrowRight } from 'lucide-react';

const PaymentStatus = () => {
    const { contractId } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [status, setStatus] = useState('loading'); // loading, paid, pending, error
    const [contract, setContract] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
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
    }, [contractId, retryCount]);

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
                    <div className="animate-in fade-in zoom-in duration-500 text-center py-8">
                        <div className="flex justify-center mb-6">
                            <div className="bg-green-100 p-4 rounded-full">
                                <CheckCircle className="w-16 h-16 text-green-500" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold mb-4 text-slate-800">Payment Successful!</h3>
                        <p className="text-slate-600 mb-8 max-w-sm mx-auto leading-relaxed">
                            Thank you, {contract?.customer_name}. Your {contract?.service_plan} contract is now active. 
                            A certified copy has been emailed to you and our HQ team.
                        </p>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8 text-sm text-slate-700 text-left">
                            <h4 className="font-bold text-slate-900 mb-3 border-b pb-2">Automation Status</h4>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500" /> Contract PDF Received from GALT & Emailed
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500" /> HubSpot CRM Updated
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500" /> QuickBooks Entry Created
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500" /> GALT Enterprises Synced
                                </li>
                            </ul>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button className="btn-primary flex justify-center items-center gap-2" onClick={() => navigate('/')}>
                                Start New Contract
                            </button>
                            <button className="btn-secondary flex justify-center items-center gap-2">
                                <Download className="w-4 h-4" /> Download Receipt
                            </button>
                        </div>
                    </div>
                );
            case 'pending':
                return (
                    <div className="animate-in fade-in zoom-in duration-500 text-center py-8">
                        <div className="flex justify-center mb-6">
                            <div className="bg-amber-100 p-4 rounded-full">
                                <Clock className="w-16 h-16 text-amber-500" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold mb-4 text-slate-800">Payment Pending</h3>
                        <p className="text-slate-600 mb-8 max-w-sm mx-auto leading-relaxed">
                            We're currently processing your payment for the {contract?.service_plan} plan. 
                            This usually takes a few seconds. Feel free to refresh or check back later.
                        </p>
                        <button className="btn-primary flex justify-center items-center gap-2 w-full" onClick={() => window.location.reload()}>
                            Refresh Status
                        </button>
                    </div>
                );
            case 'error':
            default:
                return (
                    <div className="animate-in fade-in zoom-in duration-500 text-center py-8">
                        <div className="flex justify-center mb-6">
                            <div className="bg-red-100 p-4 rounded-full">
                                <XCircle className="w-16 h-16 text-red-500" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold mb-4 text-slate-800">Something went wrong</h3>
                        <p className="text-slate-600 mb-8 max-w-sm mx-auto leading-relaxed">
                            We couldn't retrieve the status of your payment. Please contact support if you believe the payment was successful.
                        </p>
                        <button className="btn-primary flex justify-center items-center gap-2 w-full" onClick={() => navigate('/')}>
                            Back to Home
                        </button>
                    </div>
                );
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto card mt-8">
            {renderContent()}
        </div>
    );
};

export default PaymentStatus;


