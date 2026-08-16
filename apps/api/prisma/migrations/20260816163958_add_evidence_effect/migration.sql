-- CreateEnum
CREATE TYPE "EvidenceEffect" AS ENUM ('INFORMATIONAL', 'BENEFICIAL', 'CAUTION', 'AVOID');

-- AlterTable
ALTER TABLE "ingredient_evidence" ADD COLUMN     "effect" "EvidenceEffect" NOT NULL DEFAULT 'INFORMATIONAL';

-- CreateIndex
CREATE INDEX "ingredient_evidence_effect_level_idx" ON "ingredient_evidence"("effect", "level");
