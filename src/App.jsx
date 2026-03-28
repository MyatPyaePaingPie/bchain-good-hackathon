import { useState, useEffect, useCallback } from "react";
import "./app.css";
import { WALLETS } from "./data/wallets.js";
import { PROJECTS } from "./data/projects.js";
import { DEMO_DONORS } from "./data/demoDonors.js";
import { getBalance, disconnect } from "./xrpl/client.js";
import { getProjects } from "./lib/projects.js";
import DonorPanel from "./components/DonorPanel.jsx";
import SignerPanel from "./components/SignerPanel.jsx";
import MilestoneBoard from "./components/MilestoneBoard.jsx";
import FundDashboard from "./components/FundDashboard.jsx";
import NFTGallery from "./components/NFTGallery.jsx";

const ACTIVE_DONOR_STORAGE_KEY = "nonprofit-escrow:active-donor";
const DONOR_RANKINGS_STORAGE_PREFIX = "nonprofit-escrow:rankings:";

const TABS = [
  { id: "donor", label: "Donor" },
  { id: "committee", label: "Committee" },
  { id: "milestones", label: "Milestones" },
  { id: "dashboard", label: "Dashboard" },
  { id: "gallery", label: "Gallery" },
];

/** Enrich a raw milestone definition with runtime state fields */
function initMilestoneState(m, isFirst) {
  return {
    ...m,
    status: m.status ?? "pending", // pending | funded | voteable | approved | released
    escrowSequence: m.escrowSequence ?? null,
    condition: m.condition ?? null,
    fulfillment: m.fulfillment ?? null,
    escrowTxHash: m.escrowTxHash ?? null,
    releaseTxHash: m.releaseTxHash ?? null,
    approvals: m.approvals ?? { ngoRep: false, donorRep: false, communityAuditor: false },
  };
}

function buildProjectState(projectDefs) {
  return projectDefs.map((p) => ({
    ...p,
    rank: p.rank ?? null,
    funded: p.funded ?? false,
    milestones: p.milestones.map((m, i) => initMilestoneState(m, i === 0)),
  }));
}

function getStoredActiveDonorId() {
  if (typeof window === "undefined") return DEMO_DONORS[0].id;
  return window.localStorage.getItem(ACTIVE_DONOR_STORAGE_KEY) || DEMO_DONORS[0].id;
}

function getRankingsStorageKey(donorId) {
  return `${DONOR_RANKINGS_STORAGE_PREFIX}${donorId}`;
}

function readStoredRankedProjectIds(donorId) {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(getRankingsStorageKey(donorId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to read donor rankings from localStorage:", error);
    return [];
  }
}

function writeStoredRankedProjectIds(donorId, rankedProjectIds) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getRankingsStorageKey(donorId),
      JSON.stringify(rankedProjectIds)
    );
  } catch (error) {
    console.error("Failed to persist donor rankings to localStorage:", error);
  }
}

function applyDonorRankings(projectDefs, donorId) {
  const rankedProjectIds = readStoredRankedProjectIds(donorId);
  const rankMap = new Map(rankedProjectIds.map((projectId, index) => [projectId, index + 1]));

  return buildProjectState(projectDefs).map((project) => ({
    ...project,
    rank: rankMap.get(project.id) ?? null,
  }));
}

function extractRankedProjectIds(projects) {
  return projects
    .filter((project) => project.rank !== null)
    .sort((a, b) => a.rank - b.rank)
    .map((project) => project.id);
}

/** Determine the effective display status of a milestone based on trickle-down gating */
export function getEffectiveStatus(milestone, allMilestonesInProject) {
  // If pending or released/approved, return as-is
  if (milestone.status === "pending" || milestone.status === "released") return milestone.status;
  if (milestone.status === "approved") return "approved";

  // For funded milestones, check if they're voteable (trickle-down)
  if (milestone.status === "funded" || milestone.status === "voteable") {
    if (milestone.order === 1) return "voteable";
    const predecessor = allMilestonesInProject.find((m) => m.order === milestone.order - 1);
    if (predecessor && predecessor.status === "released") return "voteable";
    return "funded"; // locked — predecessor not released yet
  }

  return milestone.status;
}

