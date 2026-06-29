-- Convert Task.status and Comment.taskStatusAtCreation from the "TaskStatus"
-- Postgres enum to plain TEXT. This lets custom per-project statuses (the
-- ProjectStatus table, e.g. "REVISE") actually be stored on a task — previously
-- the enum rejected any value outside the 6 hardcoded ones and every such
-- update failed with a 500.
--
-- USING "<col>"::text preserves all existing values (the enum labels become the
-- identical text values), so this migration is data-safe.

-- AlterTable: Task.status
ALTER TABLE "Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE TEXT USING "status"::text;
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'TODO';

-- AlterTable: Comment.taskStatusAtCreation (nullable, no default)
ALTER TABLE "Comment" ALTER COLUMN "taskStatusAtCreation" TYPE TEXT USING "taskStatusAtCreation"::text;

-- DropEnum: no column references "TaskStatus" anymore
DROP TYPE "TaskStatus";
