-- Add new subscription_plan enum values in a separate migration
-- PostgreSQL requires ALTER TYPE ADD VALUE to be committed before the
-- new values can be used in INSERT statements within the same transaction.
-- By splitting this into its own migration, the values are committed
-- before migration 5 tries to INSERT rows using them.

alter type public.subscription_plan add value if not exists 'government';
alter type public.subscription_plan add value if not exists 'university';
alter type public.subscription_plan add value if not exists 'custom';
