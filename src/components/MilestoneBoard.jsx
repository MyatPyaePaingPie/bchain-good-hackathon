// TODO: Andrew — replace this with your MilestoneBoard implementation
// Props available: { fundedProjects, wallets, balances }
// Use getEffectiveStatus() from App.jsx for trickle-down display
// See PLAN.md for component spec
import { getEffectiveStatus } from "../App.jsx";

const STATUS_STYLES = {
  pending:  "bg-gray-100 text-gray-600",
  funded:   "bg-gray-100 text-gray-500",
  voteable: "bg-indigo-100 text-indigo-700",
  approved: "bg-yellow-100 text-yellow-700",
  released: "bg-green-100 text-green-700",
};

export default function MilestoneBoard({ fundedProjects }) {
  if (fundedProjects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-500">
        No funded projects yet. Go to Donor tab to select and fund projects.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {fundedProjects.map((project) => (
        <div key={project.id} className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-1">{project.title}</h3>
          <p className="text-sm text-gray-500 mb-4">{project.description}</p>

          <div className="flex gap-3 items-start">
            {project.milestones.map((m, i) => {
              const effective = getEffectiveStatus(m, project.milestones);
              const label = effective === "funded" ? "locked" : effective;
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <div className={`flex-1 min-w-[140px] p-3 rounded-lg border ${
                    effective === "released" ? "border-green-300 bg-green-50" :
                    effective === "voteable" ? "border-indigo-300 bg-indigo-50" :
                    "border-gray-200 bg-gray-50"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400 font-mono">M{m.order}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLES[effective]}`}>
                        {label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{m.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{m.xrpAmount} XRP</p>
                  </div>
                  {i < project.milestones.length - 1 && (
                    <span className="text-gray-300 text-lg">→</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
