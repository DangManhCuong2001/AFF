import {z} from 'zod'

const reportSchema = z.object({
  verdict: z.enum(['no-obvious-mismatch', 'mismatch', 'uncertain']),
  confidence: z.enum(['high', 'low']),
  motion: z.enum(['meaningful', 'limited', 'unclear']),
  physics: z.enum(['plausible-in-samples', 'violation', 'unclear']).default('unclear'),
  observedEntry: z.enum(['top-down', 'front-in', 'left-in', 'right-in', 'grip-lift', 'unclear']).default('unclear'),
  entryEvidence: z.string().trim().max(240).default(''),
  issues: z.array(z.object({frameIndex: z.number().int().min(0).max(11), kind: z.enum(['shape', 'color', 'count', 'branding', 'hand', 'physics', 'path', 'visibility']), detail: z.string().trim().min(1).max(240)})).max(8),
})
export type VidsFidelityReport = z.infer<typeof reportSchema>
export function parseVidsFidelityReport(value: unknown): VidsFidelityReport {
  const report = reportSchema.parse(value)
  // A sample of frames cannot settle ambiguity or certify the entire clip.
  if (report.confidence === 'low' || (report.verdict === 'no-obvious-mismatch' && report.issues.length)) report.verdict = 'uncertain'
  if (report.verdict === 'mismatch' && !report.issues.length) report.verdict = 'uncertain'
  // Physical interaction is independent of identity: a recognizable product
  // can still have a prop pass through its floor. Never accept that as a pass.
  if (report.physics === 'violation' || report.issues.some(issue => issue.kind === 'physics')) {
    report.physics = 'violation'
    report.verdict = 'mismatch'
  }
  if (report.issues.some(issue => issue.kind === 'path')) report.verdict = 'mismatch'
  if (report.physics === 'plausible-in-samples' && (report.observedEntry === 'unclear' || !report.entryEvidence)) report.physics = 'unclear'
  return report
}
export const canApproveVidsClip = (report?: VidsFidelityReport): boolean => report?.verdict === 'no-obvious-mismatch' && report.physics === 'plausible-in-samples'
