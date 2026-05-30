import React, { createContext, useContext, useState } from 'react';

const FlowContext = createContext();

export const useFlow = () => useContext(FlowContext);

export const FlowProvider = ({ children }) => {
  const [technician, setTechnician] = useState(null);
  const [servicePlan, setServicePlan] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [contractId, setContractId] = useState(null);
  const [signature, setSignature] = useState(null);
  const [technicianName, setTechnicianName] = useState('');
  const [galtPdf, setGaltPdf] = useState(null);
  const [galtContractNo, setGaltContractNo] = useState('');
  const [galtApplicationId, setGaltApplicationId] = useState(null);
  const [galtDealerCost, setGaltDealerCost] = useState(null);
  const [galtSignatures, setGaltSignatures] = useState([]);
  // Used lift inspection gate -- must be confirmed before GALT submission on USED lifts
  const [inspectionPassed, setInspectionPassed] = useState(false);

  const value = {
    technician, setTechnician,
    technicianName, setTechnicianName,
    servicePlan, setServicePlan,
    customer, setCustomer,
    contractId, setContractId,
    signature, setSignature,
    galtPdf, setGaltPdf,
    galtContractNo, setGaltContractNo,
    galtApplicationId, setGaltApplicationId,
    galtDealerCost, setGaltDealerCost,
    inspectionPassed, setInspectionPassed,
    galtSignatures, setGaltSignatures,
  };

  return (
    <FlowContext.Provider value={value}>
      {children}
    </FlowContext.Provider>
  );
};
