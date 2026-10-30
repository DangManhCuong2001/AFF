interface WorkerState {
  worker: {connected: boolean; compatible?: boolean; ready: boolean}
  remainingJobs: number
}

/** Wait for the next heartbeat after a completed clip, without submitting another job. */
export async function waitForVidsWorker(
  readStatus: () => Promise<WorkerState>,
  pause: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 500)),
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const state = await readStatus()
    if (state.remainingJobs < 1) throw new Error('LOCAL_JOB_LIMIT')
    if (state.worker.connected && state.worker.ready && state.worker.compatible !== false) return
    if (attempt < 19) await pause()
  }
  throw new Error('WORKER_NOT_READY')
}
