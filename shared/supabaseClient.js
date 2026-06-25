import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const supabase = createClient(
  'https://nmdjrcswlnydglrxaivx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tZGpyY3N3bG55ZGdscnhhaXZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTU2MjksImV4cCI6MjA4OTk5MTYyOX0.yk5Rxid6Jhl4NtX_7XXzNcfbJmDtYsiyBWiZafwg5cE'
);
