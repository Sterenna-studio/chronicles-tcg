TCG — Compat Patch 2.1.2
Replace these files in your project:
- logic/supaRaw.js       (ES2015 module + exposes window.tcg_supaRaw_* globals)
- data/supabaseData.js   (global IIFE, no const/let/async/export)
- app/ui-shell.js        (uses the globals above)

After copying, bump query params to break caches in index.html:
<script type="module" src="./version.js?v=212"></script>
<script type="module">
  import { boot } from './app/router.js?v=212';
  import './app/ui-shell.js?v=212';
  boot();
</script>
