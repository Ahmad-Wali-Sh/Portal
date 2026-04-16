/*
  Warnings:

  - You are about to drop the `Student` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PaidStatusName" AS ENUM ('paid', 'partial', 'pending');

-- CreateEnum
CREATE TYPE "ExamStatusName" AS ENUM ('draft', 'ongoing', 'finished', 'cancelled');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('four_answer', 'boolean', 'descriptive');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('exam', 'payment', 'session', 'announcement', 'general');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('employee', 'student');

-- CreateEnum
CREATE TYPE "AnnouncementTarget" AS ENUM ('all', 'class', 'cycle', 'employee');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'login', 'grade');

-- DropTable
DROP TABLE "Student";
