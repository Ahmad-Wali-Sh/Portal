// ─────────────────────────────────────────────────────────────────────────────
// announcement.service.js
//
// Auto-generates Announcement + Notification records when system events occur.
//
// How it works:
//   Each exported function is called from a routeConfig hook (afterCreate /
//   afterUpdate / afterDelete).  It writes:
//     1. One Announcement row  — rich detail, shown on the Announcements page.
//     2. One Notification row per relevant employee — brief, shown in the bell.
//
// Convention:
//   - Announcement body  → full sentence with all available context
//   - Notification body  → short (≤ 60 chars), "what happened" only
// ─────────────────────────────────────────────────────────────────────────────

const { prisma } = require('../config/prisma')

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all employee IDs — used when we want every staff member notified.
 */
async function allEmployeeIds() {
  const employees = await prisma.employee.findMany({ select: { id: true } })
  return employees.map((e) => e.id)
}

/**
 * Creates one Announcement row.
 * @param {{ title: string, body: string, target_type: string, target_id?: number, created_by: number, expires_at?: Date }} params
 */
async function createAnnouncement({ title, body, target_type, target_id, created_by, expires_at }) {
  try {
    await prisma.announcement.create({
      data: {
        title,
        body,
        target_type: target_type ?? 'all',
        target_id:   target_id   ?? null,
        created_by,
        expires_at:  expires_at  ?? null,
      },
    })
  } catch (err) {
    console.error('[announcement.service] Failed to create announcement:', err.message)
  }
}

/**
 * Creates one Notification row per recipient employee.
 * @param {{ recipientIds: number[], type: string, title: string, body: string, reference_id?: number, reference_type?: string }} params
 */