export default function App() {
  const [activeTab, setActiveTab] = useState("donor");
  const [activeDonorId, setActiveDonorId] = useState(() => getStoredActiveDonorId());
  const [balances, setBalances] = useState({ donor: null, fund: null, beneficiary: null });

  // Projects state: full catalog with ranking + funded state
  const [projects, setProjects] = useState(() => applyDonorRankings(PROJECTS, getStoredActiveDonorId()));

  const activeDonor = DEMO_DONORS.find((donor) => donor.id === activeDonorId) ?? DEMO_DONORS[0];

  // Derived
  const fundedProjects = projects.filter((p) => p.funded);
  const rankedProjects = projects.filter((p) => p.rank !== null).sort((a, b) => a.rank - b.rank);

  // Balance polling
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

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        const dbProjects = await getProjects();
        if (!cancelled) {
          setProjects(applyDonorRankings(dbProjects, activeDonorId));
        }
      } catch (err) {
        console.error("Failed to load projects from Supabase, using local seed data:", err);
        if (!cancelled) {
          setProjects(applyDonorRankings(PROJECTS, activeDonorId));
        }
      }
    }

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACTIVE_DONOR_STORAGE_KEY, activeDonorId);
  }, [activeDonorId]);

  useEffect(() => {
    const rankedProjectIds = readStoredRankedProjectIds(activeDonorId);
    const rankMap = new Map(
      rankedProjectIds.map((projectId, index) => [projectId, index + 1])
    );

    setProjects((prev) =>
      prev.map((project) => ({
        ...project,
        rank: rankMap.get(project.id) ?? null,
      }))
    );
  }, [activeDonorId]);

  useEffect(() => {
    writeStoredRankedProjectIds(activeDonorId, extractRankedProjectIds(projects));
  }, [activeDonorId, projects]);

  // --- State updaters ---

  /** Toggle project ranking (donor preference 1st/2nd/3rd) */
  const toggleProjectRank = useCallback((projectId) => {
    setProjects((prev) => {
      const project = prev.find((p) => p.id === projectId);
      const isFull = project ? project.currentFunded >= project.fundingGoal : false;
      if (!project || project.funded || isFull) return prev;

      // If already ranked, remove and re-pack ranks
      if (project.rank !== null) {
        const removedRank = project.rank;
        return prev.map((p) => {
          if (p.id === projectId) return { ...p, rank: null };
          if (p.rank !== null && p.rank > removedRank) return { ...p, rank: p.rank - 1 };
          return p;
        });
      }

      // Enforce max 3 rankings
      const rankedCount = prev.filter((p) => p.rank !== null).length;
      if (rankedCount >= 3) return prev;

      return prev.map((p) =>
        p.id === projectId ? { ...p, rank: rankedCount + 1 } : p
      );
    });
  }, []);

  /** Mark selected projects as funded (after escrows created) */
  const markProjectFunded = useCallback((projectId) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, funded: true } : p))
    );
  }, []);

  /** After EscrowCreate succeeds for a milestone */
  const updateMilestoneEscrow = useCallback((projectId, milestoneId, { escrowSequence, condition, fulfillment, escrowTxHash }) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          milestones: p.milestones.map((m) => {
            if (m.id !== milestoneId) return m;
            // First milestone becomes voteable, others become funded (locked)
            const status = m.order === 1 ? "voteable" : "funded";
            return { ...m, status, escrowSequence, condition, fulfillment, escrowTxHash };
          }),
        };
      })
    );
  }, []);

  /** When a committee member approves a milestone */
  const updateMilestoneApproval = useCallback((projectId, milestoneId, role, approved) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          milestones: p.milestones.map((m) => {
            if (m.id !== milestoneId) return m;
            const newApprovals = { ...m.approvals, [role]: approved };
            const approvalCount = Object.values(newApprovals).filter(Boolean).length;
            const effectiveStatus = getEffectiveStatus(m, p.milestones);
            return {
              ...m,
              approvals: newApprovals,
              status: approvalCount >= 2 && effectiveStatus === "voteable" ? "approved" : m.status,
            };
          }),
        };
      })
    );
  }, []);

  /** After EscrowFinish succeeds — release milestone and unlock next in sequence */
  const updateMilestoneReleased = useCallback((projectId, milestoneId, releaseTxHash) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const releasedOrder = p.milestones.find((m) => m.id === milestoneId)?.order;
        return {
          ...p,
          milestones: p.milestones.map((m) => {
            // Release the approved milestone
            if (m.id === milestoneId) {
              return { ...m, status: "released", releaseTxHash };
            }
            // Unlock next milestone in sequence (trickle-down)
            if (m.order === releasedOrder + 1 && m.status === "funded") {
              return { ...m, status: "voteable" };
            }
            return m;
          }),
        };
      })
    );
    refreshBalances();
  }, [refreshBalances]);

  const [mintedNFTs, setMintedNFTs] = useState([]);
  const addMintedNFT = useCallback((nft) => {
    setMintedNFTs((prev) => [...prev, nft]);
  }, []);

  const sharedProps = {
    activeDonor,
    demoDonors: DEMO_DONORS,
    projects,
    fundedProjects,
    rankedProjects,
    wallets: WALLETS,
    balances,
    setActiveDonorId,
    toggleProjectRank,
    markProjectFunded,
    updateMilestoneEscrow,
    updateMilestoneApproval,
    updateMilestoneReleased,
    refreshBalances,
    addMintedNFT,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">GiveWithProof</h1>
          <p className="text-sm text-gray-500">Transparent fund management on XRPL — choose your impact</p>
        </div>
      </header>

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

      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === "donor" && <DonorPanel {...sharedProps} />}
        {activeTab === "committee" && <SignerPanel {...sharedProps} />}
        {activeTab === "milestones" && <MilestoneBoard {...sharedProps} />}
        {activeTab === "dashboard" && <FundDashboard {...sharedProps} />}
        {activeTab === "gallery" && <NFTGallery mintedNFTs={mintedNFTs} wallets={WALLETS} />}
      </main>
    </div>
  );
}
