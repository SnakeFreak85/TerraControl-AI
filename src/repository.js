import {
  access,
  readdir,
  stat,
} from "node:fs/promises";
import path from "node:path";

import {
  isSensitiveFile,
  repositoryLimits,
  shouldIgnoreDirectory,
} from "./repository-policy.js";

async function verifyRepositoryDirectory(repositoryPath) {
  await access(repositoryPath);

  const repositoryStats = await stat(repositoryPath);

  if (!repositoryStats.isDirectory()) {
    throw new Error(
      `Der Repository-Pfad ist kein Verzeichnis: ${repositoryPath}`,
    );
  }
}

function toRepositoryPath(relativePath) {
  return relativePath
    .split(path.sep)
    .join("/");
}

export async function inspectRepository(repositoryPath) {
  await verifyRepositoryDirectory(repositoryPath);

  const directoryEntries = await readdir(repositoryPath, {
    withFileTypes: true,
  });

  const entries = directoryEntries
    .filter(
      (entry) =>
        !entry.isDirectory() ||
        !shouldIgnoreDirectory(entry.name),
    )
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "Ordner" : "Datei",
    }))
    .sort((left, right) =>
      left.name.localeCompare(right.name),
    );

  return Object.freeze({
    path: repositoryPath,
    entries,
  });
}

export async function scanRepository(
  repositoryPath,
  {
    maximumFiles = repositoryLimits.maximumFiles,
    maximumFileSizeBytes =
      repositoryLimits.maximumFileSizeBytes,
  } = {},
) {
  await verifyRepositoryDirectory(repositoryPath);

  const files = [];

  const skipped = {
    directories: 0,
    sensitiveFiles: 0,
    oversizedFiles: 0,
    symbolicLinks: 0,
  };

  let truncated = false;

  async function walk(currentDirectory) {
    const entries = await readdir(currentDirectory, {
      withFileTypes: true,
    });

    entries.sort((left, right) =>
      left.name.localeCompare(right.name),
    );

    for (const entry of entries) {
      if (files.length >= maximumFiles) {
        truncated = true;
        return;
      }

      const absolutePath = path.join(
        currentDirectory,
        entry.name,
      );

      const relativePath = path.relative(
        repositoryPath,
        absolutePath,
      );

      if (entry.isSymbolicLink()) {
        skipped.symbolicLinks += 1;
        continue;
      }

      if (entry.isDirectory()) {
        if (shouldIgnoreDirectory(entry.name)) {
          skipped.directories += 1;
          continue;
        }

        await walk(absolutePath);

        if (truncated) {
          return;
        }

        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (isSensitiveFile(entry.name)) {
        skipped.sensitiveFiles += 1;
        continue;
      }

      const fileStats = await stat(absolutePath);

      if (fileStats.size > maximumFileSizeBytes) {
        skipped.oversizedFiles += 1;
        continue;
      }

      files.push(
        Object.freeze({
          path: toRepositoryPath(relativePath),
          sizeBytes: fileStats.size,
        }),
      );
    }
  }

  await walk(repositoryPath);

  return Object.freeze({
    path: repositoryPath,
    files: Object.freeze(files),
    skipped: Object.freeze(skipped),
    truncated,
  });
}
