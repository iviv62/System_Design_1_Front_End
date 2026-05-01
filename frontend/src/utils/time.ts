export function formatTime(isoString: string): string {
  const normalizedIso = isoString.endsWith("Z") || isoString.includes("+") || (isoString.includes("-") && isoString.lastIndexOf("-") > 10)
    ? isoString
    : `${isoString}Z`;

  return new Date(normalizedIso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
