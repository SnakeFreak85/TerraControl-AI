import {
  analyzeProblem,
} from "./problem-analysis.js";
import {
  buildCandidateContext,
} from "./candidate-context.js";
import {
  createChangePlan,
} from "./change-plan.js";
import {
  rankRelevantFiles,
} from "./file-ranking.js";
import {
  selectRelevantFiles,
} from "./file-selection.js";
import {
  selectFilesWithModel,
} from "./model-file-selection.js";
import {
  formatChangePlanPreview,
} from "./plan-preview.js";
import {
  createWorkOrder,
} from "./work-order.js";

export async function planRepositoryFix(
  {
    problem,
    repositoryPath,
    repositoryScan,
    readableContent,
    project,
  },
  ollamaClient,
  {
    workOrderOptions,
  } = {},
) {
  const problemResult =
    await analyzeProblem(
      {
        problem,
        project,
      },
      ollamaClient,
    );

  const candidates =
    rankRelevantFiles({
      analysis:
        problemResult.analysis,
      repositoryScan,
      readableContent,
    });

  if (candidates.length === 0) {
    throw new Error(
      "Für das Problem wurden keine passenden realen Repository-Dateien gefunden.",
    );
  }

  const candidateContext =
    buildCandidateContext({
      analysis:
        problemResult.analysis,
      candidates,
      readableContent,
    });

  const selectionResult =
    await selectFilesWithModel(
      {
        analysis:
          problemResult.analysis,
        candidateContext,
      },
      ollamaClient,
    );

  const createdWorkOrder =
    createWorkOrder(
      {
        problem,
        repositoryPath,
      },
      workOrderOptions,
    );

  const selectedWorkOrder =
    selectRelevantFiles(
      createdWorkOrder,
      selectionResult
        .selectedFiles
        .map(
          (selection) =>
            selection.path,
        ),
      repositoryScan,
    );

  const plannedWorkOrder =
    createChangePlan(
      selectedWorkOrder,
      {
        changes:
          selectionResult
            .selectedFiles
            .map(
              (selection) => ({
                file:
                  selection.path,
                objective:
                  selection.objective,
                reason:
                  selection.reason,
              }),
            ),
        validationScripts:
          problemResult
            .analysis
            .validationScripts,
      },
      project,
    );

  return Object.freeze({
    workOrder:
      plannedWorkOrder,
    preview:
      formatChangePlanPreview(
        plannedWorkOrder,
      ),
    analysis:
      problemResult.analysis,
    candidates:
      Object.freeze(
        candidates.map(
          (candidate) =>
            Object.freeze({
              path:
                candidate.path,
              score:
                candidate.score,
            }),
        ),
      ),
    metrics: Object.freeze({
      problemAnalysis:
        problemResult.metrics,
      fileSelection:
        selectionResult.metrics,
    }),
  });
}
