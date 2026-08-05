import { executeChangeDrafts } from "./change-executor.js";
import {
  revertAppliedChangeDrafts,
} from "./change-writer.js";
import { readRepositoryFiles } from "./content-reader.js";
import {
  getGitChangedFiles,
  getGitDiff,
} from "./git.js";
import {
  createValidationPlan,
} from "./validation-plan.js";
import {
  runValidationPlan,
} from "./validation-runner.js";

function verifyExpectedGitChanges(
  changedFiles,
  expectedFiles,
) {
  const expectedFileSet = new Set(
    expectedFiles,
  );

  if (
    changedFiles.length !==
    expectedFileSet.size
  ) {
    throw new Error(
      "Die Validierung hat unerwartete Git-Änderungen erzeugt.",
    );
  }

  for (const change of changedFiles) {
    if (
      change.status !== " M" ||
      !expectedFileSet.has(change.file)
    ) {
      throw new Error(
        `Unerwartete Git-Änderung nach der Validierung: ${change.status} ${change.file}`,
      );
    }
  }
}

function verifyDraftContents(
  appliedWorkOrder,
  readableContent,
) {
  const contentByFile = new Map(
    readableContent.files.map((file) => [
      file.path,
      file.content,
    ]),
  );

  for (
    const draft of
    appliedWorkOrder.drafts
  ) {
    if (
      contentByFile.get(draft.file) !==
      draft.proposedContent
    ) {
      throw new Error(
        `Validierung hat den vorgeschlagenen Inhalt verändert: ${draft.file}`,
      );
    }
  }
}

export async function executeValidatedChanges(
  draftedWorkOrder,
  project,
  {
    changeExecutionOptions,
    validationRunOptions,
    validationRunner =
      runValidationPlan,
    changedFilesReader =
      getGitChangedFiles,
    contentReader =
      readRepositoryFiles,
    diffReader = getGitDiff,
    changeReverter =
      revertAppliedChangeDrafts,
  } = {},
) {
  let appliedWorkOrder = null;

  try {
    appliedWorkOrder =
      await executeChangeDrafts(
        draftedWorkOrder,
        changeExecutionOptions,
      );

    const validationPlan =
      createValidationPlan(
        appliedWorkOrder,
        project,
      );

    const validation =
      await validationRunner(
        validationPlan,
        validationRunOptions,
      );

    const changedFiles =
      await changedFilesReader(
        appliedWorkOrder.repositoryPath,
      );

    verifyExpectedGitChanges(
      changedFiles,
      appliedWorkOrder.appliedFiles,
    );

    const readableContent =
      await contentReader(
        appliedWorkOrder.repositoryPath,
        appliedWorkOrder.appliedFiles,
      );

    verifyDraftContents(
      appliedWorkOrder,
      readableContent,
    );

    const verifiedDiff = await diffReader(
      appliedWorkOrder.repositoryPath,
      appliedWorkOrder.appliedFiles,
    );

    if (
      verifiedDiff.empty ||
      verifiedDiff.text.length === 0
    ) {
      throw new Error(
        "Der Git-Diff ist nach der Validierung leer.",
      );
    }

    return Object.freeze({
      ...appliedWorkOrder,
      status: "validated",
      validation,
      diff: verifiedDiff,
    });
  } catch (validationError) {
    if (!appliedWorkOrder) {
      throw validationError;
    }

    try {
      await changeReverter(
        appliedWorkOrder,
      );
    } catch (revertError) {
      throw new AggregateError(
        [
          validationError,
          revertError,
        ],
        "Validierung und automatisches Rücksetzen sind fehlgeschlagen.",
      );
    }

    throw new Error(
      `Validierung fehlgeschlagen; geplante Änderungen wurden zurückgesetzt: ${validationError.message}`,
      {
        cause: validationError,
      },
    );
  }
}
