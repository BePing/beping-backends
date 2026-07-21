-- AFTT currently contains a small number of member identifiers shared between
-- the men's and women's files. Member identity is already the composite
-- (id, licence) primary key and every foreign key references that composite.
-- Keeping the historical id-only unique index makes valid imports fail.

DROP INDEX CONCURRENTLY IF EXISTS "Member_id_key";
