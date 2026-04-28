-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actor_id_fkey";

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "actor_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
