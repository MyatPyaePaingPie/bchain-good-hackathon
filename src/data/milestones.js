// TODO: Tianqi — replace these with your milestone definitions
// See PLAN.md for the data shape
export const MILESTONES = [
  {
    id: 1,
    title: "Purchase Water Filters",
    description: "Buy 500 portable water filters for rural communities",
    xrpAmount: 100,
  },
  {
    id: 2,
    title: "Distribution & Logistics",
    description: "Transport filters to 10 villages in the target region",
    xrpAmount: 75,
  },
  {
    id: 3,
    title: "Training Program",
    description: "Train local volunteers on filter maintenance",
    xrpAmount: 50,
  },
];

export const TOTAL_FUNDING_GOAL = MILESTONES.reduce((sum, m) => sum + m.xrpAmount, 0);