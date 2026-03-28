// Project catalog for the nonprofit
// Each project has sequential milestones and a funding cap
// currentFunded simulates other donors having already contributed (for demo)

export const PROJECTS = [
  {
    id: "clean-water",
    title: "Clean Water Initiative",
    description: "Provide safe drinking water to 10 rural communities",
    fundingGoal: 225,
    currentFunded: 0,
    milestones: [
      { id: "cw-1", title: "Purchase Water Filters", description: "Buy 500 portable water filters", xrpAmount: 100, order: 1 },
      { id: "cw-2", title: "Distribution & Logistics", description: "Transport filters to 10 villages", xrpAmount: 75, order: 2 },
      { id: "cw-3", title: "Community Training", description: "Train local volunteers on filter maintenance", xrpAmount: 50, order: 3 },
    ],
  },
  {
    id: "solar-school",
    title: "Solar-Powered School",
    description: "Install solar panels and equipment at a rural school",
    fundingGoal: 250,
    currentFunded: 250, // FULL — will be skipped in cascade
    milestones: [
      { id: "ss-1", title: "Panel Procurement", description: "Purchase 20 solar panels + inverters", xrpAmount: 150, order: 1 },
      { id: "ss-2", title: "Installation", description: "Install panels and wire classrooms", xrpAmount: 100, order: 2 },
    ],
  },
  {
    id: "medical-clinic",
    title: "Mobile Medical Clinic",
    description: "Fund a mobile clinic to serve underserved areas",
    fundingGoal: 400,
    currentFunded: 0,
    milestones: [
      { id: "mc-1", title: "Vehicle & Equipment", description: "Purchase and outfit a medical van", xrpAmount: 200, order: 1 },
      { id: "mc-2", title: "Staff Training", description: "Train 5 community health workers", xrpAmount: 80, order: 2 },
      { id: "mc-3", title: "First Quarter Operations", description: "Cover fuel, supplies, and salaries for 3 months", xrpAmount: 120, order: 3 },
    ],
  },
  {
    id: "school-meals",
    title: "School Meals Program",
    description: "Provide daily meals to 200 students for one semester",
    fundingGoal: 200,
    currentFunded: 200, // FULL — will be skipped in cascade
    milestones: [
      { id: "sm-1", title: "Kitchen Setup", description: "Build a school kitchen and purchase equipment", xrpAmount: 90, order: 1 },
      { id: "sm-2", title: "Food Supply Contract", description: "Secure 6-month food supply agreement", xrpAmount: 110, order: 2 },
    ],
  },
  {
    id: "reforestation",
    title: "Community Reforestation",
    description: "Plant 10,000 native trees across deforested land",
    fundingGoal: 150,
    currentFunded: 0,
    milestones: [
      { id: "rf-1", title: "Seedling Nursery", description: "Establish nursery and grow 10,000 seedlings", xrpAmount: 60, order: 1 },
      { id: "rf-2", title: "Planting Campaign", description: "Organize community planting over 2 weekends", xrpAmount: 40, order: 2 },
      { id: "rf-3", title: "Monitoring & Care", description: "6-month monitoring, replanting failures", xrpAmount: 50, order: 3 },
    ],
  },
];
