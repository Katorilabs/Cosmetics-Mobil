ALTER TABLE "reviews" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
CREATE TABLE "review_reports" (
  "id" UUID NOT NULL,
  "review_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "review_revision" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "review_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "review_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "review_reports_user_id_review_id_review_revision_key" ON "review_reports"("user_id", "review_id", "review_revision");
CREATE INDEX "review_reports_resolved_at_created_at_idx" ON "review_reports"("resolved_at", "created_at");
CREATE INDEX "review_reports_review_id_idx" ON "review_reports"("review_id");