async function notifyEmployees({ recipientIds, type, title, body, reference_id, reference_type }) {
  if (!recipientIds?.length) return
  try {
    await prisma.notification.createMany({
      data: recipientIds.map((id) => ({
        recipient_id:   id,
        recipient_type: 'employee',
        type,
        title,
        body,
        reference_id:   reference_id   ?? null,
        reference_type: reference_type ?? null,
      })),
      skipDuplicates: true,
    })
  } catch (err) {
    console.error('[announcement.service] Failed to create notifications:', err.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EVENT: New class created
 * Trigger: routeConfig classes → afterCreate
 */
async function onClassCreated(classData) {
  const { id, cycle_id, location_id, employee_id, start_date, end_date, time_start } = classData

  // Fetch related names for richer messages
  const [cycle, location, employee] = await Promise.all([
    prisma.cycle.findUnique({ where: { id: cycle_id }, select: { name: true } }),
    prisma.location.findUnique({ where: { id: location_id }, select: { name: true } }),
    prisma.employee.findUnique({ where: { id: employee_id }, select: { name: true, lastname: true } }),
  ])

  const cycleName    = cycle?.name    ?? `Cycle #${cycle_id}`
  const locationName = location?.name ?? `Location #${location_id}`
  const teacherName  = employee ? `${employee.name} ${employee.lastname}` : 'Unassigned'
  const startFmt     = start_date ? new Date(start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  const endFmt       = end_date   ? new Date(end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  const announcementBody =
    `A new class for "${cycleName}" has been opened at ${locationName}. ` +
    `The class runs from ${startFmt} to ${endFmt}, starting at ${time_start}. ` +
    `Assigned instructor: ${teacherName}. Enrollment is now open.`

  const notifBody = `New class: ${cycleName} — starts ${startFmt}`

  const employeeIds = await allEmployeeIds()

  await Promise.all([
    createAnnouncement({
      title:      `New Class Opened — ${cycleName}`,
      body:       announcementBody,
      target_type:'all',
      created_by: employee_id,
    }),
    notifyEmployees({
      recipientIds:   employeeIds,
      type:           'announcement',
      title:          `New Class — ${cycleName}`,
      body:           notifBody,
      reference_id:   id,
      reference_type: 'classes',
    }),
  ])
}

/**
 * EVENT: Student enrolled in a class (dropped/removed)
 * Trigger: routeConfig studentClasses → afterDelete
 * Note: Enrollment itself is NOT announced (per spec), only removal.
 */
async function onStudentDropped({ studentClassId, actor_id }) {
  // We receive the record before deletion — look it up first if needed
  // In the hook we pass the full record
  const record = await prisma.studentClasses.findUnique({
    where: { id: studentClassId },
    include: {
      student: { select: { name: true, lastname: true, usid: true } },
      class:   { include: { cycle: true, location: true } },
    },
  })
  if (!record) return

  const { student, class: cls } = record
  const fullName  = `${student.name} ${student.lastname}`
  const cycleName = cls?.cycle?.name ?? `Class #${cls?.id}`
  const location  = cls?.location?.name ?? ''

  const announcementBody =
    `Student ${fullName} (USID: ${student.usid}) has been removed from the class ` +
    `"${cycleName}"${location ? ` at ${location}` : ''}. ` +
    `This action was recorded by administration.`

  const notifBody = `${fullName} removed from ${cycleName}`

  const employeeIds = await allEmployeeIds()

  await Promise.all([
    createAnnouncement({
      title:      `Student Removed — ${fullName}`,
      body:       announcementBody,
      target_type:'all',
      created_by: actor_id ?? 1,
    }),
    notifyEmployees({
      recipientIds:   employeeIds,
      type:           'announcement',
      title:          `Student Removed`,
      body:           notifBody,
      reference_id:   studentClassId,
      reference_type: 'student_classes',
    }),
  ])
}

/**
 * EVENT: Exam session scheduled (created)
 * Trigger: routeConfig examSession → afterCreate
 */
async function onExamScheduled(examSession) {
  const { id, subject_id, cycle_id, class_id, employee_id, date, start_time, end_time, description } = examSession

  const [subject, cycle, cls] = await Promise.all([
    prisma.subject.findUnique({ where: { id: subject_id }, select: { name: true } }),
    prisma.cycle.findUnique({ where: { id: cycle_id }, select: { name: true } }),
    prisma.classes.findUnique({
      where: { id: class_id },
      include: { location: { select: { name: true } } },
    }),
  ])

  const subjectName  = subject?.name ?? `Subject #${subject_id}`
  const cycleName    = cycle?.name   ?? `Cycle #${cycle_id}`
  const locationName = cls?.location?.name ?? ''
  const dateFmt      = date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  const announcementBody =
    `An exam has been scheduled for "${subjectName}" (${cycleName}). ` +
    `Date: ${dateFmt}, Time: ${start_time}–${end_time}` +
    `${locationName ? `, Location: ${locationName}` : ''}. ` +
    `${description ? `Notes: ${description}` : 'All enrolled students are expected to attend.'}` 

  const notifBody = `Exam: ${subjectName} on ${dateFmt} at ${start_time}`

  const employeeIds = await allEmployeeIds()

  await Promise.all([
    createAnnouncement({
      title:      `Exam Scheduled — ${subjectName}`,
      body:       announcementBody,
      target_type:'class',
      target_id:  class_id,
      created_by: employee_id,
    }),
    notifyEmployees({
      recipientIds:   employeeIds,
      type:           'exam',
      title:          `Exam Scheduled: ${subjectName}`,
      body:           notifBody,
      reference_id:   id,
      reference_type: 'exam_session',
    }),
  ])
}

/**
 * EVENT: Exam session status changed to "finished" (results published)
 * Trigger: routeConfig examSession → afterUpdate
 */
async function onExamResultsPublished(examSession) {
  const { id, subject_id, cycle_id, class_id, employee_id } = examSession

  const [subject, cycle] = await Promise.all([
    prisma.subject.findUnique({ where: { id: subject_id }, select: { name: true } }),
    prisma.cycle.findUnique({ where: { id: cycle_id }, select: { name: true } }),
  ])

  const subjectName = subject?.name ?? `Subject #${subject_id}`
  const cycleName   = cycle?.name   ?? `Cycle #${cycle_id}`

  // Count how many results were generated
  const resultCount = await prisma.examResult.count({ where: { exam_session_id: id } })
  const passCount   = await prisma.examResult.count({ where: { exam_session_id: id, passed: true } })

  const announcementBody =
    `Results for the "${subjectName}" exam (${cycleName}) are now available. ` +
    `${resultCount} student${resultCount !== 1 ? 's' : ''} were graded; ` +
    `${passCount} passed (${resultCount > 0 ? Math.round((passCount / resultCount) * 100) : 0}% pass rate). ` +
    `Students and teachers can now view individual scores.`

  const notifBody = `Results published: ${subjectName} — ${passCount}/${resultCount} passed`

  const employeeIds = await allEmployeeIds()

  await Promise.all([
    createAnnouncement({
      title:      `Exam Results Published — ${subjectName}`,
      body:       announcementBody,
      target_type:'class',
      target_id:  class_id,
      created_by: employee_id,
    }),
    notifyEmployees({
      recipientIds:   employeeIds,
      type:           'exam',
      title:          `Results Ready: ${subjectName}`,
      body:           notifBody,
      reference_id:   id,
      reference_type: 'exam_session',
    }),
  ])
}

/**
 * EVENT: Subject grades recorded
 * Trigger: routeConfig subjectGrade → afterCreate  (bulk or single)
 */
async function onGradesRecorded(gradeData) {
  const { id, subject_id, recorded_by, student_class_id } = gradeData

  const [subject, studentClass] = await Promise.all([
    prisma.subject.findUnique({ where: { id: subject_id }, select: { name: true } }),
    prisma.studentClasses.findUnique({
      where: { id: student_class_id },
      include: {
        student: { select: { name: true, lastname: true, usid: true } },
        class:   { include: { cycle: { select: { name: true } } } },
      },
    }),
  ])

  const subjectName  = subject?.name              ?? `Subject #${subject_id}`
  const studentName  = studentClass?.student
    ? `${studentClass.student.name} ${studentClass.student.lastname}`
    : 'a student'
  const cycleName    = studentClass?.class?.cycle?.name ?? ''

  const announcementBody =
    `Final grades for "${subjectName}"${cycleName ? ` (${cycleName})` : ''} have been recorded for ${studentName}. ` +
    `Scores include class work, project, and final exam components. ` +
    `Records are now available for review.`

  const notifBody = `Grades recorded: ${subjectName}${cycleName ? ` — ${cycleName}` : ''}`

  const employeeIds = await allEmployeeIds()

  await Promise.all([
    createAnnouncement({
      title:      `Grades Recorded — ${subjectName}`,
      body:       announcementBody,
      target_type:'all',
      created_by: recorded_by,
    }),
    notifyEmployees({
      recipientIds:   employeeIds,
      type:           'general',
      title:          `Grades: ${subjectName}`,
      body:           notifBody,
      reference_id:   id,
      reference_type: 'subject_grade',
    }),
  ])
}

/**
 * EVENT: Certificates generated for a class
 * Trigger: Called manually from the CertificatePage after ZIP download
 *          (POST /api/announcements/certificates-generated  or via a dedicated endpoint)
 * @param {{ classId: number, cycleName: string, count: number, actor_id: number }} params
 */
async function onCertificatesGenerated({ classId, cycleName, count, actor_id }) {
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const announcementBody =
    `${count} completion certificate${count !== 1 ? 's' : ''} have been generated for "${cycleName}". ` +
    `The certificates were produced on ${today} and are ready for distribution. ` +
    `Students who successfully completed the cycle are included in this batch.`

  const notifBody = `${count} certificates generated for ${cycleName}`

  const employeeIds = await allEmployeeIds()

  await Promise.all([
    createAnnouncement({
      title:      `Certificates Generated — ${cycleName}`,
      body:       announcementBody,
      target_type:'class',
      target_id:  classId,
      created_by: actor_id,
    }),
    notifyEmployees({
      recipientIds:   employeeIds,
      type:           'announcement',
      title:          `Certificates Ready: ${cycleName}`,
      body:           notifBody,
      reference_id:   classId,
      reference_type: 'classes',
    }),
  ])
}

/**
 * EVENT: Payment marked as overdue (due_date passed, status still pending)
 * Trigger: A scheduled job or a beforeUpdate hook detecting the overdue state.
 *          Call this when you detect a payment that has passed due_date.
 */
async function onPaymentOverdue(payment) {
  const { id, student_class_id, name: paymentName, price, due_date } = payment

  const studentClass = await prisma.studentClasses.findUnique({
    where: { id: student_class_id },
    include: {
      student: { select: { name: true, lastname: true, usid: true } },
      class:   { include: { cycle: { select: { name: true } } } },
    },
  })

  const studentName = studentClass?.student
    ? `${studentClass.student.name} ${studentClass.student.lastname}`
    : 'Unknown Student'
  const usid        = studentClass?.student?.usid ?? '—'
  const cycleName   = studentClass?.class?.cycle?.name ?? ''
  const dueFmt      = new Date(due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const amount      = Number(price).toLocaleString()

  const announcementBody =
    `A payment installment is overdue for student ${studentName} (USID: ${usid}). ` +
    `Installment: "${paymentName}"${cycleName ? ` — ${cycleName}` : ''}. ` +
    `Amount: ${amount}. Original due date: ${dueFmt}. ` +
    `Please follow up with the student or their responsible contact.`

  const notifBody = `Overdue payment: ${studentName} — ${amount}`

  const employeeIds = await allEmployeeIds()

  await Promise.all([
    createAnnouncement({
      title:      `Overdue Payment — ${studentName}`,
      body:       announcementBody,
      target_type:'employee',
      created_by: 1, // system actor — replace with real admin id if available
    }),
    notifyEmployees({
      recipientIds:   employeeIds,
      type:           'payment',
      title:          `Overdue Payment`,
      body:           notifBody,
      reference_id:   id,
      reference_type: 'student_payment',
    }),
  ])
}

/**
 * EVENT: New employee added to the system
 * Trigger: routeConfig employees → afterCreate
 */
async function onEmployeeCreated(employee) {
  const { id, name, lastname, email, role_id } = employee

  const role = role_id
    ? await prisma.role.findUnique({ where: { id: role_id }, select: { name: true } })
    : null
  const roleName = role?.name ?? 'Staff'

  const announcementBody =
    `${name} ${lastname} has joined the team as ${roleName}. ` +
    `Contact: ${email}. ` +
    `Their account is now active and they have been granted the appropriate system access.`

  const notifBody = `New ${roleName}: ${name} ${lastname}`

  const employeeIds = await allEmployeeIds()

  await Promise.all([
    createAnnouncement({
      title:      `New Team Member — ${name} ${lastname}`,
      body:       announcementBody,
      target_type:'employee',
      created_by: id, // self (or use a system actor if you have one)
    }),
    notifyEmployees({
      recipientIds:   employeeIds.filter((eid) => eid !== id), // don't notify yourself
      type:           'general',
      title:          `New Team Member`,
      body:           notifBody,
      reference_id:   id,
      reference_type: 'employee',
    }),
  ])
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  onClassCreated,
  onStudentDropped,
  onExamScheduled,
  onExamResultsPublished,
  onGradesRecorded,
  onCertificatesGenerated,
  onPaymentOverdue,
  onEmployeeCreated,
}