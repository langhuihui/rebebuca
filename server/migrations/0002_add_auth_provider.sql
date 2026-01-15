-- Add auth_provider column to users table
ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'email';

-- Make password_hash nullable for OAuth users
-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table
-- For now, we'll just allow NULL values by using a default empty string for OAuth users
