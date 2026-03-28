import { useState, useEffect } from "react";
import { getAccountNFTs } from "../xrpl/nft";

const EXPLORER_BASE = "https://testnet.xrpl.org";

function truncAddr(addr) {
  return addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "—";
}

function truncHash(hash) {
  if (!hash) return "—";
  return hash.slice(0, 8) + "…" + hash.slice(-6);
}

function formatTimestamp(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function NFTokenLink({ tokenId }) {
  return (
    <a
      href={`${EXPLORER_BASE}/nft/${tokenId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs text-blue-600 hover:underline break-all"
    >
      {tokenId.slice(0, 12)}…{tokenId.slice(-6)}
    </a>
  );
}

function DonationCard({ nft }) {
  const m = nft.metadata ?? {};
  return (
    <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
      <div className="bg-blue-50 px-4 py-2 border-b border-blue-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
          Proof of Donation
        </span>
        <NFTokenLink tokenId={nft.NFTokenID} />
      </div>
      <div className="px-4 py-3 space-y-2 text-sm">
        <Row label="Donor" value={truncAddr(m.donor)} title={m.donor} />
        <Row label="Total donated" value={m.totalXRP != null ? `${m.totalXRP} XRP` : "—"} />
        <Row label="Milestones funded" value={m.milestones ?? "—"} />
        <Row label="Fund wallet" value={truncAddr(m.fund)} title={m.fund} />
        <Row label="Timestamp" value={formatTimestamp(m.timestamp)} />
      </div>
    </div>
  );
}

function ImpactCard({ nft }) {
  const m = nft.metadata ?? {};
  return (
    <div className="bg-white rounded-lg border border-green-200 overflow-hidden">
      <div className="bg-green-50 px-4 py-2 border-b border-green-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">
          Proof of Impact
        </span>
        <NFTokenLink tokenId={nft.NFTokenID} />
      </div>
      <div className="px-4 py-3 space-y-2 text-sm">
        <Row label="Milestone" value={m.mid != null ? `#${m.mid}` : "—"} />
        <Row label="XRP released" value={m.xrp != null ? `${m.xrp} XRP` : "—"} />
        <Row label="Beneficiary" value={truncAddr(m.to)} title={m.to} />
        <div className="flex justify-between gap-2">
          <span className="text-gray-500">Escrow tx</span>
          {m.esc ? (
            <a
              href={`${EXPLORER_BASE}/transactions/${m.esc}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-mono text-xs"
            >
              {truncHash(m.esc)}
            </a>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-gray-500">Release tx</span>
          {m.rel ? (
            <a
              href={`${EXPLORER_BASE}/transactions/${m.rel}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:underline font-mono text-xs"
            >
              {truncHash(m.rel)}
            </a>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, title }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium truncate" title={title}>
        {value}
      </span>
    </div>
  );
}

function SectionHeader({ title, count, colorClass }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
        {count}
      </span>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="bg-white rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-400 text-sm">
      {message}
    </div>
  );
}

export default function NFTGallery({ mintedNFTs = [], wallets }) {
  const [onChainNFTs, setOnChainNFTs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchNFTs() {
      try {
        const fundAddr = wallets?.fund?.address;
        if (!fundAddr) { setLoading(false); return; }
        const nfts = await getAccountNFTs(fundAddr);
        if (!cancelled) setOnChainNFTs(nfts);
      } catch (err) {
        console.error("Failed to fetch on-chain NFTs:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchNFTs();
    const interval = setInterval(fetchNFTs, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [wallets?.fund?.address]);

  // Merge: session-minted NFTs + on-chain NFTs (dedupe by token ID)
  const seen = new Set();
  const allNFTs = [];
  for (const nft of [...mintedNFTs, ...onChainNFTs]) {
    const id = nft.NFTokenID;
    if (id && !seen.has(id)) { seen.add(id); allNFTs.push(nft); }
  }

  const donationNFTs = allNFTs.filter((n) => n.metadata?.type === "proof-of-donation");
  const impactNFTs = allNFTs.filter((n) => n.metadata?.t === "poi");

  if (loading) {
    return <div className="text-center text-gray-400 py-10">Loading NFTs from testnet...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Proof-of-Donation section */}
      <div>
        <SectionHeader
          title="Proof-of-Donation NFTs"
          count={donationNFTs.length}
          colorClass="bg-blue-100 text-blue-700"
        />
        {donationNFTs.length === 0 ? (
          <EmptyState message="No donation NFTs yet. Fund a project in the Donor tab to receive one." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {donationNFTs.map((nft) => (
              <DonationCard key={nft.NFTokenID} nft={nft} />
            ))}
          </div>
        )}
      </div>

      {/* Proof-of-Impact section */}
      <div>
        <SectionHeader
          title="Proof-of-Impact NFTs"
          count={impactNFTs.length}
          colorClass="bg-green-100 text-green-700"
        />
        {impactNFTs.length === 0 ? (
          <EmptyState message="No impact NFTs yet. Impact NFTs are minted when milestones are released." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {impactNFTs.map((nft) => (
              <ImpactCard key={nft.NFTokenID} nft={nft} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
