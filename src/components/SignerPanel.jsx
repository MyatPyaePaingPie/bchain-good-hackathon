import { useEffect, useMemo, useState } from "react";
import { finishEscrow } from "../xrpl/escrow";
import { mintImpactNFT } from "../xrpl/nft";
import { getEffectiveStatus } from "../App.jsx";

const COMMITTEE_MEMBERS = [
  { key: "ngoRep", label: "NGO Rep", blurb: "Confirms the nonprofit completed the milestone deliverable." },
  { key: "donorRep", label: "Donor Rep", blurb: "Represents donor intent before milestone funds are unlocked." },
  { key: "communityAuditor", label: "Community Auditor", blurb: "Provides an independent accountability check." },
];

const STATUS_STYLES = {
  pending:  { badge: "bg-gray-100 text-gray-600", meter: "bg-gray-400" },
  funded:   { badge: "bg-gray-100 text-gray-500", meter: "bg-gray-400" },
  voteable: { badge: "bg-indigo-100 text-indigo-700", meter: "bg-indigo-500" },
  approved: { badge: "bg-amber-100 text-amber-700", meter: "bg-amber-500" },
  released: { badge: "bg-green-100 text-green-700", meter: "bg-green-500" },
};

function countApprovals(approvals) {
  return Object.values(approvals ?? {}).filter(Boolean).length;
}

