import { loadConfig } from "./config.js";
import { detectProject } from "./project-detector.js";
import { createPreviewWorkflow } from "./preview-workflow.js";
import { scanRepository } from "./repository.js";

async function main() {
  const config = loadConfig();

  const repositoryScan = await scanRepository(
    config.repositoryPath,
  );

  const project = await detectProject(
    config.repositoryPath,
  );

  const result = createPreviewWorkflow(
    {
      problem:
        "README und Entwicklungsplan sollen den aktuellen Stand von Meilenstein 3 dokumentieren.",
      repositoryPath: config.repositoryPath,
      relevantFiles: [
        "README.md",
        "docs/ROADMAP.md",
      ],
      changes: [
        {
          file: "README.md",
          objective:
            "Aktuellen Funktionsumfang ergänzen.",
          reason:
            "Die README beschreibt das Projekt.",
        },
        {
          file: "docs/ROADMAP.md",
          objective:
            "Fortschritt von Meilenstein 3 dokumentieren.",
          reason:
            "Die Roadmap enthält die Entwicklungsstufen.",
        },
      ],
      validationScripts: ["test"],
    },
    {
      repositoryScan,
      project,
    },
  );

  console.log(result.preview);
}

main().catch((error) => {
  console.error(
    `[${new Date().toISOString()}] ERROR ${error.message}`,
  );

  process.exitCode = 1;
});
