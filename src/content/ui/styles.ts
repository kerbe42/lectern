export const SHADOW_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, sans-serif; }
.lec-bar {
  position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  background: #1f2937; color: #f9fafb; border-radius: 999px;
  box-shadow: 0 6px 24px rgba(0,0,0,.35); z-index: 2147483647; font-size: 13px;
}
.lec-bar button { background: #374151; color: #f9fafb; border: 0; border-radius: 8px;
  width: 34px; height: 34px; cursor: pointer; font-size: 15px; line-height: 1; }
.lec-bar button:hover { background: #4b5563; }
.lec-bar .lec-prog { width: 120px; height: 6px; background: #4b5563; border-radius: 4px; cursor: pointer; }
.lec-bar .lec-prog > div { height: 100%; width: 0%; background: #ffd54a; border-radius: 4px; }
.lec-bar select { background: #374151; color: #f9fafb; border: 0; border-radius: 8px; padding: 4px; max-width: 150px; }
.lec-bar .lec-rate { min-width: 38px; text-align: center; }
.lec-resume { position: fixed; left: 50%; bottom: 64px; transform: translateX(-50%);
  background: #2563eb; color: #fff; padding: 8px 14px; border-radius: 8px; cursor: pointer;
  z-index: 2147483647; box-shadow: 0 4px 16px rgba(0,0,0,.3); }

.lec-panel { position: fixed; top: 0; right: 0; width: 46vw; max-width: 720px; height: 100vh;
  background: #fbfbf8; color: #16181d; overflow-y: auto; padding: 48px 56px 120px; z-index: 2147483646;
  box-shadow: -4px 0 24px rgba(0,0,0,.18); line-height: 1.7; font-size: 18px; }
.lec-panel h1 { font-size: 26px; margin-top: 0; }
.lec-panel img { max-width: 100%; height: auto; }
.lec-panel a { color: #2563eb; }
.lec-w { transition: background .08s; }
.lec-sent-active { background: rgba(255,213,74,.28); }
.lec-w-active { background: #ffd54a; color: #111; border-radius: 3px; }

/* --- Phone / narrow-screen layout --- */
@media (max-width: 760px) {
  .lec-panel { width: 100vw; max-width: none; padding: 20px 16px 160px; font-size: 19px; line-height: 1.75; }
  .lec-panel h1 { font-size: 22px; }
  .lec-bar {
    left: 0; right: 0; bottom: 0; transform: none; width: 100%;
    border-radius: 14px 14px 0 0; flex-wrap: wrap; justify-content: center;
    gap: 10px; padding: 10px 10px calc(10px + env(safe-area-inset-bottom, 0px));
  }
  .lec-bar button { width: 44px; height: 44px; font-size: 18px; }   /* 44px = comfortable touch target */
  .lec-bar .lec-prog { order: 10; width: 100%; height: 9px; }       /* progress on its own full-width row */
  .lec-bar select { max-width: 46%; height: 40px; }
  .lec-resume { bottom: auto; top: 12px; }                          /* keep clear of the bottom bar */
}
`;
