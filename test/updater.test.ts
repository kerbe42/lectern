import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { compareVersions, isNewerVersion, parseVersion } from '../src/update/version';
import { parseRelease, pickUpdate, ASSET_NAME } from '../src/update/check';
import {
  UpdateError, digestMatches, entryPathProblem, folderProblem, validateRelease, writeFiles,
  type DirHandleLike, type FileHandleLike,
} from '../src/update/install';

const ME = { name: 'Simple Reader', version: '0.3.0' };
const manifest = (o: object) => strToU8(JSON.stringify(o));

describe('compareVersions', () => {
  it('compares numeric segments as numbers, not text', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBe(1);
    expect(compareVersions('0.2.0', '0.10.0')).toBe(-1);
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });
  it('ignores a leading v on either side', () => {
    expect(compareVersions('v0.3.0', '0.2.0')).toBe(1);
    expect(compareVersions('V0.2.0', 'v0.2.0')).toBe(0);
  });
  it('treats missing segments as 0', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.0.1', '1.2')).toBe(1);
    expect(compareVersions('1', '1.0.1')).toBe(-1);
  });
  it('rejects malformed versions', () => {
    expect(() => compareVersions('0.3.0-beta', '0.2.0')).toThrow();
    expect(() => compareVersions('', '0.2.0')).toThrow();
    expect(parseVersion('1..2')).toBeNull();
    expect(isNewerVersion('garbage', '0.2.0')).toBe(false);
    expect(isNewerVersion('v0.2.1', '0.2.0')).toBe(true);
  });
});

describe('parseRelease / pickUpdate', () => {
  const url = 'https://github.com/kerbe42/lectern/releases/download/v0.3.0/simple-reader.zip';
  const release = (over: object = {}) => ({
    tag_name: 'v0.3.0',
    assets: [{ name: 'other.txt', browser_download_url: 'https://github.com/kerbe42/lectern/releases/download/v0.3.0/other.txt' },
      { name: ASSET_NAME, browser_download_url: url, digest: 'sha256:' + 'a'.repeat(64) }],
    ...over,
  });
  it('reads the tag and the simple-reader.zip asset', () => {
    expect(parseRelease(release())).toEqual({ version: '0.3.0', url, digest: 'sha256:' + 'a'.repeat(64) });
  });
  it('refuses responses that are not one of our releases', () => {
    expect(parseRelease(null)).toBeNull();
    expect(parseRelease({ message: 'API rate limit exceeded' })).toBeNull();
    expect(parseRelease(release({ tag_name: 'nightly' }))).toBeNull();
    expect(parseRelease(release({ assets: [] }))).toBeNull();
    expect(parseRelease(release({ assets: [{ name: ASSET_NAME, browser_download_url: 'https://example.com/simple-reader.zip' }] }))).toBeNull();
    expect(parseRelease(release({ assets: [{ name: ASSET_NAME, browser_download_url: 'https://github.com/someone/else/releases/download/v1/simple-reader.zip' }] }))).toBeNull();
  });
  it('offers the update only when it is newer than the running version', () => {
    const info = parseRelease(release())!;
    expect(pickUpdate(info, '0.2.0')).toEqual(info);
    expect(pickUpdate(info, '0.3.0')).toBeNull();
    expect(pickUpdate(info, '0.4.0')).toBeNull();
  });
});

describe('entryPathProblem', () => {
  it('accepts normal relative paths and folder entries', () => {
    for (const p of ['manifest.json', 'icons/icon16.png', 'icons/', 'a/b/c.js', '.hidden', 'x..y.js']) expect(entryPathProblem(p), p).toBeNull();
  });
  it('rejects empty, absolute, backslash, dot-dot and other unsafe paths', () => {
    for (const p of ['', '/etc/passwd', '../evil.js', 'icons/../../evil.js', 'a/..', 'icons\\icon.png', '..\\evil.js',
      'C:/Windows/evil.js', 'c:evil', 'a//b.js', './a.js', 'a/./b.js', '/', 'a\u0000b', 'a/b\n']) {
      expect(entryPathProblem(p), JSON.stringify(p)).not.toBeNull();
    }
  });
});

