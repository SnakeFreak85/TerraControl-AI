import {
  createLocalProblemAnalysis,
} from "./problem-analysis.js";
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
  formatChangePlanPreview,
} from "./plan-preview.js";
import {
  createWorkOrder,
} from "./work-order.js";

const localSelectionLimit = 3;

export async function planRepositoryFix(
  {
    problem,
    repositoryPath,
    repositoryScan,
    readableContent,
    project,
  },
  _ollamaClient,
  {
    workOrderOptions,
  } = {},
) {
  const analysis =
    createLocalProblemAnalysis({
      problem,
      project,
    });

  const candidates =
    rankRelevantFiles({
      analysis,
      repositoryScan,
      readableContent,
    });

  if (candidates.length === 0) {
    throw new Error(
      "Für das Problem wurden keine passenden realen Repository-Dateien gefunden.",
    );
  }

  const selectedFiles =
    candidates
      .slice(0, localSelectionLimit)
      .map((candidate) => ({
        path: candidate.path,
        objective:
          `Problem bearbeiten: ${analysis.goal}`,
        reason:
          candidate.reasons.join("; ") ||
          "Datei wurde lokal als relevant eingestuft.",
      }));

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
      selectedFiles.map(
        (selection) => selection.path,
      ),
      repositoryScan,
    );

  const plannedWorkOrder =
    createChangePlan(
      selectedWorkOrder,
      {
        changes: selectedFiles.map(
          (selection) => ({
            file: selection.path,
            objective: selection.objective,
            reason: selection.reason,
          }),
        ),
        validationScripts:
          analysis.validationScripts,
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
    analysis,
    candidates:
      Object.freeze(
        candidates.map(
          (candidate) =>
            Object.freeze({
              path: candidate.path,
              score: candidate.score,
            }),
        ),
      ),
    metrics: Object.freeze({
      mode: "local",
      modelCalls: 0,
    }),
  });
}