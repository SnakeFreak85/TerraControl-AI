import {
  lstat,
  readFile,
  realpath,
} from "node:fs/promises";
import path from "node:path";

import {
  isReadableTextFile,
  repositoryLimits,
} from "./repository-policy.js";

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

export async function readRepositoryFiles(
  repositoryPath,
  relativePaths,
  {
    maximumFileSizeBytes =
      repositoryLimits.maximumFileSizeBytes,
    maximumTotalContentBytes =
      repositoryLimits.maximumTotalContentBytes,
  } = {},
) {
  if (!Array.isArray(relativePaths)) {
    throw new TypeError(
      "relativePaths muss ein Array sein.",
    );
  }

  const resolvedRepositoryPath = await realpath(
    repositoryPath,
  );

  const files = [];

  const skipped = {
    unsupportedFiles: 0,
    oversizedFiles: 0,
    totalLimitFiles: 0,
    symbolicLinks: 0,
    binaryFiles: 0,
  };

  let totalContentBytes = 0;

  for (const relativePath of new Set(relativePaths)) {
    if (
      typeof relativePath !== "string" ||
      relativePath.length === 0
    ) {
      throw new TypeError(
        "Jeder relative Dateipfad muss eine Zeichenkette sein.",
      );
    }

    if (
      !isReadableTextFile(
        path.basename(relativePath),
      )
    ) {
      skipped.unsupportedFiles += 1;
      continue;
    }

    const candidatePath = path.resolve(
      resolvedRepositoryPath,
      relativePath,
    );

    if (
      isOutsideRepository(
        resolvedRepositoryPath,
        candidatePath,
      )
    ) {
      throw new Error(
        `Pfad liegt außerhalb des Repositorys: ${relativePath}`,
      );
    }

    const linkStats = await lstat(candidatePath);

    if (linkStats.isSymbolicLink()) {
      skipped.symbolicLinks += 1;
      continue;
    }

    if (!linkStats.isFile()) {
      skipped.unsupportedFiles += 1;
      continue;
    }

    const resolvedFilePath = await realpath(
      candidatePath,
    );

    if (
      isOutsideRepository(
        resolvedRepositoryPath,
        resolvedFilePath,
      )
    ) {
      throw new Error(
        `Datei verweist aus dem Repository: ${relativePath}`,
      );
    }

    if (linkStats.size > maximumFileSizeBytes) {
      skipped.oversizedFiles += 1;
      continue;
    }

    const fileBuffer = await readFile(
      resolvedFilePath,
    );

    if (fileBuffer.includes(0)) {
      skipped.binaryFiles += 1;
      continue;
    }

    if (
      totalContentBytes + fileBuffer.length >
      maximumTotalContentBytes
    ) {
      skipped.totalLimitFiles += 1;
      continue;
    }

    totalContentBytes += fileBuffer.length;

    files.push(
      Object.freeze({
        path: relativePath
          .split(path.sep)
          .join("/"),
        sizeBytes: fileBuffer.length,
        content: fileBuffer.toString("utf8"),
      }),
    );
  }

  return Object.freeze({
    files: Object.freeze(files),
    totalContentBytes,
    skipped: Object.freeze(skipped),
  });
}
