export function formatCommitPlanPreview(
  commitPlan,
) {
  if (
    !commitPlan ||
    commitPlan.status !==
      "ready-to-commit"
  ) {
    throw new Error(
      "Eine Commit-Vorschau benötigt einen geprüften Commit-Plan.",
    );
  }

  const lines = [
    "=== TerraControl AI – Commit-Vorschau ===",
    "",
    `Arbeitsauftrag: ${commitPlan.workOrderId}`,
    `Repository: ${commitPlan.repositoryPath}`,
    `Branch: ${commitPlan.branch}`,
    `Remote: ${commitPlan.remoteUrl || "(nicht eingerichtet)"}`,
    "",
    `Commit-Nachricht: ${commitPlan.message}`,
    "",
    "Freigegebene Dateien:",
  ];

  for (const file of commitPlan.files) {
    lines.push(`- ${file}`);
  }

  lines.push(
    "",
    "Sicherheitsstatus:",
    "- Git-Dateien wurden noch nicht vorgemerkt.",
    "- Es wurde noch kein Commit erstellt.",
    "- Es wurde noch kein Push ausgeführt.",
  );

  return lines.join("\n");
}
