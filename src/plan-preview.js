export function formatChangePlanPreview(
  workOrder,
) {
  if (
    !workOrder ||
    workOrder.status !== "planned"
  ) {
    throw new Error(
      "Eine Vorschau benötigt einen vollständig geplanten Arbeitsauftrag.",
    );
  }

  const lines = [
    "=== TerraControl AI – Änderungsvorschau ===",
    "",
    `Auftrag: ${workOrder.id}`,
    `Problem: ${workOrder.problem}`,
    `Repository: ${workOrder.repositoryPath}`,
    "",
    "Relevante Dateien:",
  ];

  for (const file of workOrder.relevantFiles) {
    lines.push(`- ${file}`);
  }

  lines.push(
    "",
    "Geplante Änderungen:",
  );

  workOrder.plannedChanges.forEach(
    (change, index) => {
      lines.push(
        `${index + 1}. ${change.file}`,
        `   Ziel: ${change.objective}`,
        `   Grund: ${change.reason}`,
      );
    },
  );

  lines.push(
    "",
    "Geplante Validierung:",
  );

  if (workOrder.validationScripts.length === 0) {
    lines.push("- Keine automatische Validierung ausgewählt");
  } else {
    for (
      const scriptName of
      workOrder.validationScripts
    ) {
      lines.push(`- ${scriptName}`);
    }
  }

  lines.push(
    "",
    "Sicherheitsstatus:",
    "- Keine Datei wurde verändert.",
    "- Kein Commit wurde erstellt.",
    "- Kein Push wurde ausgeführt.",
  );

  return lines.join("\n");
}
