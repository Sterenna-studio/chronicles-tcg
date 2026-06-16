// TCG/shared/supabaseClient.js
// Pont vers le client Supabase partagé Nitro Star.
// On réexporte 'supabase' depuis /shared/supabase-client.js
// → même instance, même localStorage, même session que le reste du site.
export { supabase } from '/shared/supabase-client.js';
