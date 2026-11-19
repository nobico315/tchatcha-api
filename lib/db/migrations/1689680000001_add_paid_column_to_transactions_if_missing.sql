-- Ensure the existing transactions table supports paid/unpaid state
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT true;
