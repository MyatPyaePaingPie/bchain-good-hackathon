import { useState, useEffect } from "react";
import { Wallet, Gift, CheckCircle2, Loader2, Award, ChevronRight } from "lucide-react";
import { sendPayment, getBalance } from "../xrpl/client";
import { createEscrow } from "../xrpl/escrow";
import { generateCondition } from "../xrpl/condition";

const RANK_COLORS = {
  1: "bg-amber-500",
  2: "bg-gray-400",
  3: "bg-amber-700",
};
const RANK_LABELS = { 1: "1st", 2: "2nd", 3: "3rd" };

export default function DonorPanel({
  projects,
  rankedProjects,
  wallets,
  toggleProjectRank,
  markProjectFunded,
  updateMilestoneEscrow,
  refreshBalances,
}) {
  const [balance, setBalance] = useState("---");
  const [status, setStatus] = useState("");
  const [cascadeLog, setCascadeLog] = useState([]);
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

  const fundedProjects = projects.filter((p) => p.funded);

  const handleFund = async () => {
    if (rankedProjects.length === 0) return;
    setLoading(true);
    setCascadeLog([]);

    try {
      // Cascade: try each ranked project in order, skip if full
      const projectsToFund = [];
      for (const project of rankedProjects) {
        const isFull = project.currentFunded >= project.fundingGoal;
        if (isFull) {
          setCascadeLog((prev) => [...prev, {
            project: project.title,
            action: "skipped",
            reason: `Full (${project.currentFunded}/${project.fundingGoal} XRP)`,
          }]);
          continue;
        }
        projectsToFund.push(project);
        setCascadeLog((prev) => [...prev, {
          project: project.title,
          action: "funding",
          reason: `Has capacity (${project.currentFunded}/${project.fundingGoal} XRP)`,
        }]);
      }

      if (projectsToFund.length === 0) {
        setStatus("All your ranked projects are already fully funded. Try different projects.");
        setLoading(false);
        return;
      }

      // Calculate total XRP needed for projects that have room
      const allMilestones = projectsToFund.flatMap((p) => p.milestones);
      const totalXRP = allMilestones.reduce((s, m) => s + m.xrpAmount, 0);

      setProgress({ current: 0, total: allMilestones.length });
      setStatus(`Sending ${totalXRP} XRP to fund account...`);

      await sendPayment({
        wallet: wallets.donor,
        destination: wallets.fund.address,
        amount: totalXRP.toString(),
      });

      let count = 0;
      for (const project of projectsToFund) {
        for (const milestone of project.milestones) {
          setStatus(`Creating escrow: ${project.title} — ${milestone.title} (${count + 1}/${allMilestones.length})`);

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
          setProgress({ current: count, total: allMilestones.length });
        }
        markProjectFunded(project.id);
      }

      refreshBalances();
      setStatus(`Done! Funded ${projectsToFund.length} project${projectsToFund.length > 1 ? "s" : ""} (${count} escrows).`);
    } catch (err) {
      setStatus("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const rankedCount = rankedProjects.length;

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

      {/* Project Ranking */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-lg font-semibold text-gray-900">Rank Your Top Projects</h3>
          <span className="text-sm text-gray-500">{rankedCount}/3 ranked</span>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Click to rank in order of preference. If your top choice is fully funded, your donation cascades to your next pick.
        </p>

        <div className="grid gap-3">
          {projects.map((project) => {
            const pTotal = project.milestones.reduce((s, m) => s + m.xrpAmount, 0);
            const isFunded = project.funded;
            const isFull = project.currentFunded >= project.fundingGoal;
            const rank = project.rank;
            const fundingPct = Math.round((project.currentFunded / project.fundingGoal) * 100);

            return (
              <button
                key={project.id}
                onClick={() => !isFunded && toggleProjectRank(project.id)}
                disabled={isFunded || loading}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  isFunded
                    ? "border-green-200 bg-green-50 opacity-75"
                    : rank !== null
                    ? "border-blue-500 bg-blue-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300"
                } ${loading ? "pointer-events-none" : ""}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{project.title}</h4>
                      {isFunded && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Funded by you</span>
                      )}
                      {isFull && !isFunded && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">Fully funded</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                    <div className="flex gap-3 mt-2 text-xs text-gray-400">
                      <span>{project.milestones.length} milestones</span>
                      <span>{pTotal} XRP needed</span>
                    </div>
                    {/* Funding progress bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${isFull ? "bg-red-400" : "bg-blue-400"}`}
                          style={{ width: `${Math.min(fundingPct, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 w-16 text-right">
                        {project.currentFunded}/{project.fundingGoal}
                      </span>
                    </div>
                  </div>
                  {/* Rank badge or checkbox */}
                  <div className="flex-shrink-0 ml-3 mt-1">
                    {rank !== null ? (
                      <div className={`w-8 h-8 rounded-full ${RANK_COLORS[rank]} text-white flex items-center justify-center text-xs font-bold`}>
                        {RANK_LABELS[rank]}
                      </div>
                    ) : isFunded ? (
                      <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">
                        <CheckCircle2 size={16} />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fund Button + Cascade Preview */}
      {rankedCount > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Your ranked preferences</p>
          <div className="flex items-center gap-2 mb-4">
            {rankedProjects.map((p, i) => {
              const isFull = p.currentFunded >= p.fundingGoal;
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    isFull ? "bg-red-50 text-red-500 line-through" : "bg-blue-50 text-blue-700"
                  }`}>
                    {RANK_LABELS[p.rank]} {p.title}
                    {isFull && " (full)"}
                  </div>
                  {i < rankedProjects.length - 1 && <ChevronRight size={16} className="text-gray-300" />}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleFund}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-3 transition-all ${
              loading ? "bg-gray-100 text-gray-400" : "bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-[0.98]"
            }`}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
            {loading ? `Creating escrows... ${progress.current}/${progress.total}` : "Fund My Top Choices"}
          </button>

          {/* Cascade log */}
          {cascadeLog.length > 0 && (
            <div className="mt-3 space-y-1">
              {cascadeLog.map((log, i) => (
                <div key={i} className={`text-xs px-3 py-1.5 rounded-lg ${
                  log.action === "skipped" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
                }`}>
                  <span className="font-medium">{log.project}</span> — {log.action}: {log.reason}
                </div>
              ))}
            </div>
          )}

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
