CREATE TABLE IF NOT EXISTS scan_events (
  scan_id VARCHAR(64) NOT NULL PRIMARY KEY,
  uid VARCHAR(255) NOT NULL,
  user_id INT NULL,
  rfid_tag_id INT NULL,
  status ENUM('received', 'validated', 'committed', 'rejected', 'error') NOT NULL,
  error_code VARCHAR(64) NULL,
  error_message VARCHAR(255) NULL,
  beer_bu_id INT NULL,
  score INT NULL,
  source VARCHAR(64) NULL,
  scanned_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kiosk_session (
  kiosk_id VARCHAR(64) NOT NULL PRIMARY KEY,
  current_user_id INT NULL,
  expires_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE beer_bu
  ADD COLUMN scan_id VARCHAR(64) NULL;

CREATE UNIQUE INDEX ux_beer_bu_scan_id ON beer_bu (scan_id);
