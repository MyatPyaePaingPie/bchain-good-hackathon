import { useState, useEffect } from "react";
import { getAccountTx, getAccountEscrows } from "../xrpl/client.js";
import { getEffectiveStatus } from "../App.jsx";

const EXPLORER_BASE = "https://testnet.xrpl.org";

const STATUS_STYLES = {
  pending:  "bg-gray-100 text-gray-600",
  funded:   "bg-gray-100 text-gray-500",
  voteable: "bg-indigo-100 text-indigo-700",
  approved: "bg-yellow-100 text-yellow-700",
  released: "bg-green-100 text-green-700",
};

function StatusBadge({ status }) {
  const label = status === "funded" ? "locked" : status;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
      {label}
    </span>
  );
}

function truncHash(hash) {
  if (!hash) return "—";
  return hash.slice(0, 8) + "…" + hash.slice(-6);
}

export default function FundDashboard({ fundedProjects, wallets, balances }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchTx() {
      try {
        const txResult = await getAccountTx(wallets.fund.address, 30);
        if (!cancelled) { setTransactions(txResult); setLoading(false); }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        if (!cancelled) setLoading(false);
      }
    }
    fetchTx();
    const interval = setInterval(fetchTx, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [wallets.fund.address]);

  // Aggregate stats across all funded projects
  const allMilestones = fundedProjects.flatMap((p) =>
    p.milestones.map((m) => ({ ...m, _effectiveStatus: getEffectiveStatus(m, p.milestones) }))
  );
  const totalXRP = allMilestones.reduce((s, m) => s + m.xrpAmount, 0);
  const releasedXRP = allMilestones.filter((m) => m.status === "released").reduce((s, m) => s + m.xrpAmount, 0);
  const releasedCount = allMilestones.filter((m) => m.status === "released").length;
  const progressPercent = totalXRP > 0 ? Math.round((releasedXRP / totalXRP) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Donor", value: balances.donor },
          { label: "Fund", value: balances.fund },
          { label: "Beneficiary", value: balances.beneficiary },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {value ?? "—"} <span className="text-sm font-normal text-gray-400">XRP</span>
            </p>
          </div>
        ))}
      </div>

      {/* Aggregate Progress */}
      {fundedProjects.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-700">Overall Disbursement</h3>
            <span className="text-sm text-gray-500">
              {releasedCount} of {allMilestones.length} milestones — {releasedXRP} / {totalXRP} XRP
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="bg-green-500 h-3 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      {/* Per-Project Escrow View */}
      {fundedProjects.map((project) => {
        const pReleased = project.milestones.filter((m) => m.status === "released");
        const pTotal = project.milestones.reduce((s, m) => s + m.xrpAmount, 0);
        const pReleasedXRP = pReleased.reduce((s, m) => s + m.xrpAmount, 0);
        const pPct = pTotal > 0 ? Math.round((pReleasedXRP / pTotal) * 100) : 0;

        return (
          <div key={project.id} className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium text-gray-900">{project.title}</h3>
                <p className="text-xs text-gray-500">{pReleased.length}/{project.milestones.length} milestones — {pReleasedXRP}/{pTotal} XRP</p>
              </div>
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pPct}%` }} />
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {project.milestones.map((m) => {
                const effective = getEffectiveStatus(m, project.milestones);
                return (
                  <div key={m.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-5">M{m.order}</span>
                      <span className="text-sm text-gray-900">{m.title}</span>
                      <StatusBadge status={effective} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{m.xrpAmount} XRP</span>
                      {m.escrowTxHash && (
                        <a href={`${EXPLORER_BASE}/transactions/${m.escrowTxHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          escrow {truncHash(m.escrowTxHash)}
                        </a>
                      )}
                      {m.releaseTxHash && (
                        <a href={`${EXPLORER_BASE}/transactions/${m.releaseTxHash}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                          release {truncHash(m.releaseTxHash)}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {fundedProjects.length === 0 && (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
          No projects funded yet. Go to the Donor tab to select and fund projects.
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700">Recent Transactions</h3>
        </div>
        {loading ? (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">Loading…</div>
        ) : transactions.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">No transactions yet</div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {transactions.map((tx, i) => {
              const hash = tx.tx_json?.hash || tx.hash;
              const type = tx.tx_json?.TransactionType || tx.TransactionType || "Unknown";
              const result = tx.meta?.TransactionResult || "";
              return (
                <div key={i} className="px-4 py-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">{type}</span>
                    <span className={`text-xs ${result === "tesSUCCESS" ? "text-green-600" : "text-red-500"}`}>{result}</span>
                  </div>
                  {hash && (
                    <a href={`${EXPLORER_BASE}/transactions/${hash}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs font-mono">
                      {truncHash(hash)}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
