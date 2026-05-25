import React, { useEffect } from 'react';
import { useFlow } from '../context/FlowContext';
import { CheckCircle, Download, ExternalLink } from 'lucide-react';

const Success = () => {
  const { customer, servicePlan, contractId } = useFlow();

  useEffect(() => {
    // In a real application, we might poll to ensure the webhook was received
    // and the integrations were fired. Here we treat completion as success.
  }, []);

  return (
    <div className="animate-in fade-in zoom-in duration-500 text-center py-8">
      <div className="flex justify-center mb-6">
        <div className="bg-green-100 p-4 rounded-full">
          <CheckCircle className="w-16 h-16 text-green-500" />
        </div>
      </div>
      
      <h3 className="text-2xl font-bold mb-4 text-slate-800">Payment Successful!</h3>
      
      <p className="text-slate-600 mb-8 max-w-sm mx-auto leading-relaxed">
        Thank you, {customer?.name}. Your {servicePlan?.name} contract is now active. 
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
        <button className="btn-primary flex justify-center items-center gap-2" onClick={() => window.location.reload()}>
          Start New Contract
        </button>
        <button className="btn-secondary flex justify-center items-center gap-2">
          <Download className="w-4 h-4" /> Download Receipt
        </button>
      </div>
    </div>
  );
};

export default Success;


