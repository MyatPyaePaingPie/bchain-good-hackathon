import { useState, useEffect } from "react";
import { getAccountTx, getAccountEscrows } from "../xrpl/client.js";

const EXPLORER_BASE = "https://testnet.xrpl.org";

function statusBadge(status) {
  const styles = {
    pending: "bg-gray-100 text-gray-600",
    funded: "bg-blue-100 text-blue-700",
    approved: "bg-yellow-100 text-yellow-700",
    released: "bg-green-100 text-green-700",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
}

function truncateHash(hash) {
  if (!hash) return "—";
  return hash.slice(0, 8) + "…" + hash.slice(-6);
}

export default function FundDashboard({ milestones, wallets, balances }) {
  const [transactions, setTransactions] = useState([]);
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [txResult, escrowResult] = await Promise.all([
          getAccountTx(wallets.fund.address, 20),
          getAccountEscrows(wallets.fund.address),
        ]);
        if (!cancelled) {
          setTransactions(txResult);
          setEscrows(escrowResult);
          setLoading(false);
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [wallets.fund.address]);

  const releasedMilestones = milestones.filter((m) => m.status === "released");
  const totalXRP = milestones.reduce((sum, m) => sum + m.xrpAmount, 0);
  const releasedXRP = releasedMilestones.reduce((sum, m) => sum + m.xrpAmount, 0);
  const progressPercent = totalXRP > 0 ? Math.round((releasedXRP / totalXRP) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Donor</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {balances.donor ?? "—"} <span className="text-sm font-normal text-gray-400">XRP</span>
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Fund</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {balances.fund ?? "—"} <span className="text-sm font-normal text-gray-400">XRP</span>
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Beneficiary</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {balances.beneficiary ?? "—"} <span className="text-sm font-normal text-gray-400">XRP</span>
          </p>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-gray-700">Disbursement Progress</h3>
          <span className="text-sm text-gray-500">
            {releasedMilestones.length} of {milestones.length} milestones released — {releasedXRP} / {totalXRP} XRP
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-green-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Milestone Escrows */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700">Milestone Escrows</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {milestones.map((m) => (
            <div key={m.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">{m.title}</span>
                {statusBadge(m.status)}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>{m.xrpAmount} XRP</span>
                {m.escrowTxHash && (
                  <a
                    href={`${EXPLORER_BASE}/transactions/${m.escrowTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    escrow {truncateHash(m.escrowTxHash)}
                  </a>
                )}
                {m.releaseTxHash && (
                  <a
                    href={`${EXPLORER_BASE}/transactions/${m.releaseTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:underline"
                  >
                    release {truncateHash(m.releaseTxHash)}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* On-Chain Escrows */}
      {escrows.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Active On-Chain Escrows ({escrows.length})</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {escrows.map((esc, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-900 font-mono">
                    {(Number(esc.Amount) / 1_000_000).toFixed(1)} XRP
                  </span>
                  <span className="text-gray-400 ml-2">→ {esc.Destination?.slice(0, 10)}…</span>
                </div>
                <span className="text-gray-400 font-mono text-xs">
                  Condition: {esc.Condition?.slice(0, 16)}…
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700">Recent Transactions</h3>
        </div>
        {loading ? (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">Loading transactions…</div>
        ) : transactions.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">No transactions yet</div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {transactions.map((tx, i) => {
              const hash = tx.tx_json?.hash || tx.hash;
              const type = tx.tx_json?.TransactionType || tx.TransactionType || "Unknown";
              const result = tx.meta?.TransactionResult || "";
              return (
                <div key={i} className="px-4 py-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">{type}</span>
                    <span className={`text-xs ${result === "tesSUCCESS" ? "text-green-600" : "text-red-500"}`}>
                      {result}
                    </span>
                  </div>
                  {hash && (
                    <a
                      href={`${EXPLORER_BASE}/transactions/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs font-mono"
                    >
                      {truncateHash(hash)}
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
