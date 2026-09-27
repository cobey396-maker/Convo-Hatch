-- Callback day preference: a date in the business's time zone, or NULL for "first available day".
ALTER TABLE leads ADD COLUMN preferred_day date;
