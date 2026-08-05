import { loadConfig } from "./config.js";
import { readRepositoryFiles } from "./content-reader.js";
import { planRepositoryFix } from "./fix-planner.js";
import { getGitStatus } from "./git.js";
import { createOllamaClient } from "./ollama-client.js";
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

  const ollamaClient =
    createOllamaClient({
      baseUrl:
        config.ollamaBaseUrl,
      model:
        config.ollamaModel,
      timeoutMs:
        config.ollamaTimeoutMs,
      contextSize:
        config.ollamaContextSize,
    });

  console.log(
    `Lokales Modell ${ollamaClient.model} analysiert das Problem.`,
  );

  console.log(
    "Dies kann auf diesem PC mehrere Minuten dauern.\n",
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
      ollamaClient,
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
