-- Add a normalized lookup key without losing existing ingredient records.
ALTER TABLE "ingredients" ADD COLUMN "normalized_name" TEXT;

UPDATE "ingredients"
SET "normalized_name" = upper(regexp_replace(btrim("inci_name"), '\s+', ' ', 'g'));

ALTER TABLE "ingredients" ALTER COLUMN "normalized_name" SET NOT NULL;

-- CreateTable
CREATE TABLE "ingredient_aliases" (
    "id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized_alias" TEXT NOT NULL,
    "source_name" TEXT,
    "reviewed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredient_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_normalized_name_key" ON "ingredients"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_aliases_normalized_alias_key" ON "ingredient_aliases"("normalized_alias");

-- CreateIndex
CREATE INDEX "ingredient_aliases_ingredient_id_idx" ON "ingredient_aliases"("ingredient_id");

-- AddForeignKey
ALTER TABLE "ingredient_aliases" ADD CONSTRAINT "ingredient_aliases_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
