/** Presentation only: extract explicitly labelled dimensions, never infer axes
 * from an unlabelled number list or convert the seller's measurement units. */
export function dimensionSpecRows(text: string): {label: string; value: string}[] {
  const labels: Record<string, string> = {cao: 'Cao', rộng: 'Rộng', dài: 'Dài', dày: 'Dày', 'đường kính': 'Đường kính'}
  const matches = text.matchAll(/(?:chiều\s+)?(đường kính|cao|rộng|dài|dày)\s*:?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|mét|met|m)(?![\p{L}\p{N}])/giu)
  const rows: {label: string; value: string}[] = []
  for (const match of matches) {
    const label = labels[match[1].toLocaleLowerCase('vi')]
    if (!rows.some(row => row.label === label)) rows.push({label, value: `${match[2]} ${match[3]}`})
  }
  return rows.slice(0, 3)
}
