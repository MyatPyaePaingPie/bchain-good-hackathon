import { useState, useEffect } from "react";
import { Wallet, Gift, CheckCircle2, Loader2, Award, ExternalLink } from "lucide-react";
import { sendPayment, getBalance } from "../xrpl/client";
import { createEscrow } from "../xrpl/escrow";
import { generateCondition } from "../xrpl/condition";

export default function DonorPanel({
  projects,
  wallets,
  toggleProjectSelection,
  markProjectFunded,
  updateMilestoneEscrow,
  refreshBalances,
}) {
  const [balance, setBalance] = useState("---");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try { setBalance(await getBalance(wallets.donor.address)); } catch {}
    };
    fetch();
    const t = setInterval(fetch, 12000);
    return () => clearInterval(t);
  }, [wallets.donor.address]);

  const selectedProjects = projects.filter((p) => p.selected && !p.funded);
  const fundedProjects = projects.filter((p) => p.funded);
  const selectedCount = selectedProjects.length;
  const totalMilestones = selectedProjects.flatMap((p) => p.milestones);
  const totalXRP = totalMilestones.reduce((s, m) => s + m.xrpAmount, 0);

  const handleFundSelected = async () => {
    if (selectedCount === 0) return;
    setLoading(true);
    setProgress({ current: 0, total: totalMilestones.length });

    try {
      // Step 1: Send total XRP from donor to fund account
      setStatus("Sending funds to project account...");
      await sendPayment({
        wallet: wallets.donor,
        destination: wallets.fund.address,
        amount: totalXRP.toString(),
      });

      // Step 2: Create escrows for all milestones across selected projects
      let count = 0;
      for (const project of selectedProjects) {
        for (const milestone of project.milestones) {
          setStatus(`Creating escrow: ${project.title} — ${milestone.title} (${count + 1}/${totalMilestones.length})`);

          const { condition, fulfillment } = await generateCondition();
          const { result, sequence } = await createEscrow({
            fromWallet: wallets.fund,
            destination: wallets.beneficiary.address,
            amount: milestone.xrpAmount,
            condition,
          });

          const escrowTxHash = result?.result?.tx_json?.hash || null;

          updateMilestoneEscrow(project.id, milestone.id, {
            escrowSequence: sequence,
            condition,
            fulfillment,
            escrowTxHash,
          });

          count++;
          setProgress({ current: count, total: totalMilestones.length });
        }
        markProjectFunded(project.id);
      }

      refreshBalances();
      setStatus(`Done! ${count} escrows created across ${selectedCount} projects.`);
    } catch (err) {
      setStatus("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Wallet Card */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-blue-100 text-sm font-medium flex items-center gap-2">
              <Wallet size={16} /> Donor Wallet
            </p>
            <h2 className="text-3xl font-bold mt-1">{balance} <span className="text-lg">XRP</span></h2>
            <code className="text-[10px] opacity-70 mt-2 block break-all">{wallets.donor.address}</code>
          </div>
          <div className="bg-white/20 p-3 rounded-xl">
            <Gift size={24} />
          </div>
        </div>
      </div>

      {/* Project Selection */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Choose Projects to Fund</h3>
          <span className="text-sm text-gray-500">{selectedCount}/3 selected</span>
        </div>

        <div className="grid gap-3">
          {projects.map((project) => {
            const pTotal = project.milestones.reduce((s, m) => s + m.xrpAmount, 0);
            const isSelected = project.selected;
            const isFunded = project.funded;

            return (
              <button
                key={project.id}
                onClick={() => !isFunded && toggleProjectSelection(project.id)}
                disabled={isFunded || loading}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  isFunded
                    ? "border-green-200 bg-green-50 opacity-75"
                    : isSelected
                    ? "border-blue-500 bg-blue-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300"
                } ${loading ? "pointer-events-none" : ""}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{project.title}</h4>
                      {isFunded && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Funded</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                    <div className="flex gap-3 mt-2 text-xs text-gray-400">
                      <span>{project.milestones.length} milestones</span>
                      <span>{pTotal} XRP total</span>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                    isFunded ? "border-green-500 bg-green-500" : isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300"
                  }`}>
                    {(isSelected || isFunded) && <CheckCircle2 size={14} className="text-white" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fund Button */}
      {selectedCount > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-600">
              {selectedCount} project{selectedCount > 1 ? "s" : ""} — {totalMilestones.length} milestones — {totalXRP} XRP
            </span>
          </div>
          <button
            onClick={handleFundSelected}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-3 transition-all ${
              loading ? "bg-gray-100 text-gray-400" : "bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-[0.98]"
            }`}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
            {loading ? `Creating escrows... ${progress.current}/${progress.total}` : `Fund Selected Projects (${totalXRP} XRP)`}
          </button>
          {status && (
            <div className={`mt-3 p-3 rounded-lg text-sm font-medium text-center ${
              status.startsWith("Error") ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-700"
            }`}>
              {status}
            </div>
          )}
        </div>
      )}

      {/* Funded Projects Summary */}
      {fundedProjects.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Award className="text-amber-500" size={20} /> Your Funded Projects
          </h3>
          <div className="space-y-2">
            {fundedProjects.map((p) => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <span className="text-sm font-medium text-gray-900">{p.title}</span>
                  <span className="text-xs text-gray-400 ml-2">{p.milestones.length} milestones</span>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  {p.milestones.filter((m) => m.status === "released").length}/{p.milestones.length} released
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
