-- Score rule codes may be reused in a new immutable rule-set version.
DROP INDEX "score_rules_code_key";

CREATE UNIQUE INDEX "score_rules_code_version_key" ON "score_rules"("code", "version");
