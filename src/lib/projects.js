import { supabase } from "./supabase";

/**
 * Project data-access helpers.
 *
 * Purpose:
 * - read canonical project + milestone data from Supabase
 * - translate database column names into the frontend-friendly shape used by the app
 * - keep database access out of React components
 *
 * Important:
 * - This module returns persistent backend data only.
 * - It does NOT add frontend-only runtime fields such as:
 *   - rank
 *   - funded
 *   - escrowSequence
 *   - condition
 *   - fulfillment
 *   - approvals
 *
 * Those runtime fields should still be layered on in App.jsx or a higher-level
 * state adapter until the rest of the app is migrated to fully persisted state.
 */

/**
 * Convert one milestone row from the database shape into the frontend shape.
 *
 * Database shape:
 * - xrp_amount
 * - milestone_order
 *
 * Frontend shape:
 * - xrpAmount
 * - order
 *
 * @param {object} row
 * @returns {{
 *   id: string,
 *   title: string,
 *   description: string,
 *   xrpAmount: number,
 *   order: number,
 *   status: string,
 * }}
 */
function mapMilestone(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    xrpAmount: Number(row.xrp_amount),
    order: row.milestone_order,
    status: row.status,
  };
}

/**
 * Convert one project row from the database shape into the frontend shape.
 *
 * Database shape:
 * - funding_goal_xrp
 * - current_funded_xrp
 * - nested milestones[]
 *
 * Frontend shape:
 * - fundingGoal
 * - currentFunded
 * - milestones[]
 *
 * Notes:
 * - milestone rows are sorted by milestone_order before being returned
 * - numeric XRP values are normalized to JavaScript numbers
 *
 * @param {object} row
 * @returns {{
 *   id: string,
 *   title: string,
 *   description: string,
 *   fundingGoal: number,
 *   currentFunded: number,
 *   status: string,
 *   milestones: Array<{
 *     id: string,
 *     title: string,
 *     description: string,
 *     xrpAmount: number,
 *     order: number,
 *     status: string,
 *   }>,
 * }}
 */
function mapProject(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    fundingGoal: Number(row.funding_goal_xrp),
    currentFunded: Number(row.current_funded_xrp),
    status: row.status,
    milestones: (row.milestones ?? [])
      .slice()
      .sort((a, b) => a.milestone_order - b.milestone_order)
      .map(mapMilestone),
  };
}

/**
 * Load the full project catalog from Supabase.
 *
 * What it fetches:
 * - all rows from public.projects
 * - nested milestones for each project
 *
 * What it returns:
 * - an array of frontend-friendly project objects
 * - each project includes sorted milestones
 *
 * What it does NOT do:
 * - does not apply donor-specific ranking state
 * - does not merge committee votes
 * - does not attach XRPL escrow runtime fields
 * - does not filter to only funded projects
 *
 * Example:
 * ```js
 * import { getProjects } from "./lib/projects";
 *
 * const projects = await getProjects();
 * console.log(projects[0].title);
 * console.log(projects[0].milestones[0].xrpAmount);
 * ```
 *
 * Typical usage in React:
 * ```js
 * useEffect(() => {
 *   async function load() {
 *     try {
 *       const rows = await getProjects();
 *       setProjects(rows);
 *     } catch (error) {
 *       console.error("Failed to load projects:", error);
 *     }
 *   }
 *
 *   load();
 * }, []);
 * ```
 *
 * Error handling:
 * - throws the Supabase error if the query fails
 * - callers should wrap it in try/catch
 *
 * @returns {Promise<Array<{
 *   id: string,
 *   title: string,
 *   description: string,
 *   fundingGoal: number,
 *   currentFunded: number,
 *   status: string,
 *   milestones: Array<{
 *     id: string,
 *     title: string,
 *     description: string,
 *     xrpAmount: number,
 *     order: number,
 *     status: string,
 *   }>,
 * }>>}
 */
export async function getProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select(`
      id,
      title,
      description,
      funding_goal_xrp,
      current_funded_xrp,
      status,
      milestones (
        id,
        title,
        description,
        xrp_amount,
        milestone_order,
        status
      )
    `)
    .order("title", { ascending: true });

  if (error) {
    throw error;
  }

  return data.map(mapProject);
}
