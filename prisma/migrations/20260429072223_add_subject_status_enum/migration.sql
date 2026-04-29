-- CreateEnum
CREATE TYPE "SubjectStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'FINISHED');

-- AlterTable
ALTER TABLE "SubjectActivate" ADD COLUMN     "status" "SubjectStatus" NOT NULL DEFAULT 'INACTIVE',
ALTER COLUMN "date_start" DROP NOT NULL,
ALTER COLUMN "date_end" DROP NOT NULL;
