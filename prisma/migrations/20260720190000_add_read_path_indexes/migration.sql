-- These indexes support the API's hottest licence/date lookups and the daily
-- member/result aggregation without locking writes for the duration of the
-- index build. Keep this migration outside an explicit transaction because
-- PostgreSQL does not allow CREATE INDEX CONCURRENTLY inside one.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_numeric_points_licence_date"
ON "NumericPoints"("memberLicence", "date");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_individual_result_member_identity"
ON "IndividualResult"("memberId", "memberLicence");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_individual_result_licence_category_date"
ON "IndividualResult"("memberLicence", "playerCategory", "date");
