import {
  createGitCommit,
  getGitChangedFiles,
  getStagedGitFiles,
  stageGitFiles,
  unstageGitFiles,
} from "./git.js";

function sameFiles(
  actualFiles,
  expectedFiles,
) {
  const actual = [...actualFiles].sort();
  const expected = [...expectedFiles].sort();

  return (
    actual.length === expected.length &&
    actual.every(
      (file, index) =>
        file === expected[index],
    )
  );
}

export async function executeCommitPlan(
  commitPlan,
  {
    fileStager = stageGitFiles,
    stagedFilesReader =
      getStagedGitFiles,
    commitCreator = createGitCommit,
    changedFilesReader =
      getGitChangedFiles,
    fileUnstager = unstageGitFiles,
  } = {},
) {
  if (
    !commitPlan ||
    commitPlan.status !==
      "ready-to-commit" ||
    !Array.isArray(commitPlan.files) ||
    commitPlan.files.length === 0
  ) {
    throw new Error(
      "Ein geprüfter Commit-Plan wird benötigt.",
    );
  }

  let filesWereStaged = false;
  let commitWasCreated = false;

  try {
    await fileStager(
      commitPlan.repositoryPath,
      commitPlan.files,
    );

    filesWereStaged = true;

    const stagedFiles =
      await stagedFilesReader(
        commitPlan.repositoryPath,
      );

    if (
      !sameFiles(
        stagedFiles,
        commitPlan.files,
      )
    ) {
      throw new Error(
        "Die vorgemerkten Dateien entsprechen nicht exakt dem Commit-Plan.",
      );
    }

    const commit = await commitCreator(
      commitPlan.repositoryPath,
      commitPlan.message,
    );

    commitWasCreated = true;

    const remainingStagedFiles =
      await stagedFilesReader(
        commitPlan.repositoryPath,
      );

    const remainingChanges =
      await changedFilesReader(
        commitPlan.repositoryPath,
      );

    if (
      remainingStagedFiles.length > 0 ||
      remainingChanges.length > 0
    ) {
      throw new Error(
        "Das Repository ist nach dem Commit nicht sauber. Möglicherweise hat ein Git-Hook zusätzliche Änderungen erzeugt.",
      );
    }

    return Object.freeze({
      ...commitPlan,
      status: "committed",
      commitSha: commit.commitSha,
      commitSubject:
        commit.commitSubject,
    });
  } catch (commitError) {
    if (
      filesWereStaged &&
      !commitWasCreated
    ) {
      try {
        await fileUnstager(
          commitPlan.repositoryPath,
          commitPlan.files,
        );
      } catch (unstageError) {
        throw new AggregateError(
          [
            commitError,
            unstageError,
          ],
          "Commit und Aufheben der Git-Vormerkung sind fehlgeschlagen.",
        );
      }
    }

    throw commitError;
  }
}
