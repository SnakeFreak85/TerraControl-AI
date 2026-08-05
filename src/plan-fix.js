import { loadConfig } from "./config.js";
import { readRepositoryFiles } from "./content-reader.js";
import { planRepositoryFix } from "./fix-planner.js";
import { getGitStatus } from "./git.js";

import { detectProject } from "./project-detector.js";
import { scanRepository } from "./repository.js";

async function main() {
  const problem = process.argv
    .slice(2)
    .join(" ")
    .trim();

  if (!problem) {
    throw new Error(
      'Verwendung: npm run plan -- "Problembeschreibung"',
    );
  }

  const config = loadConfig();

  console.log(
    "TerraControl AI prüft das Repository ...",
  );

  const gitStatus = await getGitStatus(
    config.repositoryPath,
  );

  if (!gitStatus.clean) {
    throw new Error(
      "Das Ziel-Repository enthält bereits Änderungen. Die Planung wurde abgebrochen.",
    );
  }

  const repositoryScan =
    await scanRepository(
      config.repositoryPath,
    );

  const readableContent =
    await readRepositoryFiles(
      config.repositoryPath,
      repositoryScan.files.map(
        (file) => file.path,
      ),
    );

  const project = await detectProject(
    config.repositoryPath,
  );

  if (project.type !== "node") {
    throw new Error(
      "Die erste lokale Planungsversion unterstützt nur Node.js-Projekte.",
    );
  }

  console.log(
    "Lokale Dateianalyse wird durchgeführt.\n",
  );

  const result =
    await planRepositoryFix(
      {
        problem,
        repositoryPath:
          config.repositoryPath,
        repositoryScan,
        readableContent,
        project,
      },
      undefined,
    );

  console.log(result.preview);

  console.log(
    "\n--- Planungsmodus ---",
  );

  console.log(
    "Lokale Dateianalyse: erfolgreich",
  );

  console.log(
    `Modellaufrufe: ${result.metrics.modelCalls}`,
  );

  console.log(
    "\nPlanung abgeschlossen. Es wurde keine Datei verändert.",
  );
}

main().catch((error) => {
  console.error(
    `\nTerraControl AI: ${error.message}`,
  );

  process.exitCode = 1;
});
