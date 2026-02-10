-- AlterTable
ALTER TABLE "Document" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'editor';
ALTER TABLE "Document" ADD COLUMN "fileUrl" TEXT;
ALTER TABLE "Document" ADD COLUMN "fileSize" INTEGER;
ALTER TABLE "Document" ADD COLUMN "mimeType" TEXT;
