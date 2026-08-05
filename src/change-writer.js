import {
  chmod,
  lstat,
  open,
  readFile,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { getGitStatus } from "./git.js";

function isOutsideRepository(
  repositoryPath,
  candidatePath,
) {
  const relativePath = path.relative(
    repositoryPath,
    candidatePath,
  );

  return (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  );
}

async function replaceFileAtomically(
  filePath,
  content,
  mode,
) {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${randomUUID()}.tmp`,
  );

  let temporaryFile;

  try {
    temporaryFile = await open(
      temporaryPath,
      "wx",
      mode,
    );

    await temporaryFile.writeFile(
      content,
      "utf8",
    );

    await temporaryFile.sync();
    await temporaryFile.close();
    temporaryFile = null;

    await chmod(temporaryPath, mode);
    await rename(temporaryPath, filePath);
  } catch (error) {
    if (temporaryFile) {
      await temporaryFile.close().catch(() => {});
    }

    await rm(temporaryPath, {
      force: true,
    }).catch(() => {});

    throw error;
  }
}

export async function applyChangeDrafts(
  draftedWorkOrder,
  {
    gitStatusReader = getGitStatus,
    fileReplacer = replaceFileAtomically,
    postWriteValidator = async () => null,
  } = {},
) {
  if (
    !draftedWorkOrder ||
    draftedWorkOrder.status !== "drafted" ||
    !Array.isArray(draftedWorkOrder.drafts) ||
    draftedWorkOrder.drafts.length === 0
  ) {
    throw new Error(
      "Kontrolliertes Schreiben benötigt einen Arbeitsauftrag mit Entwürfen.",
    );
  }

  const repositoryPath = await realpath(
    draftedWorkOrder.repositoryPath,
  );

  const gitStatus = await gitStatusReader(
    repositoryPath,
  );

  if (!gitStatus.clean) {
    throw new Error(
      "Das Repository enthält bereits Änderungen. Schreiben wurde abgebrochen.",
    );
  }

  const preparedFiles = [];

  for (const draft of draftedWorkOrder.drafts) {
    const candidatePath = path.resolve(
      repositoryPath,
      draft.file,
    );

    if (
      isOutsideRepository(
        repositoryPath,
        candidatePath,
      )
    ) {
      throw new Error(
        `Dateipfad liegt außerhalb des Repositorys: ${draft.file}`,
      );
    }

    const fileStats = await lstat(
      candidatePath,
    );

    if (fileStats.isSymbolicLink()) {
      throw new Error(
        `Symbolische Verknüpfungen dürfen nicht geschrieben werden: ${draft.file}`,
      );
    }

    if (!fileStats.isFile()) {
      throw new Error(
        `Ziel ist keine reguläre Datei: ${draft.file}`,
      );
    }

    const resolvedFilePath = await realpath(
      candidatePath,
    );

    if (
      isOutsideRepository(
        repositoryPath,
        resolvedFilePath,
      )
    ) {
      throw new Error(
        `Datei verweist aus dem Repository: ${draft.file}`,
      );
    }

    const currentContent = await readFile(
      resolvedFilePath,
      "utf8",
    );

    if (
      currentContent !== draft.originalContent
    ) {
      throw new Error(
        `Datei wurde seit der Analyse verändert: ${draft.file}`,
      );
    }

    preparedFiles.push({
      file: draft.file,
      absolutePath: resolvedFilePath,
      originalContent: draft.originalContent,
      proposedContent: draft.proposedContent,
      mode: fileStats.mode,
    });
  }

  const appliedFiles = [];
  let postWriteResult = null;

  try {
    for (const preparedFile of preparedFiles) {
      await fileReplacer(
        preparedFile.absolutePath,
        preparedFile.proposedContent,
        preparedFile.mode,
      );

      appliedFiles.push(preparedFile);
    }

    postWriteResult = await postWriteValidator(
      Object.freeze({
        repositoryPath,
        appliedFiles: Object.freeze(
          appliedFiles.map((file) => file.file),
        ),
      }),
    );
  } catch (writeError) {
    const rollbackErrors = [];

    for (
      const appliedFile of [...appliedFiles].reverse()
    ) {
      try {
        await fileReplacer(
          appliedFile.absolutePath,
          appliedFile.originalContent,
          appliedFile.mode,
        );
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }

    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [
          writeError,
          ...rollbackErrors,
        ],
        "Schreiben und vollständiges Zurücksetzen sind fehlgeschlagen.",
      );
    }

    throw new Error(
      `Schreiben fehlgeschlagen; Änderungen wurden zurückgesetzt: ${writeError.message}`,
      {
        cause: writeError,
      },
    );
  }

  return Object.freeze({
    ...draftedWorkOrder,
    status: "applied",
    appliedFiles: Object.freeze(
      appliedFiles.map((file) => file.file),
    ),
    postWriteResult,
  });
}
