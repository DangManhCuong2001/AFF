'use strict';
const byId = id => document.getElementById(id);
let pair = null;
let sending = false;
let allowed = false;
let uploadAllowed = false;
let previousJobs = '';
async function api(path, init = {}) {
  const response = await fetch(path, {...init, headers: {...init.headers, ...(pair ? {Authorization: `Bearer ${pair.token}`} : {})}});
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'LOCAL_ERROR');
  return value;
}
function renderJobs(jobs) {
  const signature = JSON.stringify(jobs);
  if (signature === previousJobs) return;
  previousJobs = signature;
  byId('results').replaceChildren();
  for (const job of jobs) {
    const p = document.createElement('p');
    p.textContent = `${job.id.slice(0, 8)}: ${job.kind === 'upload' && job.status === 'complete' ? 'Upload ảnh thành công — chưa gọi Generate' : job.status}${job.code ? ` — ${job.code}` : ''}${job.uncertain ? ' — Google có thể đã nhận tác vụ; kiểm tra Vids trước khi gửi lại.' : ''}`;
    byId('results').append(p);
    if (job.clip) {
      const video = document.createElement('video');
      video.controls = true; video.src = job.clip; video.width = 320;
      const link = document.createElement('a');
      link.href = job.clip; link.download = `${job.id}.mp4`; link.textContent = 'Tải MP4';
      byId('results').append(video, document.createElement('br'), link);
    }
  }
}
async function poll() {
  try {
    const status = await api('/status');
    const worker = status.worker;
    const active = status.jobs.some(job => ['pending', 'running'].includes(job.status));
    allowed = worker.connected && worker.nativeProtocol === 1 && worker.nativeReady && !active && status.remainingJobs > 0;
    uploadAllowed = worker.connected && worker.uploadReady && !active && status.remainingJobs > 0;
    byId('connection').textContent = `Extension: ${worker.connected ? !worker.compatible ? 'phiên bản cũ — tải lại extension và mở cửa sổ kết nối mới' : worker.ready ? 'sẵn sàng' : worker.busy ? 'đang bận' : worker.hasBlueprint ? 'đã giữ cấu hình, chờ phiên Google — làm mới phiên trong cửa sổ kết nối Vids' : 'có thể kiểm tra upload, đang chờ cấu hình tạo clip' : 'chưa kết nối'}${worker.version ? ` (${worker.version})` : ''}. Còn ${status.remainingJobs} tác vụ trong lần chạy này.`;
    byId('submit').disabled = sending || !allowed;
    byId('upload').disabled = sending || !uploadAllowed;
    renderJobs(status.jobs);
  } catch { byId('connection').textContent = 'Mất kết nối local. Kiểm tra server.'; byId('submit').disabled = true; byId('upload').disabled = true; }
}
byId('copy').addEventListener('click', async () => { if (pair) { await navigator.clipboard.writeText(pair.token); byId('message').textContent = 'Đã sao chép mã local. Dán vào cửa sổ extension.'; } });
async function sendJob(kind) {
  if (sending || !(kind === 'upload' ? uploadAllowed : allowed)) return;
  sending = true; byId('submit').disabled = true; byId('upload').disabled = true;
  try {
    const file = byId('image').files[0];
    if (!file || file.size > 5 * 1024 * 1024) throw new Error('Ảnh phải nhỏ hơn 5 MB.');
    const image = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    await api('/jobs', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({kind, engine: kind === 'generate' ? 'create-ui' : 'legacy', image, prompt: byId('prompt').value, confirmGeneration: byId('confirm').checked})});
    byId('message').textContent = kind === 'upload' ? 'Đang kiểm tra upload ảnh. Không gọi Generate.' : 'Đã xếp một tác vụ. Giữ tab Vids và cửa sổ extension mở.';
    byId('confirm').checked = false;
  } catch (error) { byId('message').textContent = error.message; }
  finally { sending = false; await poll(); }
}
byId('job').addEventListener('submit', event => { event.preventDefault(); void sendJob('generate'); });
byId('upload').addEventListener('click', () => { void sendJob('upload'); });
void (async () => { pair = await api('/pairing'); byId('token').value = pair.token; await poll(); setInterval(poll, 2000); })().catch(() => { byId('connection').textContent = 'Không đọc được mã kết nối local. Tải lại trang.'; });
