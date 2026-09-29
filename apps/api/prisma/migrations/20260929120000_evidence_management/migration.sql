ALTER TABLE "ingredient_evidence" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "score_snapshots" ADD COLUMN "evidence_key" TEXT NOT NULL DEFAULT 'legacy';
DROP INDEX "score_snapshots_variant_id_formula_id_profile_key_scoring_v_key";
CREATE UNIQUE INDEX "score_snapshots_inputs_key" ON "score_snapshots"("variant_id", "formula_id", "profile_key", "scoring_version", "evidence_key");