describe('validateRelease', () => {
  const good = (): Zippable => ({
    'content.js': strToU8('// content'),
    'icons/': new Uint8Array(0),
    'icons/icon16.png': new Uint8Array([1, 2, 3]),
    'manifest.json': manifest({ manifest_version: 3, name: 'Simple Reader', version: '0.3.0' }),
    'popup.js': strToU8('// popup'),
  });
  const roundTrip = (z: Zippable) => unzipSync(zipSync(z));

  it('returns the files from a real zip, folders dropped, manifest.json last', () => {
    const files = validateRelease(roundTrip(good()), ME);
    expect(files.map(([p]) => p)).toEqual(['content.js', 'icons/icon16.png', 'popup.js', 'manifest.json']);
    expect(Array.from(files[1][1])).toEqual([1, 2, 3]);
  });
  it('accepts the shape of the published v0.2.0 release (manifest from the repo)', () => {
    const real = readFileSync(new URL('../public/manifest.json', import.meta.url));
    const v = JSON.parse(real.toString()).version;
    const files = validateRelease(roundTrip({ 'manifest.json': new Uint8Array(real), 'icons/': new Uint8Array(0), 'icons/icon48.png': new Uint8Array([9]) }),
      { name: 'Simple Reader', version: v });
    expect(files.at(-1)![0]).toBe('manifest.json');
  });
  it('rejects a zip with manifest.json only in a subfolder', () => {
    const z = good();
    z['simple-reader/manifest.json'] = z['manifest.json'];
    delete z['manifest.json'];
    expect(() => validateRelease(roundTrip(z), ME)).toThrow(/no manifest.json at its top level/);
  });
  it('rejects a different extension or a version that is not the release tag', () => {
    expect(() => validateRelease(roundTrip({ ...good(), 'manifest.json': manifest({ name: 'Other', version: '0.3.0' }) }), ME)).toThrow(/different extension/);
    expect(() => validateRelease(roundTrip({ ...good(), 'manifest.json': manifest({ name: 'Simple Reader', version: '0.2.9' }) }), ME)).toThrow(/release is v0.3.0/);
    expect(() => validateRelease(roundTrip({ ...good(), 'manifest.json': strToU8('{not json') }), ME)).toThrow(/can't be read/);
  });
  it('rejects unsafe entry paths before anything else', () => {
    // fflate's zipSync normalises names, so build the unzipped map directly as unzipSync would return it.
    for (const bad of ['../evil.js', '/abs.js', 'icons\\x.png', '', 'a/../../b']) {
      const entries = { ...roundTrip(good()), [bad]: strToU8('x') };
      expect(() => validateRelease(entries, ME), JSON.stringify(bad)).toThrow(/unsafe file name/);
      expect(() => validateRelease(entries, ME)).toThrow(UpdateError);
    }
  });
  it('rejects a path that is both a file and a folder', () => {
    expect(() => validateRelease({ ...roundTrip(good()), icons: strToU8('x') }, ME)).toThrow(/both a file and a folder/);
  });
});

describe('digestMatches', () => {
  const bytes = strToU8('release bytes');
  const hex = createHash('sha256').update(bytes).digest('hex');
  it('checks sha256 digests', async () => {
    expect(await digestMatches(bytes, `sha256:${hex}`)).toBe(true);
    expect(await digestMatches(bytes, `sha256:${hex.toUpperCase()}`)).toBe(true);
    expect(await digestMatches(bytes, `sha256:${'0'.repeat(64)}`)).toBe(false);
  });
  it('lets through digests it cannot check', async () => {
    expect(await digestMatches(bytes, undefined)).toBe(true);
    expect(await digestMatches(bytes, 'md5:abc')).toBe(true);
  });
});

// ---- In-memory folder handle -------------------------------------------------------------
type Node = { kind: 'dir'; children: Map<string, Node> } | { kind: 'file'; data: Uint8Array };
function fakeDir(log: string[] = [], failOn?: string) {
  const root: Node = { kind: 'dir', children: new Map() };
  const notFound = () => Object.assign(new Error('not found'), { name: 'NotFoundError' });
  const dirHandle = (node: Extract<Node, { kind: 'dir' }>, path: string): DirHandleLike => ({
    async getDirectoryHandle(name, o) {
      let n = node.children.get(name);
      if (!n) { if (!o?.create) throw notFound(); n = { kind: 'dir', children: new Map() }; node.children.set(name, n); }
      if (n.kind !== 'dir') throw Object.assign(new Error('type mismatch'), { name: 'TypeMismatchError' });
      return dirHandle(n, path + name + '/');
    },
    async getFileHandle(name, o) {
      let n = node.children.get(name);
      if (!n) { if (!o?.create) throw notFound(); n = { kind: 'file', data: new Uint8Array(0) }; node.children.set(name, n); }
      if (n.kind !== 'file') throw Object.assign(new Error('type mismatch'), { name: 'TypeMismatchError' });
      const file = n;
      const fh: FileHandleLike = {
        async getFile() { return { text: async () => new TextDecoder().decode(file.data) }; },
        async createWritable() {
          let pending: Uint8Array | null = null;
          return {
            async write(d) { if (path + name === failOn) throw new Error('disk full'); pending = d; },
            async close() { file.data = pending ?? new Uint8Array(0); log.push(path + name); },
            async abort() { pending = null; },
          };
        },
      };
      return fh;
    },
  });
  const read = (p: string): string | undefined => {
    let n: Node | undefined = root;
    for (const part of p.split('/')) n = n?.kind === 'dir' ? n.children.get(part) : undefined;
    return n?.kind === 'file' ? new TextDecoder().decode(n.data) : undefined;
  };
  return { handle: dirHandle(root, ''), read, root };
}

describe('writeFiles', () => {
  it('writes every file into the right subfolder, manifest.json last', async () => {
    const log: string[] = [];
    const { handle, read } = fakeDir(log);
    const files: Array<[string, Uint8Array<ArrayBuffer>]> = [
      ['manifest.json', strToU8('{"v":2}')], // deliberately first: writeFiles must still write it last
      ['content.js', strToU8('c')],
      ['icons/icon16.png', strToU8('i16')],
      ['icons/icon48.png', strToU8('i48')],
      ['deep/a/b/c.txt', strToU8('deep')],
    ];
    const progress: number[] = [];
    await writeFiles(handle, files, done => progress.push(done));
    expect(log.at(-1)).toBe('manifest.json');
    expect(log.slice(0, -1).sort()).toEqual(['content.js', 'deep/a/b/c.txt', 'icons/icon16.png', 'icons/icon48.png']);
    expect(read('icons/icon16.png')).toBe('i16');
    expect(read('icons/icon48.png')).toBe('i48');
    expect(read('deep/a/b/c.txt')).toBe('deep');
    expect(read('manifest.json')).toBe('{"v":2}');
    expect(progress).toEqual([1, 2, 3, 4, 5]);
  });
  it('overwrites existing files and leaves manifest.json alone when a write fails', async () => {
    const ok = fakeDir();
    await writeFiles(ok.handle, [['manifest.json', strToU8('old')], ['content.js', strToU8('old')]]);
    await writeFiles(ok.handle, [['manifest.json', strToU8('new')], ['content.js', strToU8('new')]]);
    expect(ok.read('content.js')).toBe('new');
    expect(ok.read('manifest.json')).toBe('new');
    const failing = fakeDir([], 'content.js');
    await expect(writeFiles(failing.handle, [['manifest.json', strToU8('m')], ['content.js', strToU8('c')]])).rejects.toThrow(/Couldn't write content.js/);
    expect(failing.read('manifest.json')).toBeUndefined();
  });
  it('installs a validated zip end to end', async () => {
    const { handle, read } = fakeDir();
    const entries = unzipSync(zipSync({
      'manifest.json': manifest({ name: 'Simple Reader', version: '0.3.0' }),
      'icons/': new Uint8Array(0),
      'icons/icon128.png': strToU8('png'),
      'update.js': strToU8('js'),
    }));
    await writeFiles(handle, validateRelease(entries, ME));
    expect(read('icons/icon128.png')).toBe('png');
    expect(read('update.js')).toBe('js');
    expect(JSON.parse(read('manifest.json')!).version).toBe('0.3.0');
  });
});

describe('folderProblem', () => {
  const RUNNING = { name: 'Simple Reader', version: '0.2.0' };
  const withManifest = async (text: string | null) => {
    const f = fakeDir();
    if (text !== null) await writeFiles(f.handle, [['manifest.json', strToU8(text)]]);
    return f.handle;
  };
  it('accepts the folder of the running copy', async () => {
    expect(await folderProblem(await withManifest(JSON.stringify(RUNNING)), RUNNING)).toBeNull();
  });
  it('refuses a folder without manifest.json, with bad JSON, another extension or another version', async () => {
    expect(await folderProblem(await withManifest(null), RUNNING)).toMatch(/no manifest.json/);
    expect(await folderProblem(await withManifest('{oops'), RUNNING)).toMatch(/can't be read/);
    expect(await folderProblem(await withManifest(JSON.stringify({ name: 'Other', version: '0.2.0' })), RUNNING)).toMatch(/different extension/);
    expect(await folderProblem(await withManifest(JSON.stringify({ name: 'Simple Reader', version: '0.1.0' })), RUNNING)).toMatch(/running copy is 0.2.0/);
  });
});
