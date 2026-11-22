-- VIDNEX — Instagram Stories configuration defaults
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('feature_stories', 'false'),
  ('stories_provider_order', 'session,relay,paid'),
  ('stories_list_rate_limit_per_hour', '5'),
  ('stories_global_hourly_cap', '200');
