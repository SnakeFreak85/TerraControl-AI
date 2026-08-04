import { loadConfig } from "./config.js";
import { getGitStatus } from "./git.js";
import { createLogger } from "./logger.js";
import { detectProject } from "./project-detector.js";
import {
  inspectRepository,
  scanRepository,
} from "./repository.js";

async function main() {
  const config = loadConfig();

  const logger = createLogger({
    level: config.logLevel,
  });

  logger.info("TerraControl AI wurde gestartet.");
  logger.info("Repository wird gelesen.", {
    repositoryPath: config.repositoryPath,
  });

  const repository = await inspectRepository(
    config.repositoryPath,
  );

  logger.info("Oberste Repository-Ebene wurde gelesen.", {
    entries: repository.entries.length,
  });

  console.log("\n--- Repository-Inhalt ---");

  for (const entry of repository.entries) {
    console.log(`${entry.type.padEnd(7)} ${entry.name}`);
  }

  logger.info("Sicherer Dateibaum wird erstellt.");

  const scan = await scanRepository(
    config.repositoryPath,
  );

  logger.info("Dateibaum wurde erstellt.", {
    files: scan.files.length,
    truncated: scan.truncated,
  });

  console.log("\n--- Sicherer Dateibaum ---");

  for (const file of scan.files) {
    console.log(
      `${String(file.sizeBytes).padStart(8)} Bytes  ${file.path}`,
    );
  }

  console.log("\n--- Ausgeschlossene Inhalte ---");
  console.log(
    `Ordner:            ${scan.skipped.directories}`,
  );
  console.log(
    `Sensible Dateien: ${scan.skipped.sensitiveFiles}`,
  );
  console.log(
    `Zu große Dateien: ${scan.skipped.oversizedFiles}`,
  );
  console.log(
    `Verknüpfungen:     ${scan.skipped.symbolicLinks}`,
  );
  console.log(
    `Dateigrenze:       ${
      scan.truncated ? "erreicht" : "nicht erreicht"
    }`,
  );

  logger.info("Projektart wird erkannt.");

  const project = await detectProject(
    config.repositoryPath,
  );

  console.log("\n--- Projekterkennung ---");
  console.log(`Typ: ${project.type}`);
  console.log(
    `Manifest: ${project.manifest || "(nicht erkannt)"}`,
  );
  console.log(
    `Paketmanager: ${project.packageManager || "(nicht erkannt)"}`,
  );

  console.log("\nVerfügbare Befehle:");

  const projectScripts = Object.entries(project.scripts);

  if (projectScripts.length === 0) {
    console.log("  Keine Befehle erkannt");
  } else {
    for (const [name, command] of projectScripts) {
      console.log(`  ${name}: ${command}`);
    }
  }

  logger.info("Git-Status wird geprüft.");

  const gitStatus = await getGitStatus(
    config.repositoryPath,
  );

  logger.info("Git-Status wurde erfolgreich gelesen.");

  console.log("\n--- Git-Status ---");
  console.log(`Branch: ${gitStatus.branch}`);
  console.log(
    `Remote: ${gitStatus.remoteUrl || "(nicht eingerichtet)"}`,
  );
  console.log(
    `Status: ${gitStatus.clean ? "sauber" : "Änderungen vorhanden"}`,
  );

  if (!gitStatus.clean) {
    console.log("\nÄnderungen:");

    for (const change of gitStatus.changes) {
      console.log(`  ${change}`);
    }
  }

  console.log("\nTerraControl AI ist bereit.");
}

main().catch((error) => {
  console.error(
    `[${new Date().toISOString()}] ERROR ${error.message}`,
  );

  process.exitCode = 1;
});

