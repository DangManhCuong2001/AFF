/** Preserve Vietnamese tone marks: "chứa" (contains) is not "chưa" (not yet). */
export function explicitNegations(text: string): string[] {
  return (text.normalize('NFC').match(/(?<![\p{L}\p{N}])(?:không|chưa|khong|chua)(?![\p{L}\p{N}])/giu) || [])
    .map(word => word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
}
export const hasExplicitNegation = (text: string) => explicitNegations(text).length > 0
