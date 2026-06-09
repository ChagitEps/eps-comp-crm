-- Migration 014: Make business_name the primary required field for customers
-- In a B2B CRM, company name is the anchor identity, not the contact person.
-- Backfill any rows where business_name is null, then swap the NOT NULL constraints.

-- Step 1: Backfill — copy name into business_name wherever business_name is empty
UPDATE customers
SET business_name = name
WHERE business_name IS NULL OR business_name = '';

-- Step 2: business_name becomes required (company name is the B2B anchor)
ALTER TABLE customers ALTER COLUMN business_name SET NOT NULL;

-- Step 3: name becomes optional (contact person may not always be known)
ALTER TABLE customers ALTER COLUMN name DROP NOT NULL;
