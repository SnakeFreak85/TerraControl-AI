import { access, readdir, stat } from "node:fs/promises";

const ignoredNames = new Set([
  ".git",
  "node_modules",
  "coverage",
  "logs",
]);

export async function inspectRepository(repositoryPath) {
  await access(repositoryPath);

  const repositoryStats = await stat(repositoryPath);

  if (!repositoryStats.isDirectory()) {
    throw new Error(
      `Der Repository-Pfad ist kein Verzeichnis: ${repositoryPath}`,
    );
  }

  const directoryEntries = await readdir(repositoryPath, {
    withFileTypes: true,
  });

  const entries = directoryEntries
    .filter((entry) => !ignoredNames.has(entry.name))
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
