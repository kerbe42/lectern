import { describe, it, expect } from 'vitest';
import { rankVoices, pickVoice, voiceQuality } from '../src/content/speech/voices';

const v = (name: string, lang: string, localService: boolean) => ({ name, lang, localService, voiceURI: name });

// Roughly what Edge on Windows offers (built-in voices first, as the browser lists them).
const edge = [
  v('Microsoft David - English (United States)', 'en-US', true),
  v('Microsoft Mark - English (United States)', 'en-US', true),
  v('Microsoft Zira - English (United States)', 'en-US', true),
  v('Microsoft Ana Online (Natural) - English (United States)', 'en-US', false),
  v('Microsoft Andrew Online (Natural) - English (United States)', 'en-US', false),
  v('Microsoft AvaMultilingual Online (Natural) - English (United States)', 'en-US', false),
  v('Microsoft Clara Online (Natural) - English (Canada)', 'en-CA', false),
  v('Microsoft Denise Online (Natural) - French (France)', 'fr-FR', false),
];
// Roughly what Chrome on Windows offers.
const chrome = [
  v('Microsoft David - English (United States)', 'en-US', true),
  v('Google US English', 'en-US', false),
  v('Google UK English Female', 'en-GB', false),
  v('Google français', 'fr-FR', false),
];

describe('voice choice', () => {
  it('rates natural voices above other online voices above built-in ones', () => {
    expect(voiceQuality(edge[4])).toBe(3);
    expect(voiceQuality(chrome[1])).toBe(2);
    expect(voiceQuality(edge[0])).toBe(1);
  });
  it('defaults to a natural voice in Edge, not the robotic built-in one', () => {
    const best = pickVoice(edge, null, 'en-US')!;
    expect(best.name).toMatch(/Natural/);
    expect(best.name).not.toMatch(/Ana /); // not the child voice
    expect(best.name).toMatch(/Ava/);
  });
  it('prefers the user region when the page language matches it', () => {
    expect(rankVoices(edge, 'en', 'en-CA')[0].name).toMatch(/Clara/);
  });
  it("matches the page's language first", () => {
    expect(pickVoice(edge, null, 'fr')!.name).toMatch(/Denise/);
    expect(pickVoice(chrome, null, 'fr-FR')!.name).toBe('Google français');
  });
  it("prefers Chrome's online voice over the built-in one", () => {
    expect(pickVoice(chrome, null, 'en-US')!.name).toBe('Google US English');
  });
  it('keeps a voice the user picked', () => {
    expect(pickVoice(edge, edge[0].voiceURI, 'en-US')!.name).toMatch(/David/);
  });
  it('falls back to ranking when the saved voice is gone', () => {
    expect(pickVoice(edge, 'gone', 'en-US')!.name).toMatch(/Natural/);
  });
});
