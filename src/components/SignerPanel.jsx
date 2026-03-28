import { useEffect, useMemo, useState } from "react";
import { finishEscrow } from "../xrpl/escrow";

const COMMITTEE_MEMBERS = [
  {
    key: "ngoRep",
    label: "NGO Rep",
    blurb: "Confirms the nonprofit completed the milestone deliverable.",
  },
  {
    key: "donorRep",
    label: "Donor Rep",
    blurb: "Represents donor intent before milestone funds are unlocked.",
  },
  {
    key: "communityAuditor",
    label: "Community Auditor",
    blurb: "Provides an independent accountability check for release.",
  },
];

const STATUS_STYLES = {
  pending: {
    badge: "bg-gray-100 text-gray-600",
    panel: "border-gray-200 bg-gray-50",
    meter: "bg-gray-400",
  },
  funded: {
    badge: "bg-blue-100 text-blue-700",
    panel: "border-blue-200 bg-blue-50/70",
    meter: "bg-blue-500",
  },
  approved: {
    badge: "bg-amber-100 text-amber-700",
    panel: "border-amber-200 bg-amber-50/80",
    meter: "bg-amber-500",
  },
  released: {
    badge: "bg-green-100 text-green-700",
    panel: "border-green-200 bg-green-50/80",
    meter: "bg-green-500",
  },
};

function countApprovals(approvals) {
  return Object.values(approvals ?? {}).filter(Boolean).length;
}

function truncateHex(value, start = 10, end = 8) {
  if (!value) return "Not created yet";
  if (value.length <= start + end) return value;
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function getStatusCopy(status, approvalCount, isReleasing) {
  if (isReleasing) {
    return "Quorum reached. Simulating escrow release before XRPL wiring is added.";
  }

  if (status === "pending") {
    return "Waiting for the donor flow to fund this milestone and create its escrow.";
  }

  if (status === "funded") {
    return approvalCount >= 2
      ? "Quorum has been met. Release can proceed."
      : "Collect 2 of 3 committee approvals to unlock this milestone.";
  }

  if (status === "approved") {
    return "Quorum is locked in. The panel is preparing the release step.";
  }

  if (status === "released") {
    return "Funds have been released for this milestone. Voting is now final.";
  }

  return "Review milestone status and approvals.";
}

function SummaryCard({ label, value, tone }) {
  const tones = {
    slate: "border-gray-200 bg-white text-gray-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    green: "border-green-200 bg-green-50 text-green-900",
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.slate}`}>
      <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${style.badge}`}>
      {status}
    </span>
  );
}

