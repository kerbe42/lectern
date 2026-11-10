// The "Update now" page. It runs in its own tab because folder pickers close extension popups.
// Steps: get write access to the extension's folder (picking it the first time), check it is
// this copy's folder, download the release zip, check it, write it, then restart the extension.
import { unzipSync } from 'fflate';
import { checkForUpdate, getStoredUpdate, showUpdateBadge, DOWNLOAD_PREFIX, UPDATE_KEY, type UpdateInfo } from './check';
import { UpdateError, digestMatches, folderProblem, validateRelease, writeFiles, type DirHandleLike } from './install';
import { loadFolder, saveFolder, forgetFolder } from './folder-store';

// Chromium's folder-permission calls, which aren't in TypeScript's DOM types yet.
type Access = { mode: 'readwrite' };
type Folder = FileSystemDirectoryHandle & DirHandleLike & {
  queryPermission(d: Access): Promise<PermissionState>;
  requestPermission(d: Access): Promise<PermissionState>;
};
type PickerWindow = { showDirectoryPicker?(o: { mode: 'readwrite'; id: string }): Promise<Folder> };

const running = chrome.runtime.getManifest();
const me = { name: running.name, version: running.version };

const $ = (id: string) => document.getElementById(id)!;
const summary = $('summary');
const button = $('go') as HTMLButtonElement;
const statusEl = $('status');
const errorEl = $('error');
const bar = $('bar') as HTMLProgressElement;

let update: UpdateInfo | null = null;
let saved: Folder | null = null;

function status(text: string) { statusEl.textContent = text; }
function fail(text: string) { errorEl.textContent = text; errorEl.hidden = !text; }

async function init() {
  saved = (await loadFolder().catch(() => null)) as Folder | null;
  $('first-time').hidden = !!saved;
  const fresh = await checkForUpdate();
  update = fresh === undefined ? await getStoredUpdate() : fresh;
  if (!update) {
    summary.textContent = fresh === undefined
      ? `Couldn't reach GitHub to check for updates. You have ${me.name} ${me.version}. Try again later.`
      : `You have the latest version, ${me.name} ${me.version}.`;
    return;
  }
  summary.textContent = `Version ${update.version} is ready to install. You have ${me.version}.`;
  if (!(window as PickerWindow).showDirectoryPicker) {
    fail("This browser can't write to the extension's folder. Download simple-reader.zip from the release page and unzip it over the folder instead.");
    return;
  }
  button.hidden = false;
}

/** The extension's folder with write access, or null (with the reason shown) when there isn't one yet. */
async function getFolder(): Promise<Folder | null> {
  if (saved) {
    const dir = saved;
    let perm = await dir.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') perm = await dir.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      fail(`${me.name} needs permission to change the files in its folder to install the update. Click Update now and allow editing files.`);
      return null;
    }
    const problem = await folderProblem(dir, me);
    if (!problem) return dir;
    // Moved, deleted, or replaced by hand: forget it and ask for the folder again.
    await forgetFolder().catch(() => {});
    saved = null;
    $('first-time').hidden = false;
    fail(`The folder chosen last time can't be used any more. ${problem}`);
  }
  let picked: Folder;
  try {
    picked = await (window as PickerWindow).showDirectoryPicker!({ mode: 'readwrite', id: 'simple-reader' });
  } catch (e) {
    const name = (e as DOMException)?.name;
    fail(name === 'AbortError'
      ? `No folder chosen. Click Update now and choose the ${me.name} folder (the one with manifest.json in it).`
      : name === 'SecurityError' || name === 'NotAllowedError'
        ? 'The browser wants a fresh click before it opens the folder picker. Click Update now again.'
        : `The folder picker didn't open (${(e as Error)?.message ?? e}).`);
    return null;
  }
  const problem = await folderProblem(picked, me);
  if (problem) { fail(problem); return null; }
  let perm = await picked.queryPermission({ mode: 'readwrite' });
  if (perm !== 'granted') perm = await picked.requestPermission({ mode: 'readwrite' });
  if (perm !== 'granted') {
    fail(`${me.name} needs permission to change the files in that folder. Click Update now and allow editing files.`);
    return null;
  }
  await saveFolder(picked).catch(() => {}); // not fatal: it just asks for the folder again next time
  saved = picked;
  return picked;
}

async function download(u: UpdateInfo): Promise<Uint8Array<ArrayBuffer>> {
  if (!u.url.startsWith(DOWNLOAD_PREFIX)) throw new UpdateError('The update address is not on the Simple Reader release page, so it was not downloaded.');
  let res: Response;
  try { res = await fetch(u.url, { cache: 'no-store' }); }
  catch { throw new UpdateError("Couldn't download the update. Check your internet connection and try again."); }
  if (!res.ok) throw new UpdateError(`The download failed (HTTP ${res.status}). Try again later.`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!(await digestMatches(bytes, u.digest))) throw new UpdateError('The download is damaged (its checksum does not match the release). Nothing was changed. Try again.');
  return bytes;
}

async function install() {
  if (!update) return;
  const u = update;
  button.disabled = true;
  fail('');
  bar.hidden = true;
  let finished = false;
  try {
    status('Checking the extension folder…');
    const dir = await getFolder();
    if (!dir) { status(''); return; }
    $('first-time').hidden = true;
    status(`Downloading version ${u.version}…`);
    const zip = await download(u);
    status('Checking the download…');
    let entries: Record<string, Uint8Array<ArrayBuffer>>;
    try { entries = unzipSync(zip); }
    catch { throw new UpdateError('The download is not a readable zip file. Nothing was changed. Try again.'); }
    const files = validateRelease(entries, { name: me.name, version: u.version });
    bar.max = files.length;
    bar.value = 0;
    bar.hidden = false;
    await writeFiles(dir, files, (done, total, path) => {
      bar.value = done;
      status(`Writing files (${done} of ${total}): ${path}`);
    });
    finished = true;
    await chrome.storage.local.remove(UPDATE_KEY).catch(() => {});
    await showUpdateBadge(null).catch(() => {});
    status(`Updated to version ${u.version}. Restarting ${me.name}; this tab will close.`);
    setTimeout(() => chrome.runtime.reload(), 1200);
  } catch (e) {
    status('');
    fail(e instanceof UpdateError ? e.message : `Something went wrong: ${(e as Error)?.message ?? e}. Click Update now to try again.`);
  } finally {
    if (!finished) button.disabled = false;
  }
}

button.addEventListener('click', install);
init().catch(e => { summary.textContent = `Couldn't start the updater: ${(e as Error)?.message ?? e}`; });
