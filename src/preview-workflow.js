import { createChangePlan } from "./change-plan.js";
import { selectRelevantFiles } from "./file-selection.js";
import { formatChangePlanPreview } from "./plan-preview.js";
import { createWorkOrder } from "./work-order.js";

export function createPreviewWorkflow(
  {
    problem,
    repositoryPath,
    relevantFiles,
    changes,
    validationScripts = [],
  },
  {
    repositoryScan,
    project,
    workOrderOptions,
  },
) {
  const createdWorkOrder = createWorkOrder(
    {
      problem,
      repositoryPath,
    },
    workOrderOptions,
  );

  const selectedWorkOrder = selectRelevantFiles(
    createdWorkOrder,
    relevantFiles,
    repositoryScan,
  );

  const plannedWorkOrder = createChangePlan(
    selectedWorkOrder,
    {
      changes,
      validationScripts,
    },
    project,
  );

  const preview = formatChangePlanPreview(
    plannedWorkOrder,
  );

  return Object.freeze({
    workOrder: plannedWorkOrder,
    preview,
  });
}
