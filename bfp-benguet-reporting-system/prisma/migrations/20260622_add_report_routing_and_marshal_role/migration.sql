-- Add new columns to reports table for report routing
ALTER TABLE reports ADD COLUMN passedToRole TEXT;
ALTER TABLE reports ADD COLUMN passedToId INTEGER;

-- No need to recreate the table for SQLite, just add the columns and create the foreign key separately
-- For better compatibility, we'll use pragma to handle the migration
