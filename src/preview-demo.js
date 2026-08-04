import { createChangeDrafts } from "./change-drafts.js";
import { loadConfig } from "./config.js";
import { readRepositoryFiles } from "./content-reader.js";
import { createDiffPreview } from "./diff-preview.js";
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
            "Aktuellen Vorschau-Workflow ergänzen.",
          reason:
            "Die README beschreibt das Projekt.",
        },
        {
          file: "docs/ROADMAP.md",
          objective:
            "Nächsten sicheren Entwicklungsschritt dokumentieren.",
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

  const readableContent =
    await readRepositoryFiles(
      config.repositoryPath,
      result.workOrder.relevantFiles,
    );

  const originalContentByFile = new Map(
    readableContent.files.map((file) => [
      file.path,
      file.content,
    ]),
  );

  const proposedChanges = [
    {
      file: "README.md",
      content: [
        originalContentByFile
          .get("README.md")
          .trimEnd(),
        "",
        "## Sicherer Vorschau-Workflow",
        "",
        "TerraControl AI kann einen Arbeitsauftrag planen und",
        "Änderungsvorschläge als Diff anzeigen, ohne Dateien",
        "zu speichern.",
        "",
      ].join("\n"),
    },
    {
      file: "docs/ROADMAP.md",
      content: [
        originalContentByFile
          .get("docs/ROADMAP.md")
          .trimEnd(),
        "",
        "## Nächster sicherer Schritt",
        "",
        "Kontrolliertes Schreiben mit Inhaltsprüfung, Backup",
        "und anschließendem Git-Diff.",
        "",
      ].join("\n"),
    },
  ];

  const draftedWorkOrder = createChangeDrafts(
    result.workOrder,
    readableContent,
    proposedChanges,
  );

  console.log(result.preview);
  console.log("");
  console.log(
    createDiffPreview(draftedWorkOrder),
  );
}

main().catch((error) => {
  console.error(
    `[${new Date().toISOString()}] ERROR ${error.message}`,
  );

  process.exitCode = 1;
});