function StatusBadge({ status }) {
  const label = status === "funded" ? "locked" : status;
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${style.badge}`}>
      {label}
    </span>
  );
}

export default function SignerPanel({
  fundedProjects,
  wallets,
  updateMilestoneApproval,
  updateMilestoneReleased,
  addMintedNFT,
}) {
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [releasingMilestoneId, setReleasingMilestoneId] = useState(null);
  const [attemptedReleaseKeys, setAttemptedReleaseKeys] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Auto-select first funded project
  useEffect(() => {
    if (!selectedProjectId && fundedProjects.length > 0) {
      setSelectedProjectId(fundedProjects[0].id);
    }
  }, [fundedProjects, selectedProjectId]);

  const selectedProject = useMemo(
    () => fundedProjects.find((p) => p.id === selectedProjectId) ?? null,
    [fundedProjects, selectedProjectId]
  );

  function getReleaseKey(projectId, milestoneId) {
    return `${projectId}:${milestoneId}`;
  }

  async function releaseMilestone(project, milestone, { manual = false } = {}) {
    const releaseKey = getReleaseKey(project.id, milestone.id);

    try {
      setError("");
      setMessage(`Releasing ${milestone.title} — submitting EscrowFinish...`);
      setReleasingMilestoneId(milestone.id);
      setAttemptedReleaseKeys((prev) =>
        prev.includes(releaseKey) ? prev : [...prev, releaseKey]
      );

      const result = await finishEscrow({
        ownerAddress: wallets.fund.address,
        escrowSequence: milestone.escrowSequence,
        condition: milestone.condition,
        fulfillment: milestone.fulfillment,
        wallet: wallets.fund,
      });

      const releaseTxHash =
        result?.result?.hash ||
        result?.result?.tx_json?.hash ||
        result?.result?.tx_json?.tx_json?.hash ||
        null;

      updateMilestoneReleased(project.id, milestone.id, releaseTxHash);

      // Mint Proof-of-Impact NFT
      setMessage(`${milestone.title} released! Minting Proof-of-Impact NFT...`);
      try {
        const approvedBy = COMMITTEE_MEMBERS
          .filter((member) => milestone.approvals[member.key])
          .map((member) => member.label);
        const tokenId = await mintImpactNFT({
          wallet: wallets.fund,
          milestone: { id: milestone.id, title: milestone.title },
          xrpAmount: milestone.xrpAmount,
          beneficiary: wallets?.beneficiary?.address || "unknown",
          escrowTxHash: milestone.escrowTxHash || "",
          releaseTxHash: releaseTxHash || "",
          approvedBy,
        });
        addMintedNFT?.({
          NFTokenID: tokenId,
          metadata: {
            t: "poi",
            mid: milestone.id,
            mt: milestone.title,
            xrp: milestone.xrpAmount,
            to: wallets?.beneficiary?.address || "unknown",
            esc: milestone.escrowTxHash || "",
            rel: releaseTxHash || "",
          },
        });
        setMessage(`${milestone.title} released + Impact NFT minted! Next milestone unlocked.`);
      } catch (nftErr) {
        console.error("Impact NFT mint failed:", nftErr);
        setMessage(`${milestone.title} released! (NFT mint failed — non-fatal)`);
      }

      if (manual) {
        setError("");
      }
    } catch (releaseError) {
      console.error("EscrowFinish failed:", releaseError);
      setError(
        `EscrowFinish failed for ${milestone.title}: ${
          releaseError.message || "Unknown error"
        }. Automatic retry is paused; use Retry Release to try again.`
      );
    } finally {
      setReleasingMilestoneId(null);
    }
  }

  // Auto-release when a milestone hits "approved" status
  useEffect(() => {
    if (!selectedProject) return;

    const approvedMilestone = selectedProject.milestones.find(
      (m) => m.status === "approved" && m.escrowSequence != null
    );
    if (!approvedMilestone || releasingMilestoneId === approvedMilestone.id) return;

    const releaseKey = getReleaseKey(selectedProject.id, approvedMilestone.id);
    if (attemptedReleaseKeys.includes(releaseKey)) return;

    void releaseMilestone(selectedProject, approvedMilestone);
  }, [selectedProject, releasingMilestoneId, attemptedReleaseKeys, wallets]);

  function handleToggle(milestoneId, role) {
    if (!selectedProject) return;
    const m = selectedProject.milestones.find((ms) => ms.id === milestoneId);
    if (!m) return;

    const effective = getEffectiveStatus(m, selectedProject.milestones);
    if (effective !== "voteable") return;

    setError("");
    const nextValue = !m.approvals[role];
    updateMilestoneApproval(selectedProject.id, milestoneId, role, nextValue);
    setMessage(nextValue ? "Vote recorded." : "Vote removed.");
  }

  if (fundedProjects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-500">
        No funded projects to review. Donor must fund projects first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Project selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Select Project</p>
        <div className="flex gap-2 flex-wrap">
          {fundedProjects.map((p) => {
            const released = p.milestones.filter((m) => m.status === "released").length;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedProjectId === p.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {p.title}
                <span className="ml-2 text-xs opacity-70">{released}/{p.milestones.length}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedProject && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Milestones</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{selectedProject.milestones.length}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Voteable</p>
              <p className="mt-2 text-3xl font-semibold text-amber-900">
                {selectedProject.milestones.filter((m) => getEffectiveStatus(m, selectedProject.milestones) === "voteable").length}
              </p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-green-600">Released</p>
              <p className="mt-2 text-3xl font-semibold text-green-900">
                {selectedProject.milestones.filter((m) => m.status === "released").length}
              </p>
            </div>
          </div>

          {/* Messages */}
          {message && <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-sm">{message}</div>}
          {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}

          {/* Milestone voting cards */}
          <div className="space-y-4">
            {selectedProject.milestones.map((m) => {
              const effective = getEffectiveStatus(m, selectedProject.milestones);
              const approvalCount = countApprovals(m.approvals);
              const isVoteable = effective === "voteable";
              const isLocked = effective === "funded";
              const isReleasing = releasingMilestoneId === m.id;
              const canRetryRelease =
                effective === "approved" && !isReleasing;

              return (
                <div
                  key={m.id}
                  className={`rounded-xl border p-5 transition-all ${
                    effective === "released"
                      ? "border-green-200 bg-green-50/50"
                      : isVoteable
                      ? "border-indigo-200 bg-white"
                      : isLocked
                      ? "border-gray-200 bg-gray-50 opacity-60"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-mono">M{m.order}</span>
                        <h4 className="font-medium text-gray-900">{m.title}</h4>
                        <StatusBadge status={effective} />
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{m.description}</p>
                    </div>
                    <span className="text-sm font-medium text-gray-700">{m.xrpAmount} XRP</span>
                  </div>

                  {isLocked && (
                    <p className="text-xs text-gray-400 italic">
                      Locked — waiting for Milestone {m.order - 1} to be released
                    </p>
                  )}

                  {isReleasing && (
                    <p className="text-sm text-amber-600 font-medium">Submitting EscrowFinish...</p>
                  )}

                  {(isVoteable || effective === "approved") && (
                    <div className="mt-3">
                      {/* Quorum progress */}
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-500">Approvals: {approvalCount}/3 (need 2)</span>
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${approvalCount >= 2 ? "bg-green-500" : "bg-indigo-500"}`}
                            style={{ width: `${Math.min((approvalCount / 2) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Committee member buttons */}
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {COMMITTEE_MEMBERS.map((member) => {
                          const voted = m.approvals[member.key];
                          return (
                            <button
                              key={member.key}
                              onClick={() => handleToggle(m.id, member.key)}
                              disabled={!isVoteable || isReleasing}
                              className={`p-3 rounded-lg text-center transition-all ${
                                voted
                                  ? "bg-green-100 border-2 border-green-400 text-green-800"
                                  : "bg-gray-50 border-2 border-gray-200 text-gray-600 hover:border-gray-300"
                              } ${!isVoteable ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              <p className="text-xs font-semibold">{member.label}</p>
                              <p className="text-[10px] mt-1 opacity-70">{voted ? "Approved" : "Click to approve"}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {effective === "released" && (
                    <p className="text-sm text-green-600 font-medium mt-2">Released on-chain</p>
                  )}

                  {canRetryRelease && (
                    <button
                      type="button"
                      onClick={() => void releaseMilestone(selectedProject, m, { manual: true })}
                      className="mt-3 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-600"
                    >
                      Retry Release
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
