import { isNewerVersion, parseVersion } from './version';

// Where releases come from. The release workflow attaches simple-reader.zip to every vX.Y.Z tag.
export const RELEASES_API = 'https://api.github.com/repos/kerbe42/lectern/releases/latest';
export const DOWNLOAD_PREFIX = 'https://github.com/kerbe42/lectern/releases/download/';
export const ASSET_NAME = 'simple-reader.zip';
/** chrome.storage.local key holding the pending update, if any. */
export const UPDATE_KEY = 'updateAvailable';
export const UPDATE_ALARM = 'update-check';
export const UPDATE_PERIOD_MINUTES = 12 * 60;

export interface UpdateInfo {
  /** Version without the leading "v", e.g. "0.3.0". */
  version: string;
  /** browser_download_url of simple-reader.zip on that release. */
  url: string;
  /** "sha256:<hex>" as reported by GitHub for the asset, when it reports one. */
  digest?: string;
}

/**
 * Reads the latest-release API response. Returns null when it doesn't look like one of our
 * releases (no valid tag, no simple-reader.zip, or a download address outside this repo).
 */
export function parseRelease(json: unknown): UpdateInfo | null {
  if (!json || typeof json !== 'object') return null;
  const r = json as { tag_name?: unknown; assets?: unknown };
  if (typeof r.tag_name !== 'string' || !parseVersion(r.tag_name)) return null;
  if (!Array.isArray(r.assets)) return null;
  const asset = r.assets.find(a => a && typeof a === 'object' && (a as { name?: unknown }).name === ASSET_NAME) as
    { browser_download_url?: unknown; digest?: unknown } | undefined;
  const url = asset?.browser_download_url;
  if (typeof url !== 'string' || !url.startsWith(DOWNLOAD_PREFIX) || !url.endsWith('/' + ASSET_NAME)) return null;
  const info: UpdateInfo = { version: r.tag_name.trim().replace(/^v/i, ''), url };
  if (typeof asset?.digest === 'string' && asset.digest) info.digest = asset.digest;
  return info;
}

/** The update to offer given the latest release, or null when the running version is current. */
export function pickUpdate(latest: UpdateInfo, currentVersion: string): UpdateInfo | null {
  return isNewerVersion(latest.version, currentVersion) ? latest : null;
}

/** The stored update, if it is still newer than the running version (it goes stale after a manual update). */
export async function getStoredUpdate(): Promise<UpdateInfo | null> {
  const o = await chrome.storage.local.get(UPDATE_KEY);
  const v = o[UPDATE_KEY] as UpdateInfo | undefined;
  if (!v || typeof v.version !== 'string' || typeof v.url !== 'string') return null;
  return pickUpdate(v, chrome.runtime.getManifest().version);
}

/** Badge on the toolbar icon while an update is waiting. */
export async function showUpdateBadge(info: UpdateInfo | null): Promise<void> {
  if (info) {
    await chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
    await chrome.action.setBadgeText({ text: 'NEW' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

/**
 * Asks GitHub for the latest release and records the result: stores the update and shows the
 * badge when it's newer, clears both when it isn't. Returns the update, null when up to date,
 * or undefined when the check couldn't be made (offline, rate-limited, odd response), in which
 * case whatever was stored before is left alone.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null | undefined> {
  let latest: UpdateInfo | null;
  try {
    // no-cache revalidates with the stored ETag; GitHub doesn't count 304 replies against the rate limit.
    const res = await fetch(RELEASES_API, { cache: 'no-cache', headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return undefined;
    latest = parseRelease(await res.json());
  } catch {
    return undefined;
  }
  if (!latest) return undefined;
  const update = pickUpdate(latest, chrome.runtime.getManifest().version);
  try {
    if (update) await chrome.storage.local.set({ [UPDATE_KEY]: update });
    else await chrome.storage.local.remove(UPDATE_KEY);
    await showUpdateBadge(update);
  } catch { /* storage or badge unavailable: nothing useful to do */ }
  return update;
}
