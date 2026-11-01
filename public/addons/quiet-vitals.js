/* Silences the app bundle's web-vitals debug output (FCP/TTFB/LCP/FID/CLS/
   INP/FCP objects printed to the console by the minified React bundle —
   a CRA leftover, harmless but noisy). The addon layer must NOT touch the
   bundle, so we only filter console.log: calls whose FIRST argument is the
   metrics object (it carries name/value/delta/entries/id) are dropped;
   everything else passes through untouched.
*/
(() => {
  "use strict";
  if (window.__bcaQuietVitals) return;
  window.__bcaQuietVitals = true;

  const VITAL_NAMES = ["FCP", "TTFB", "LCP", "FID", "CLS", "INP", "TTFB", "Next.js-hydration", "Navigation"];
  const isVitalDump = (args) => {
    if (!args.length || !args[0] || typeof args[0] !== "object") return false;
    const o = args[0];
    return typeof o.name === "string"
      && VITAL_NAMES.includes(o.name)
      && "value" in o
      && "delta" in o
      && "id" in o
      && "entries" in o;
  };

  const origLog = console.log.bind(console);
  console.log = (...args) => { if (!isVitalDump(args)) origLog(...args); };
})();
