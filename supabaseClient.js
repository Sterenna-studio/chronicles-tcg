import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

export const supabase = createClient(
  'https://imryukpbtkngsihxfxox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imltcnl1a3BidGtuZ3NpaHhmeG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU5OTcwOTMsImV4cCI6MjA2MTU3MzA5M30.2uO9vMH5sFNBXS69Z01Xa4ofLV8rmgjUE-HPKgq9fVY'
)
