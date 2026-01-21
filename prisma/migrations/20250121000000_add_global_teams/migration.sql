-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "bgColor" TEXT NOT NULL DEFAULT '#f1f5f9',
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable (junction table for many-to-many)
CREATE TABLE "_ProjectTeams" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProjectTeams_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_key_key" ON "Team"("key");

-- CreateIndex
CREATE INDEX "_ProjectTeams_B_index" ON "_ProjectTeams"("B");

-- AddForeignKey
ALTER TABLE "_ProjectTeams" ADD CONSTRAINT "_ProjectTeams_A_fkey" FOREIGN KEY ("A") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectTeams" ADD CONSTRAINT "_ProjectTeams_B_fkey" FOREIGN KEY ("B") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing ProjectTeam data to new Team table
-- First, insert unique teams (by key) from ProjectTeam
INSERT INTO "Team" ("id", "name", "key", "color", "bgColor", "icon", "order", "createdAt")
SELECT DISTINCT ON (pt."key")
    gen_random_uuid()::text,
    pt."name",
    pt."key",
    pt."color",
    pt."bgColor",
    pt."icon",
    pt."order",
    CURRENT_TIMESTAMP
FROM "ProjectTeam" pt
ON CONFLICT ("key") DO NOTHING;

-- Then, create the project-team associations
INSERT INTO "_ProjectTeams" ("A", "B")
SELECT DISTINCT pt."projectId", t."id"
FROM "ProjectTeam" pt
JOIN "Team" t ON t."key" = pt."key";
