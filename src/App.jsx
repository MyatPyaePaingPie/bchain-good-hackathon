import { useState, useEffect, useCallback } from "react";
import "./app.css";
import { WALLETS } from "./data/wallets.js";
import { MILESTONES } from "./data/milestones.js";
import { getBalance, disconnect } from "./xrpl/client.js";
import DonorPanel from "./components/DonorPanel.jsx";
import SignerPanel from "./components/SignerPanel.jsx";
import MilestoneBoard from "./components/MilestoneBoard.jsx";
import FundDashboard from "./components/FundDashboard.jsx";

const TABS = [
  { id: "donor", label: "Donor" },
  { id: "committee", label: "Committee" },
  { id: "milestones", label: "Milestones" },
  { id: "dashboard", label: "Dashboard" },
];

function buildMilestoneState(defs) {
  return defs.map((m) => ({
    ...m,
    status: "pending", // pending | funded | approved | released
    escrowSequence: null,
    condition: null,
    fulfillment: null,
    escrowTxHash: null,
    releaseTxHash: null,
    approvals: {
      ngoRep: false,
      donorRep: false,
      communityAuditor: false,
    },
  }));
}

export default function App() {
  const [activeTab, setActiveTab] = useState("donor");
  const [milestones, setMilestones] = useState(() => buildMilestoneState(MILESTONES));
  const [balances, setBalances] = useState({ donor: null, fund: null, beneficiary: null });

  // Fetch balances periodically
  const refreshBalances = useCallback(async () => {
    try {
      const [donor, fund, beneficiary] = await Promise.all([
        getBalance(WALLETS.donor.address),
        getBalance(WALLETS.fund.address),
        getBalance(WALLETS.beneficiary.address),
      ]);
      setBalances({ donor, fund, beneficiary });
    } catch (err) {
      console.error("Failed to fetch balances:", err);
    }
  }, []);

  useEffect(() => {
    refreshBalances();
    const interval = setInterval(refreshBalances, 10000);
    return () => {
      clearInterval(interval);
      disconnect();
    };
  }, [refreshBalances]);

  // --- State updaters passed down to child components ---

  /** After EscrowCreate succeeds for a milestone */
  const updateMilestoneEscrow = useCallback((milestoneId, { escrowSequence, condition, fulfillment, escrowTxHash }) => {
    setMilestones((prev) =>
      prev.map((m) =>
        m.id === milestoneId
          ? { ...m, status: "funded", escrowSequence, condition, fulfillment, escrowTxHash }
          : m
      )
    );
  }, []);

  /** When a committee member approves a milestone */
  const updateMilestoneApproval = useCallback((milestoneId, role, approved) => {
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.id !== milestoneId) return m;
        const newApprovals = { ...m.approvals, [role]: approved };
        const approvalCount = Object.values(newApprovals).filter(Boolean).length;
        return {
          ...m,
          approvals: newApprovals,
          status: approvalCount >= 2 && m.status === "funded" ? "approved" : m.status,
        };
      })
    );
  }, []);

  /** After EscrowFinish succeeds for a milestone */
  const updateMilestoneReleased = useCallback((milestoneId, releaseTxHash) => {
    setMilestones((prev) =>
      prev.map((m) =>
        m.id === milestoneId ? { ...m, status: "released", releaseTxHash } : m
      )
    );
    refreshBalances();
  }, [refreshBalances]);

  // Props bundle for child components
  const sharedProps = {
    milestones,
    wallets: WALLETS,
    balances,
    updateMilestoneEscrow,
    updateMilestoneApproval,
    updateMilestoneReleased,
    refreshBalances,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Nonprofit Escrow</h1>
          <p className="text-sm text-gray-500">Transparent fund management on XRPL</p>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Panel Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === "donor" && <DonorPanel {...sharedProps} />}
        {activeTab === "committee" && <SignerPanel {...sharedProps} />}
        {activeTab === "milestones" && <MilestoneBoard {...sharedProps} />}
        {activeTab === "dashboard" && <FundDashboard {...sharedProps} />}
      </main>
    </div>
  );
}
