const supportedPackageManagers = new Set([
  "npm",
  "pnpm",
  "yarn",
]);

function resolveExecutable(
  packageManager,
  platform,
) {
  if (
    platform === "win32" &&
    packageManager === "npm"
  ) {
    return "npm.cmd";
  }

  if (
    platform === "win32" &&
    packageManager === "pnpm"
  ) {
    return "pnpm.cmd";
  }

  if (
    platform === "win32" &&
    packageManager === "yarn"
  ) {
    return "yarn.cmd";
  }

  return packageManager;
}

export function createValidationPlan(
  workOrder,
  project,
  {
    platform = process.platform,
  } = {},
) {
  if (
    !workOrder ||
    workOrder.status !== "diff-verified"
  ) {
    throw new Error(
      "Eine Validierung benötigt einen erfolgreich geprüften Git-Diff.",
    );
  }

  if (
    !project ||
    project.type !== "node" ||
    !project.scripts ||
    typeof project.scripts !== "object"
  ) {
    throw new Error(
      "Derzeit können nur erkannte Node.js-Projekte validiert werden.",
    );
  }

  if (
    !supportedPackageManagers.has(
      project.packageManager,
    )
  ) {
    throw new Error(
      `Nicht unterstützter Paketmanager: ${project.packageManager}`,
    );
  }

  if (
    !Array.isArray(
      workOrder.validationScripts,
    ) ||
    workOrder.validationScripts.length === 0
  ) {
    throw new Error(
      "Der Arbeitsauftrag enthält keine Validierungsskripte.",
    );
  }

  const executable = resolveExecutable(
    project.packageManager,
    platform,
  );

  const commands =
    workOrder.validationScripts.map(
      (scriptName) => {
        if (
          !Object.hasOwn(
            project.scripts,
            scriptName,
          )
        ) {
          throw new Error(
            `Validierungsskript ist im Projekt nicht vorhanden: ${scriptName}`,
          );
        }

        return Object.freeze({
          scriptName,
          executable,
          arguments: Object.freeze([
            "run",
            scriptName,
          ]),
          displayCommand:
            `${project.packageManager} run ${scriptName}`,
        });
      },
    );

  return Object.freeze({
    repositoryPath:
      workOrder.repositoryPath,
    packageManager:
      project.packageManager,
    commands: Object.freeze(commands),
  });
}
