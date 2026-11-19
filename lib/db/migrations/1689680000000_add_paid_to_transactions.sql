-- Add paid column to transactions (default true)
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT true;

-- Down migration (optional)
-- ALTER TABLE transactions DROP COLUMN IF EXISTS paid;