export default function SignerPanel({
  milestones,
  wallets,
  updateMilestoneApproval,
  updateMilestoneReleased,
}) {
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(() => milestones[0]?.id ?? null);
  const [releasingMilestoneId, setReleasingMilestoneId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!milestones.length) {
      setSelectedMilestoneId(null);
      return;
    }

    const stillExists = milestones.some((milestone) => milestone.id === selectedMilestoneId);
    if (!stillExists) {
      setSelectedMilestoneId(milestones[0].id);
    }
  }, [milestones, selectedMilestoneId]);

  const selectedMilestone = useMemo(
    () => milestones.find((milestone) => milestone.id === selectedMilestoneId) ?? null,
    [milestones, selectedMilestoneId]
  );

  const approvalCount = countApprovals(selectedMilestone?.approvals);
  const isReleasing = releasingMilestoneId === selectedMilestone?.id;
  const isVotingLocked =
    !selectedMilestone ||
    selectedMilestone.status === "pending" ||
    selectedMilestone.status === "approved" ||
    selectedMilestone.status === "released" ||
    isReleasing;

  useEffect(() => {
    if (!selectedMilestone) return;
    if (selectedMilestone.status !== "approved") return;
    if (selectedMilestone.escrowSequence == null) return;
    if (releasingMilestoneId === selectedMilestone.id) return;

    let cancelled = false;

    async function releaseEscrow() {
      try {
        setError("");
        setMessage(`Releasing ${selectedMilestone.title} — submitting EscrowFinish to XRPL...`);
        setReleasingMilestoneId(selectedMilestone.id);

        const result = await finishEscrow({
          ownerAddress: wallets.fund.address,
          escrowSequence: selectedMilestone.escrowSequence,
          condition: selectedMilestone.condition,
          fulfillment: selectedMilestone.fulfillment,
          wallet: wallets.fund,
        });

        if (cancelled) return;

        const releaseTxHash = result?.result?.tx_json?.hash || null;
        updateMilestoneReleased(selectedMilestone.id, releaseTxHash);
        setMessage(`${selectedMilestone.title} released on-chain! Funds sent to beneficiary.`);
      } catch (releaseError) {
        if (cancelled) return;
        console.error("EscrowFinish failed:", releaseError);
        setError("EscrowFinish failed: " + (releaseError.message || "Unknown error"));
      } finally {
        if (!cancelled) {
          setReleasingMilestoneId(null);
        }
      }
    }

    releaseEscrow();

    return () => {
      cancelled = true;
    };
  }, [selectedMilestone, releasingMilestoneId, updateMilestoneReleased, wallets]);

  const pendingOrFundedCount = milestones.filter(
    (milestone) => milestone.status === "pending" || milestone.status === "funded"
  ).length;
  const approvedCount = milestones.filter((milestone) => milestone.status === "approved").length;
  const releasedCount = milestones.filter((milestone) => milestone.status === "released").length;

  const approvedMembers = COMMITTEE_MEMBERS.filter(
    (member) => selectedMilestone?.approvals?.[member.key]
  ).map((member) => member.label);

  const progressPercent = Math.min((approvalCount / 2) * 100, 100);
  const statusStyle = STATUS_STYLES[selectedMilestone?.status] ?? STATUS_STYLES.pending;

  function handleToggle(role) {
    if (!selectedMilestone || isVotingLocked) return;

    setError("");
    const nextValue = !selectedMilestone.approvals[role];
    updateMilestoneApproval(selectedMilestone.id, role, nextValue);
    setMessage(
      nextValue
        ? "Committee approval recorded locally in app state."
        : "Committee approval removed before quorum."
    );
  }

  if (!milestones.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-500">
        No milestones available for committee review.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">Committee Control</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">Milestone approval workflow</h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              Committee votes are tracked in local app state for the demo. Once a milestone reaches 2 approvals,
              this panel simulates the escrow release step.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <p className="font-medium text-gray-900">Release wallet</p>
            <p className="mt-1 font-mono text-xs text-gray-500">{wallets?.fund?.address || "Wallet unavailable"}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Pending / Funded" value={pendingOrFundedCount} tone="slate" />
        <SummaryCard label="Approved" value={approvedCount} tone="amber" />
        <SummaryCard label="Released" value={releasedCount} tone="green" />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="md:hidden">
          <label htmlFor="milestone-select" className="mb-2 block text-sm font-medium text-gray-700">
            Select milestone
          </label>
          <select
            id="milestone-select"
            value={selectedMilestoneId ?? ""}
            onChange={(event) => setSelectedMilestoneId(Number(event.target.value))}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500"
          >
            {milestones.map((milestone) => (
              <option key={milestone.id} value={milestone.id}>
                {milestone.title} - {countApprovals(milestone.approvals)}/3 - {milestone.status}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden gap-3 md:grid md:grid-cols-3">
          {milestones.map((milestone) => {
            const isActive = milestone.id === selectedMilestoneId;
            const approvals = countApprovals(milestone.approvals);

            return (
              <button
                key={milestone.id}
                type="button"
                onClick={() => setSelectedMilestoneId(milestone.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  isActive
                    ? "border-gray-900 bg-gray-900 text-white shadow-lg"
                    : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm font-semibold ${isActive ? "text-white" : "text-gray-900"}`}>
                      {milestone.title}
                    </p>
                    <p className={`mt-1 text-xs ${isActive ? "text-gray-300" : "text-gray-500"}`}>
                      {milestone.xrpAmount} XRP
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                      isActive ? "bg-white/15 text-white" : (STATUS_STYLES[milestone.status] ?? STATUS_STYLES.pending).badge
                    }`}
                  >
                    {milestone.status}
                  </span>
                </div>
                <p className={`mt-4 text-xs ${isActive ? "text-gray-300" : "text-gray-500"}`}>{approvals}/3 approvals</p>
              </button>
            );
          })}
        </div>
      </section>

      {selectedMilestone && (
        <>
          <section className={`rounded-2xl border p-6 ${statusStyle.panel}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-2xl font-semibold text-gray-900">{selectedMilestone.title}</h3>
                  <StatusBadge status={selectedMilestone.status} />
                </div>
                <p className="mt-3 text-sm leading-6 text-gray-700">{selectedMilestone.description}</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Milestone amount</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{selectedMilestone.xrpAmount} XRP</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-white/80 bg-white/75 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Approvals</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{approvalCount} / 3</p>
              </div>
              <div className="rounded-xl border border-white/80 bg-white/75 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Escrow sequence</p>
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  {selectedMilestone.escrowSequence ?? "Not created yet"}
                </p>
              </div>
              <div className="rounded-xl border border-white/80 bg-white/75 p-4 xl:col-span-2">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Condition hash</p>
                <p className="mt-2 break-all font-mono text-xs text-gray-700">
                  {selectedMilestone.condition ? truncateHex(selectedMilestone.condition, 22, 12) : "Not created yet"}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/80 bg-white/80 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Quorum tracker</p>
                  <p className="mt-2 text-lg font-semibold text-gray-900">{approvalCount} of 3 approvals recorded</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {approvedMembers.length ? `Approved by ${approvedMembers.join(", ")}.` : "No approvals recorded yet."}
                  </p>
                </div>
                <div className="text-sm font-medium text-gray-700">
                  {isReleasing ? "Releasing escrow..." : approvalCount >= 2 ? "Threshold met" : "Need 2 approvals"}
                </div>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${statusStyle.meter}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="mt-4 text-sm text-gray-700">{getStatusCopy(selectedMilestone.status, approvalCount, isReleasing)}</p>
            </div>

            {(message || error) && (
              <div
                className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
                  error
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-gray-200 bg-gray-100 text-gray-700"
                }`}
              >
                {error || message}
              </div>
            )}
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            {COMMITTEE_MEMBERS.map((member) => {
              const approved = Boolean(selectedMilestone.approvals?.[member.key]);
              const disabled = isVotingLocked;

              return (
                <article key={member.key} className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{member.label}</p>
                      <p className="mt-2 text-sm leading-6 text-gray-600">{member.blurb}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        approved ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {approved ? "Approved" : "Waiting"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggle(member.key)}
                    disabled={disabled}
                    className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      disabled
                        ? "cursor-not-allowed bg-gray-100 text-gray-400"
                        : approved
                          ? "bg-gray-900 text-white hover:bg-black"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {approved ? "Remove approval" : "Approve milestone"}
                  </button>

                  <p className="mt-3 text-xs text-gray-500">
                    {selectedMilestone.status === "pending"
                      ? "Escrow must exist before committee approvals can begin."
                      : isReleasing
                        ? "Voting is locked while the release step is being simulated."
                        : selectedMilestone.status === "released"
                          ? "Milestone already released. Committee voting is final."
                          : selectedMilestone.status === "approved"
                            ? "Quorum reached. The release step is in progress."
                            : "Votes can still be changed until quorum is reached."}
                  </p>
                </article>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
