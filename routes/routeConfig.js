/**
 * routeConfig.js
 *
 * All API resources are defined here as an array of config objects.
 * The factory reads this and mounts routes automatically onto the Express app.
 */

// const { employeeAuth, studentAuth, requirePermission } = require('../middlewares/auth.middleware')
// const { PERMISSIONS } = require('../config/permissions')
const { generateInstallments } = require('../services/installment.service')
const { writeAuditLog } = require('../services/auditLogger')
const { auditHooks } = require('../services/auditHooks')
const prisma = require('../config/prisma')

/** @type {import('../factory/routeFactory').ResourceConfig[]} */
const routeConfig = [

  // ── GENERAL INFORMATION ──────────────────────────────────────────────────
  {
    model: 'generalInformation',
    basePath: '/api/general',
    routes: ['getAll', 'getById', 'patch'],
    hooks: {
      ...auditHooks('generalInformation', 'general_information', prisma),
    },
  },

  // ── EMPLOYEES ────────────────────────────────────────────────────────────
  {
    model: 'employee',
    basePath: '/api/employees',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['name', 'lastname', 'email', 'phone_number'],
    include: { role: true, gender: true },
    hooks: {
      // -- beforeCreate (custom) --
      beforeCreate: async (req, res, body) => {
        if (body.password) {
          const bcrypt = require('bcryptjs')
          body.password = await bcrypt.hash(body.password, 12)
        }
        return body
      },
      // -- afterCreate (merged: log + audit) --
      afterCreate: async (req, res, data) => {
        console.log(`[employee] Created: ${data.email}`)
        await writeAuditLog(prisma, {
          action: 'create',
          entity_type: 'employee',
          entity_id: data.id,
          newValue: data,
          actor: req.employee,
          actorIp: req.ip,
        })
      },
      // -- beforeUpdate (merged: fetch old + password) --
      beforeUpdate: async (req, res, body) => {
        const id = parseInt(req.params.id, 10)
        req._oldRecord = await prisma.employee.findUnique({ where: { id } })
        if (body.password) {
          const bcrypt = require('bcryptjs')
          body.password = await bcrypt.hash(body.password, 12)
        }
        return body
      },
      afterUpdate: auditHooks('employee', 'employee', prisma).afterUpdate,
      beforeDelete: auditHooks('employee', 'employee', prisma).beforeDelete,
      afterDelete: auditHooks('employee', 'employee', prisma).afterDelete,
    },
  },

  // ── GENDERS ──────────────────────────────────────────────────────────────
  {
    model: 'gender',
    basePath: '/api/genders',
    routes: ['getAll', 'getById', 'post', 'patch', 'put', 'delete'],
    searchFields: ['name'],
    hooks: auditHooks('gender', 'gender', prisma),
  },

  // ── ROLES ────────────────────────────────────────────────────────────────
  {
    model: 'role',
    basePath: '/api/roles',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['name'],
    hooks: auditHooks('role', 'role', prisma),
  },

  // ── PERMISSIONS ──────────────────────────────────────────────────────────
  {
    model: 'permission',
    basePath: '/api/permissions',
    routes: ['getAll', 'getById'],
    searchFields: ['name'],
  },

  // ── LOCATIONS ────────────────────────────────────────────────────────────
  {
    model: 'location',
    basePath: '/api/locations',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['name'],
    hooks: auditHooks('location', 'location', prisma),
  },

  // ── SUBJECTS ─────────────────────────────────────────────────────────────
  {
    model: 'subject',
    basePath: '/api/subjects',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['name'],
    hooks: auditHooks('subject', 'subject', prisma),
  },

  // ── CYCLES ───────────────────────────────────────────────────────────────
  {
    model: 'cycle',
    basePath: '/api/cycles',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['name'],
    include: { cycleSubjects: { include: { subject: true } } },
    hooks: auditHooks('cycle', 'cycle', prisma),
  },

  // ── CYCLE SUBJECTS ────────────────────────────────────────────────────────
  {
    model: 'cycleSubject',
    basePath: '/api/cycle-subjects',
    routes: ['getAll', 'getById', 'post', 'delete'],
    include: { cycle: true, subject: true },
    hooks: auditHooks('cycleSubject', 'cycle_subject', prisma),
  },

  // ── CLASSES ───────────────────────────────────────────────────────────────
  {
    model: 'classes',
    basePath: '/api/classes',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: [],
    include: {
      cycle: true,
      location: true,
      employee: { select: { id: true, name: true, lastname: true, email: true } },
    },
    hooks: auditHooks('classes', 'class', prisma),
  },

  // ── SUBJECT ACTIVATIONS ───────────────────────────────────────────────────
  {
    model: 'subjectActivate',
    basePath: '/api/subject-activations',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    include: { class: true, subject: true },
    hooks: auditHooks('subjectActivate', 'subject_activation', prisma),
  },

  // ── STUDENTS ──────────────────────────────────────────────────────────────
  {
    model: 'student',
    basePath: '/api/students',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['name', 'lastname', 'usid', 'phone_1', 'father_name'],
    include: { gender: true },
    hooks: {
      beforeCreate: async (req, res, body) => {
        if (!body.usid) {
          const { generateUSID } = require('../utils/usid')
          body.usid = generateUSID()
        }
        if (body.password) {
          const bcrypt = require('bcryptjs')
          body.password = await bcrypt.hash(body.password, 12)
        }
        return body
      },
      afterCreate: async (req, res, data) => {
        await writeAuditLog(prisma, {
          action: 'create',
          entity_type: 'student',
          entity_id: data.id,
          newValue: data,
          actor: req.employee,
          actorIp: req.ip,
        })
        return data
      },
      beforeUpdate: async (req, res, body) => {
        const id = parseInt(req.params.id, 10)
        req._oldRecord = await prisma.student.findUnique({ where: { id } })
        if (body.password) {
          const bcrypt = require('bcryptjs')
          body.password = await bcrypt.hash(body.password, 12)
        }
        return body
      },
      afterUpdate: auditHooks('student', 'student', prisma).afterUpdate,
      beforeDelete: auditHooks('student', 'student', prisma).beforeDelete,
      afterDelete: auditHooks('student', 'student', prisma).afterDelete,
    },
  },

  // ── STUDENT CLASSES (ENROLLMENTS) ────────────────────────────────────────
  {
    model: 'studentClasses',
    basePath: '/api/student-classes',
    routes: ['getAll', 'getById', 'post', 'delete'],
    include: {
      student: { select: { id: true, name: true, lastname: true, usid: true } },
      class: { include: { cycle: true, location: true } },
    },
    hooks: {
      afterCreate: async (req, res, data) => {
        await generateInstallments(data)
        await writeAuditLog(prisma, {
          action: 'create',
          entity_type: 'student_class',
          entity_id: data.id,
          newValue: data,
          actor: req.employee,
          actorIp: req.ip,
        })
        return data
      },
      beforeDelete: auditHooks('studentClasses', 'student_class', prisma).beforeDelete,
      afterDelete: auditHooks('studentClasses', 'student_class', prisma).afterDelete,
    },
  },

  // ── CURRICULUM ────────────────────────────────────────────────────────────
  {
    model: 'curriculum',
    basePath: '/api/curriculums',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['name'],
    include: {
      cycle: true,
      class: true,
      employee: { select: { id: true, name: true, lastname: true } },
      entries: { include: { subject: true } },
    },
    hooks: auditHooks('curriculum', 'curriculum', prisma),
  },

  // ── CURRICULUM ENTRIES ────────────────────────────────────────────────────
  {
    model: 'curriculumThrough',
    basePath: '/api/curriculum-entries',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['name', 'description'],
    include: { curriculum: true, subject: true },
    hooks: auditHooks('curriculumThrough', 'curriculum_entry', prisma),
  },

  // ── ATTENDANCE SESSIONS ───────────────────────────────────────────────────
  {
    model: 'attendanceSession',
    basePath: '/api/attendance-sessions',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    include: {
      class: true,
      employee: { select: { id: true, name: true, lastname: true } },
      curriculumThrough: true,
      records: true,
    },
    hooks: auditHooks('attendanceSession', 'attendance_session', prisma),
  },

  // ── ATTENDANCE RECORDS (per student per session) ──────────────────────────
  {
    model: 'attendanceSessionThrough',
    basePath: '/api/attendance-records',
    routes: ['getAll', 'getById', 'post', 'patch'],
    include: {
      session: true,
      studentClass: {
        include: { student: { select: { id: true, name: true, lastname: true, usid: true } } },
      },
    },
    hooks: auditHooks('attendanceSessionThrough', 'attendance_record', prisma),
  },

  // ── PAYMENTS ──────────────────────────────────────────────────────────────
  {
    model: 'studentPayment',
    basePath: '/api/payments',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['name', 'note'],
    include: {
      studentClass: {
        include: { student: { select: { id: true, name: true, lastname: true, usid: true } } },
      },
      paidStatus: true,
      collectedBy: { select: { id: true, name: true, lastname: true } },
    },
    hooks: {
      afterCreate: async (req, res, record) => {
        await writeAuditLog(prisma, {
          action: 'create',
          entity_type: 'payment',
          entity_id: record.id,
          newValue: record,
          actor: req.employee,
          actorIp: req.ip,
        })
        return record
      },
      beforeUpdate: async (req, res, body) => {
        const id = parseInt(req.params.id, 10)
        req._oldRecord = await prisma.studentPayment.findUnique({ where: { id } })
        if (body.paid_status_id) {
          const status = await prisma.paidStatus.findUnique({
            where: { id: body.paid_status_id },
          })
          if (status?.name === 'paid' && !body.paid_at) {
            body.paid_at = new Date()
          }
        }
        return body
      },
      afterUpdate: auditHooks('studentPayment', 'payment', prisma).afterUpdate,
      beforeDelete: auditHooks('studentPayment', 'payment', prisma).beforeDelete,
      afterDelete: auditHooks('studentPayment', 'payment', prisma).afterDelete,
    },
  },

  // ── QUESTIONS ────────────────────────────────────────────────────────────
  {
    model: 'question',
    basePath: '/api/questions',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['topic'],
    include: {
      subject: true,
      employee: { select: { id: true, name: true, lastname: true } },
      fourAnswerQuestion: true,
      booleanQuestion: true,
      descriptiveQuestion: true,
    },
    hooks: auditHooks('question', 'question', prisma),
  },

  // ── EXAM SESSIONS ─────────────────────────────────────────────────────────
  {
    model: 'examSession',
    basePath: '/api/exam-sessions',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['description'],
    include: {
      subject: true,
      cycle: true,
      class: true,
      employee: { select: { id: true, name: true, lastname: true } },
      status: true,
    },
    hooks: {
      afterCreate: async (req, res, record) => {
        await writeAuditLog(prisma, {
          action: 'create',
          entity_type: 'exam_session',
          entity_id: record.id,
          newValue: record,
          actor: req.employee,
          actorIp: req.ip,
        })
      },
      beforeUpdate: async (req, res, body) => {
        const id = parseInt(req.params.id, 10)
        req._oldRecord = await prisma.examSession.findUnique({ where: { id } })
        return body
      },
      afterUpdate: auditHooks('examSession', 'exam_session', prisma).afterUpdate,
      beforeDelete: auditHooks('examSession', 'exam_session', prisma).beforeDelete,
      afterDelete: auditHooks('examSession', 'exam_session', prisma).afterDelete,
    },
  },

  // ── EXAM RESULTS ──────────────────────────────────────────────────────────
  {
    model: 'examResult',
    basePath: '/api/exam-results',
    routes: ['getAll', 'getById', 'post'],
    include: {
      student: { select: { id: true, name: true, lastname: true, usid: true } },
      examSession: { include: { subject: true } },
    },
    hooks: {
      afterCreate: async (req, res, data) => {
        await writeAuditLog(prisma, {
          action: 'create',
          entity_type: 'exam_result',
          entity_id: data.id,
          newValue: data,
          actor: req.employee,
          actorIp: req.ip,
        })
        return data
      },
    },
  },

  // ── SUBJECT GRADES ────────────────────────────────────────────────────────
  {
    model: 'subjectGrade',
    basePath: '/api/subject-grades',
    routes: ['getAll', 'getById', 'post', 'patch'],
    include: {
      studentClass: {
        include: { student: { select: { id: true, name: true, lastname: true, usid: true } } },
      },
      subject: true,
      recordedBy: { select: { id: true, name: true, lastname: true } },
    },
    hooks: auditHooks('subjectGrade', 'subject_grade', prisma),
  },

  // ── ANNOUNCEMENTS ────────────────────────────────────────────────────────
  {
    model: 'announcement',
    basePath: '/api/announcements',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['title', 'body'],
    include: {
      createdBy: { select: { id: true, name: true, lastname: true } },
    },
    hooks: {
      afterCreate: async (req, res, data) => {
        await writeAuditLog(prisma, {
          action: 'create',
          entity_type: 'announcement',
          entity_id: data.id,
          newValue: data,
          actor: req.employee,
          actorIp: req.ip,
        })
      },
      beforeUpdate: async (req, res, body) => {
        const id = parseInt(req.params.id, 10)
        req._oldRecord = await prisma.announcement.findUnique({ where: { id } })
        return body
      },
      afterUpdate: auditHooks('announcement', 'announcement', prisma).afterUpdate,
      beforeDelete: auditHooks('announcement', 'announcement', prisma).beforeDelete,
      afterDelete: auditHooks('announcement', 'announcement', prisma).afterDelete,
    },
  },

  // ── AUDIT LOGS ────────────────────────────────────────────────────────────
  {
    model: 'auditLog',
    basePath: '/api/audit-logs',
    routes: ['getAll', 'getById'],   // read-only
    searchFields: ['entity_type', 'action'],
    include: {
      actor: { select: { id: true, name: true, lastname: true, email: true } },
    },
    orderBy: { timestamp: 'desc' },
  },

  // ── NOTIFICATIONS ────────────────────────────────────────────────────────
  {
    model: 'notification',
    basePath: '/api/notifications',
    routes: ['getAll', 'getById', 'patch'],
    orderBy: { created_at: 'desc' },
    hooks: {
      ...auditHooks('notification', 'notification', prisma),
      // If you need custom patch logic, add it here
    },
  },

]

module.exports = { routeConfig }
