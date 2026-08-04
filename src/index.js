import { loadConfig } from "./config.js";
import { getGitStatus } from "./git.js";
import { createLogger } from "./logger.js";
import { inspectRepository } from "./repository.js";

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

  logger.info("Repository wurde erfolgreich gelesen.", {
    entries: repository.entries.length,
  });

  console.log("\n--- Repository-Inhalt ---");

  for (const entry of repository.entries) {
    console.log(`${entry.type.padEnd(7)} ${entry.name}`);
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
