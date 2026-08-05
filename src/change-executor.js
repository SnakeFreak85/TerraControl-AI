import {
  applyChangeDrafts,
} from "./change-writer.js";
import { getGitDiff } from "./git.js";

export async function executeChangeDrafts(
  draftedWorkOrder,
  {
    gitStatusReader,
    gitDiffReader = getGitDiff,
    fileReplacer,
  } = {},
) {
  const writerOptions = {
    postWriteValidator: async ({
      repositoryPath,
      appliedFiles,
    }) => {
      const diff = await gitDiffReader(
        repositoryPath,
        appliedFiles,
      );

      if (
        !diff ||
        diff.empty ||
        typeof diff.text !== "string" ||
        diff.text.length === 0
      ) {
        throw new Error(
          "Nach dem Schreiben wurde kein Git-Diff erzeugt.",
        );
      }

      const expectedFiles = new Set(
        appliedFiles,
      );

      const diffFiles = new Set(
        diff.files,
      );

      if (
        expectedFiles.size !== diffFiles.size ||
        [...expectedFiles].some(
          (file) => !diffFiles.has(file),
        )
      ) {
        throw new Error(
          "Der Git-Diff umfasst nicht exakt die geschriebenen Dateien.",
        );
      }

      return diff;
    },
  };

  if (gitStatusReader) {
    writerOptions.gitStatusReader =
      gitStatusReader;
  }

  if (fileReplacer) {
    writerOptions.fileReplacer =
      fileReplacer;
  }

  const appliedWorkOrder =
    await applyChangeDrafts(
      draftedWorkOrder,
      writerOptions,
    );

  const {
    postWriteResult,
    ...workOrderWithoutInternalResult
  } = appliedWorkOrder;

  return Object.freeze({
    ...workOrderWithoutInternalResult,
    status: "diff-verified",
    diff: postWriteResult,
  });
}
