// Local diagnostic only. The pairing is kept in memory; no Google auth is read.
const base = 'http://127.0.0.1:4317';
const action = process.argv[2] || 'inspect';
if (!['inspect', 'select-animate', 'select-create', 'open-settings', 'prepare-create'].includes(action)) throw new Error('UI_ACTION_UNSUPPORTED');
const landing = await fetch(base);
const cookie = landing.headers.get('set-cookie')?.split(';')[0];
const pairing = await (await fetch(`${base}/pairing`, {headers: {Cookie: cookie || ''}})).json();
if (!/^[a-f0-9]{64}$/.test(pairing.token)) throw new Error('LOCAL_PAIRING_REQUIRED');
const call = async (route, value) => {
  const response = await fetch(`${base}${route}`, {method: value ? 'POST' : 'GET', headers: {Authorization: `Bearer ${pairing.token}`, ...(value ? {'Content-Type': 'application/json'} : {})}, ...(value ? {body: JSON.stringify(value)} : {}), signal: AbortSignal.timeout(5000)});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'UI_CHECK_FAILED');
  return result;
};
try {
  let input = {};
  if (action === 'prepare-create') {const {readFile} = await import('node:fs/promises'); const bytes = await readFile(process.argv[3]); const mime = bytes[0] === 137 ? 'png' : 'jpeg'; input = {image: `data:image/${mime};base64,${bytes.toString('base64')}`, prompt: await readFile(process.argv[4], 'utf8')};}
  const {id} = await call('/ui', {action, ...input});
  for (let attempt = 0; attempt < (action === 'prepare-create' ? 122 : 32); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const check = await call(`/ui/${id}`);
    if (check.status === 'complete') {console.log(JSON.stringify(check.result, null, 2)); break;}
    if (check.status === 'expired' || attempt === (action === 'prepare-create' ? 121 : 31)) throw new Error('UI_CHECK_EXPIRED');
  }
} catch (error) {
  console.error(/^[A-Z_]{1,70}$/.test(error.message) ? error.message : 'UI_CHECK_FAILED');
  process.exitCode = 1;
}
