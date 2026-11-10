// Installing an update into the extension's own folder: check the downloaded release, check the
// chosen folder, then write the files. Everything here works on small handle interfaces so the
// tests can run it against an in-memory folder.

/** An error whose message is meant for the person updating. */
export class UpdateError extends Error {}

// The parts of the File System Access handles this code uses (real handles satisfy these).
export interface WritableLike {
  write(data: Uint8Array<ArrayBuffer>): Promise<void>;
  close(): Promise<void>;
  abort?(reason?: unknown): Promise<void>;
}
export interface FileHandleLike {
  getFile(): Promise<{ text(): Promise<string> }>;
  createWritable(): Promise<WritableLike>;
}
export interface DirHandleLike {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
}

export interface ExtensionIdentity { name: string; version: string }

export const MANIFEST = 'manifest.json';

/**
 * Why a zip entry's path is unsafe to write, or null when it's fine. Paths must be relative,
 * use forward slashes, and have no empty, "." or ".." segments. A trailing slash marks a folder.
 */
export function entryPathProblem(path: string): string | null {
  if (!path) return 'empty path';
  if (path.includes('\\')) return 'backslash in path';
  if (path.startsWith('/')) return 'absolute path';
  if (path.includes(':')) return 'colon in path'; // drive letters (C:) and characters Windows can't store
  if (/[\u0000-\u001f\u007f]/.test(path)) return 'control character in path';
  const segments = (path.endsWith('/') ? path.slice(0, -1) : path).split('/');
  for (const s of segments) {
    if (s === '..') return '".." in path';
    if (s === '' || s === '.') return 'empty or "." segment in path';
  }
  return null;
}

/**
 * Checks an unzipped release before anything is written: every path is safe, manifest.json sits
 * at the root, its name is this extension's and its version is the release's. Returns the files
 * to write (folders are created as needed), with manifest.json last.
 */
export function validateRelease(
  entries: Record<string, Uint8Array<ArrayBuffer>>,
  expected: ExtensionIdentity,
): Array<[string, Uint8Array<ArrayBuffer>]> {
  const files: Array<[string, Uint8Array<ArrayBuffer>]> = [];
  for (const [path, data] of Object.entries(entries)) {
    const problem = entryPathProblem(path);
    if (problem) throw new UpdateError(`The download has an unsafe file name (${problem}: ${JSON.stringify(path)}). Nothing was changed.`);
    if (path.endsWith('/')) {
      if (data.length) throw new UpdateError(`The download is damaged (folder entry with data: ${path}). Nothing was changed.`);
      continue;
    }
    files.push([path, data]);
  }
  const filePaths = new Set(files.map(([p]) => p));
  for (const p of filePaths) {
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) {
      if (filePaths.has(parts.slice(0, i).join('/'))) {
        throw new UpdateError(`The download is damaged (${parts.slice(0, i).join('/')} is both a file and a folder). Nothing was changed.`);
      }
    }
  }
  const manifestEntry = files.find(([p]) => p === MANIFEST);
  if (!manifestEntry) throw new UpdateError('The download has no manifest.json at its top level, so it is not a Simple Reader release. Nothing was changed.');
  let m: { name?: unknown; version?: unknown };
  try { m = JSON.parse(new TextDecoder().decode(manifestEntry[1])); }
  catch { throw new UpdateError("The download's manifest.json can't be read. Nothing was changed."); }
  if (m?.name !== expected.name) {
    throw new UpdateError(`The download is for a different extension (${JSON.stringify(m?.name)}), not ${expected.name}. Nothing was changed.`);
  }
  if (m.version !== expected.version) {
    throw new UpdateError(`The download says it is version ${JSON.stringify(m.version)} but the release is v${expected.version}. Nothing was changed.`);
  }
  return [...files.filter(([p]) => p !== MANIFEST), manifestEntry];
}

/**
 * True when `bytes` match a "sha256:<hex>" digest. Digests in any other form can't be checked
 * and count as a match (HTTPS still protects the download).
 */
export async function digestMatches(bytes: Uint8Array<ArrayBuffer>, digest: string | undefined): Promise<boolean> {
  const m = /^sha256:([0-9a-f]{64})$/i.exec(digest ?? '');
  if (!m) return true;
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hex = Array.from(hash, b => b.toString(16).padStart(2, '0')).join('');
  return hex === m[1].toLowerCase();
}

/**
 * Why `dir` isn't the folder this copy of the extension runs from, or null when it is: it must
 * hold a manifest.json with the running extension's name and version.
 */
export async function folderProblem(dir: DirHandleLike, running: ExtensionIdentity): Promise<string | null> {
  let text: string;
  try {
    text = await (await (await dir.getFileHandle(MANIFEST)).getFile()).text();
  } catch {
    return `That folder has no manifest.json. Choose the ${running.name} folder you loaded with Load unpacked: the one with manifest.json directly inside it.`;
  }
  let m: { name?: unknown; version?: unknown };
  try { m = JSON.parse(text); } catch { return "That folder's manifest.json can't be read, so it isn't the right folder."; }
  if (m?.name !== running.name) {
    return `That folder holds a different extension (${JSON.stringify(m?.name)}), not ${running.name}. Choose the folder you loaded with Load unpacked.`;
  }
  if (m.version !== running.version) {
    return `That folder has ${running.name} ${m.version} but the running copy is ${running.version}, so it isn't the folder this copy was loaded from. ` +
      `The extensions page shows the right folder under "Loaded from" in ${running.name}'s Details. ` +
      `If you replaced the files by hand, click the reload button on that card first.`;
  }
  return null;
}

/**
 * Writes the files into `root`, creating subfolders, and always writes manifest.json last so an
 * interrupted update leaves the old version number in place (the next attempt still sees the
 * folder as this copy's and can finish the job).
 */
export async function writeFiles(
  root: DirHandleLike,
  files: Array<[string, Uint8Array<ArrayBuffer>]>,
  onProgress?: (done: number, total: number, path: string) => void,
): Promise<void> {
  const ordered = [...files.filter(([p]) => p !== MANIFEST), ...files.filter(([p]) => p === MANIFEST)];
  const dirs = new Map<string, DirHandleLike>([['', root]]);
  const dirFor = async (path: string): Promise<DirHandleLike> => {
    let cur = '';
    let handle = root;
    for (const name of path.split('/').slice(0, -1)) {
      cur = cur ? `${cur}/${name}` : name;
      let next = dirs.get(cur);
      if (!next) { next = await handle.getDirectoryHandle(name, { create: true }); dirs.set(cur, next); }
      handle = next;
    }
    return handle;
  };
  let done = 0;
  for (const [path, data] of ordered) {
    let w: WritableLike | undefined;
    try {
      const dir = await dirFor(path);
      const file = await dir.getFileHandle(path.split('/').pop()!, { create: true });
      w = await file.createWritable(); // writes to a temporary file, swapped in on close()
      await w.write(data);
      await w.close();
    } catch (e) {
      await w?.abort?.().catch(() => {});
      const why = e instanceof Error ? e.message : String(e);
      throw new UpdateError(`Couldn't write ${path} (${why}). The update stopped part-way; click Update now to try again.`);
    }
    onProgress?.(++done, ordered.length, path);
  }
}
