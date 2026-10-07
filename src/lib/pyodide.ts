/**
 * Optional in-browser Python via Pyodide.
 *
 * Pyodide is large (~15–30 MB with pandas) and is downloaded from the
 * jsDelivr CDN only when the learner explicitly enables it. Everything else in
 * the app works offline; every Python exercise also has a local .py companion.
 */
export const PYODIDE_VERSION = '314.0.7';
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

interface PyodideAPI {
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackagesFromImports: (code: string) => Promise<void>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
  globals: { get: (k: string) => unknown };
}

let pyPromise: Promise<PyodideAPI> | null = null;
let status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
const listeners = new Set<(s: typeof status) => void>();

function setStatus(s: typeof status) {
  status = s;
  for (const l of listeners) l(s);
}

export function pyodideStatus() {
  return status;
}

export function onPyodideStatus(cb: (s: typeof status) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function loadPyodide(): Promise<PyodideAPI> {
  if (pyPromise) return pyPromise;
  setStatus('loading');
  pyPromise = (async () => {
    const mod = (await import(/* @vite-ignore */ `${INDEX_URL}pyodide.mjs`)) as {
      loadPyodide: (opts: { indexURL: string }) => Promise<PyodideAPI>;
    };
    const py = await mod.loadPyodide({ indexURL: INDEX_URL });
    setStatus('ready');
    return py;
  })();
  pyPromise.catch(() => {
    pyPromise = null;
    setStatus('error');
  });
  return pyPromise;
}

export interface PyRunResult {
  stdout: string;
  stderr: string;
  error?: string;
  ms: number;
}

export async function runPython(code: string): Promise<PyRunResult> {
  const py = await loadPyodide();
  let stdout = '';
  let stderr = '';
  py.setStdout({ batched: (s) => (stdout += `${s}\n`) });
  py.setStderr({ batched: (s) => (stderr += `${s}\n`) });
  const t0 = performance.now();
  try {
    await py.loadPackagesFromImports(code);
    await py.runPythonAsync(code);
    return { stdout, stderr, ms: performance.now() - t0 };
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    // Keep the useful tail of Python tracebacks.
    const lines = msg.trim().split('\n');
    return { stdout, stderr, error: lines.slice(-8).join('\n'), ms: performance.now() - t0 };
  }
}
