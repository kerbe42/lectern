export type Mode = 'overlay' | 'inplace';
export type Source = 'page' | 'selection';
export type PlaybackState = 'idle' | 'playing' | 'paused';

export interface Token {
  index: number;
  text: string;
  charIndex: number; // start offset in spokenText
  charEnd: number;   // end offset in spokenText
  sentenceId: number;
}
export interface Sentence {
  id: number;
  start: number;     // char offset in spokenText
  end: number;
  firstToken: number;
  lastToken: number;
  heading?: boolean; // a heading/title: spoken on its own, with a pause around it
}
export interface TokenMap {
  spokenText: string;
  tokens: Token[];
  sentences: Sentence[];
}
export interface Chunk {
  text: string;       // slice of spokenText spoken as one utterance
  startOffset: number;// char offset of text within spokenText
  firstToken: number;
  lastToken: number;
  heading?: boolean;
}

export interface Settings {
  defaultVoiceURI: string | null;
  rate: number;       // 0.5–4
  mode: Mode;
  wordColor: string;
  sentenceColor: string;
}
export const DEFAULT_SETTINGS: Settings = {
  defaultVoiceURI: null,
  rate: 1,
  mode: 'inplace', // tap a word on the page to start; falls back to the panel if nothing is readable
  wordColor: '#ffd54a',
  sentenceColor: 'rgba(255, 213, 74, 0.28)',
};
