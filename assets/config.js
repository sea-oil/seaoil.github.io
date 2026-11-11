// Public site configuration (safe to commit: no secret credentials).
// C-OIL review data uses dedicated tables and policies in the user's existing Supabase project.
window.COIL_CONFIG = {
  supabaseUrl: "https://wbvflaqqiomqrdtndkqe.supabase.co",
  supabasePublishableKey: "sb_publishable_9UYtKnGykZ3Pha3NHNU67Q_wEAwHopZ",
  // Fill this in after you register your website host in Cloudflare Turnstile.
  turnstileSiteKey: "REPLACE_WITH_TURNSTILE_SITE_KEY"
};
