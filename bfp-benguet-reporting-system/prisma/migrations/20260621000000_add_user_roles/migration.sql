-- AlterTable - Add permissions column to User table
-- This migration adds support for custom permissions storage for role-based access control

ALTER TABLE "users" ADD COLUMN "permissions" TEXT;

-- Add comment for documentation
-- permissions column stores JSON array of permissions assigned to the user
-- Can override default permissions based on their role
