/**
 * routeConfig.js
 *
 * All API resources are defined here as an array of config objects.
 * The factory reads this and mounts routes automatically onto the Express app.
 *
 * Config fields:
 *   model        {string}     Prisma model name (camelCase, e.g. 'student')
 *   basePath     {string}     URL prefix (e.g. '/api/students')
 *   routes       {string[]}   Which actions to enable: 'getAll','getById','post','patch','put','delete'
 *   middleware   {function[]} Express middleware applied to all routes in this resource
 *   searchFields {string[]}   Fields included in ?search= queries
 *   include      {object}     Prisma include — relations to eager-load
 *   orderBy      {object}     Default sort order override
 *   hooks        {object}     beforeGetAll, beforeGetById, beforeCreate, afterCreate,
 *                             beforeUpdate, afterUpdate, beforeDelete, afterDelete
 */

// const { employeeAuth, studentAuth, requirePermission } = require('../middlewares/auth.middleware')
// const { PERMISSIONS } = require('../config/permissions')
const { generateInstallments } = require('../services/installment.service')

/** @type {import('../factory/routeFactory').ResourceConfig[]} */
const routeConfig = [

  // ── GENERAL INFORMATION ──────────────────────────────────────────────────
  {
    model: 'generalInformation',
    basePath: '/api/general',
    routes: ['getAll', 'getById', 'patch'],
  },

  // ── EMPLOYEES ────────────────────────────────────────────────────────────
  {
    model: 'employee',
    basePath: '/api/employees',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['name', 'lastname', 'email', 'phone_number'],
    include: { role: true, gender: true },
    hooks: {
      beforeCreate: async (req, res, body) => {
        // Password must be hashed before hitting the DB
        // (registration flow should use a dedicated auth route instead)
        // This hook is a guard to prevent plain-text passwords via the factory
        if (body.password) {
          const bcrypt = require('bcryptjs')
          body.password = await bcrypt.hash(body.password, 12)
        }
        return body
      },
      afterCreate: async (req, res, data) => {
        console.log(`[employee] Created: ${data.email}`)
      },
    },
  },

  // ── GENDERS ──────────────────────────────────────────────────────────────
  {
    model: 'gender',
    basePath: '/api/genders',
    routes: ['getAll', 'getById', 'post', 'patch','put', 'delete'],
    searchFields: ['name'],
  },

  // ── ROLES ────────────────────────────────────────────────────────────────
  {
    model: 'role',
    basePath: '/api/roles',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['name'],
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
  },

  // ── SUBJECTS ─────────────────────────────────────────────────────────────
  {
    model: 'subject',
    basePath: '/api/subjects',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['name'],
  },

  // ── CYCLES ───────────────────────────────────────────────────────────────
  {
    model: 'cycle',
    basePath: '/api/cycles',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['name'],
    include: { cycleSubjects: { include: { subject: true } } },
  },

  // ── CYCLE SUBJECTS ────────────────────────────────────────────────────────
  {
    model: 'cycleSubject',
    basePath: '/api/cycle-subjects',
    routes: ['getAll', 'getById', 'post', 'delete'],
    include: { cycle: true, subject: true },
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
      employee: { select: { id: true, name: true, lastname: true,email: true  } },
    },
  },

  // ── SUBJECT ACTIVATIONS ───────────────────────────────────────────────────
  {
    model: 'subjectActivate',
    basePath: '/api/subject-activations',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    include: { class: true, subject: true },
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
        // Auto-generate USID if not provided
        if (!body.usid) {
          const { generateUSID } = require('../utils/usid')
          body.usid = generateUSID()
        }
        // Hash initial password
        if (body.password) {
          const bcrypt = require('bcryptjs')
          body.password = await bcrypt.hash(body.password, 12)
        }
        return body
      },
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
      // After enrolling a student in a class, auto-generate installment payments
      afterCreate: async (req, res, data) => {
        await generateInstallments(data)
        return data
      },
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
  },

  // ── CURRICULUM ENTRIES ────────────────────────────────────────────────────
  {
    model: 'curriculumThrough',
    basePath: '/api/curriculum-entries',
    routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
    searchFields: ['name', 'description'],
    include: { curriculum: true, subject: true },
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
      beforeUpdate: async (req, res, body) => {
        // Auto-set paid_at timestamp when status changes to 'paid'
        if (body.paid_status_id) {
          const { prisma } = require('../config/prisma')
          const status = await prisma.paidStatus.findUnique({
            where: { id: body.paid_status_id },
          })
          if (status?.name === 'paid' && !body.paid_at) {
            body.paid_at = new Date()
          }
        }
        return body
      },
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
  },

  // ── AUDIT LOGS ────────────────────────────────────────────────────────────
  {
    model: 'auditLog',
    basePath: '/api/audit-logs',
    routes: ['getAll', 'getById'],   // read-only, never create/edit/delete via API
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
    routes: ['getAll', 'getById', 'patch'],  // patch = mark as read
    orderBy: { created_at: 'desc' },
  },

]

module.exports = { routeConfig }