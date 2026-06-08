CREATE TABLE rate_limits (
  key          TEXT    PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start BIGINT  NOT NULL,
  window_ms    BIGINT  NOT NULL
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- anon va authenticated uchun to'liq yopiq (service_role RLS ni bypass qiladi)
CREATE POLICY "deny_public_access" ON rate_limits
  AS RESTRICTIVE
  TO anon, authenticated
  USING (false);
