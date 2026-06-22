export interface Highlighter {
  highlightWord(tokenIndex: number): void;
  highlightSentence(sentenceId: number): void;
  clearActive(): void;
  /** Token at a viewport point (for click-to-start); -1 if none. */
  tokenAtPoint(x: number, y: number): number;
  destroy(): void;
}
