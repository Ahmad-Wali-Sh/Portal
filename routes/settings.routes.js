/**
 * settings.routes.js
 *
 * Custom routes for the Settings module.
 * These operations can't use the generic factory because they need
 * special logic (password hashing, CSV streaming, etc.)
 *
 * Mounted at: /api/settings
 *
 * Endpoints:
 *   POST   /api/settings/change-password          — change employee password
 *   GET    /api/settings/export/students           — download all students as CSV
 *   GET    /api/settings/export/payments           — download all payments as CSV
 *   GET    /api/settings/export/enrollments        — download student-classes as CSV
 */

const { Router } = require('express')
const bcrypt = require('bcryptjs')
const prisma = require('../config/prisma')

const router = Router()

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a 2D array to a RFC-4180 compliant CSV string.
 * Handles commas, quotes, and newlines inside cell values.
 *
 * @param {string[]}   headers  — column titles
 * @param {any[][]}    rows     — data rows
 * @returns {string}
 */
function buildCsv(headers, rows) {
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [headers.map(escape).join(',')]
    for (const row of rows) {
        lines.push(row.map(escape).join(','))
    }
    return lines.join('\r\n')
}

/**
 * Sends a CSV file response with proper headers.
 *
 * @param {import('express').Response} res
 * @param {string} filename   — e.g. 'students'
 * @param {string} csv        — CSV string
 */
function sendCsv(res, filename, csv) {
    const date = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}-${date}.csv"`)
    // BOM so Excel opens UTF-8 correctly
    res.send('\uFEFF' + csv)
}

/**
 * Formats a Date value to ISO date string (YYYY-MM-DD) or '—'.
 */
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '')

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/settings/change-password
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Change an employee's password.
 * Requires both the current password (for verification) and the new one.
 *
 * Body: { employee_id, current_password, new_password }
 *
 * httpie test:
 *   http POST localhost:8000/api/settings/change-password \
 *     employee_id:=1 \
 *     current_password="oldpass123" \
 *     new_password="newpass456"
 */
router.post('/change-password', async (req, res, next) => {
    try {
        const { employee_id, current_password, new_password } = req.body

        // ── Validation ────────────────────────────────────────────────────────────
        if (!employee_id || !current_password || !new_password) {
            return res.status(400).json({
                message: 'employee_id, current_password and new_password are required',
            })
        }

        if (new_password.length < 8) {
            return res.status(400).json({
                message: 'New password must be at least 8 characters',
            })
        }

        if (current_password === new_password) {
            return res.status(400).json({
                message: 'New password must be different from the current password',
            })
        }

        // ── Fetch employee ────────────────────────────────────────────────────────
        const employee = await prisma.employee.findUnique({
            where: { id: Number(employee_id) },
            select: { id: true, name: true, email: true, password: true },
        })

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' })
        }

        // ── Verify current password ───────────────────────────────────────────────
        const isValid = await bcrypt.compare(current_password, employee.password)
        if (!isValid) {
            return res.status(401).json({ message: 'Current password is incorrect' })
        }

        // ── Hash & update ─────────────────────────────────────────────────────────
        const hashed = await bcrypt.hash(new_password, 12)
        await prisma.employee.update({
            where: { id: employee.id },
            data: { password: hashed },
        })

        res.json({
            message: 'Password changed successfully',
            data: { id: employee.id, email: employee.email },
        })
    } catch (err) {
        next(err)
    }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/export/students
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Export all students as a downloadable CSV file.
 *
 * Optional query params (same as /api/students):
 *   ?gender_id=1   — filter by gender
 *
 * httpie test:
 *   http GET localhost:8000/api/settings/export/students > students.csv
 *   http GET "localhost:8000/api/settings/export/students?gender_id=1" > students_female.csv
 */
router.get('/export/students', async (req, res, next) => {
    try {
        const where = {}
        if (req.query.gender_id) where.gender_id = Number(req.query.gender_id)

        const students = await prisma.student.findMany({
            where,
            include: { gender: true },
            orderBy: { created_at: 'desc' },
        })

        const headers = [
            'ID', 'USID', 'First Name', 'Last Name', 'Father Name',
            'Phone 1', 'Phone 2', 'Responsible', 'Age', 'Gender',
            'Home Address', 'Note', 'Registered At',
        ]

        const rows = students.map((s) => [
            s.id,
            s.usid,
            s.name,
            s.lastname,
            s.father_name,
            s.phone_1,
            s.phone_2,
            s.responsible,
            s.age,
            s.gender?.name,
            s.home_address,
            s.note,
            fmtDate(s.created_at),
        ])

        sendCsv(res, 'students', buildCsv(headers, rows))
    } catch (err) {
        next(err)
    }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/export/payments
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Export all payments as a downloadable CSV file.
 *
 * Optional query params:
 *   ?paid_status_id=1   — filter by status
 *
 * httpie test:
 *   http GET localhost:8000/api/settings/export/payments > payments.csv
 *   http GET "localhost:8000/api/settings/export/payments?paid_status_id=1" > paid_only.csv
 */
router.get('/export/payments', async (req, res, next) => {
    try {
        const where = {}
        if (req.query.paid_status_id) where.paid_status_id = Number(req.query.paid_status_id)

        const payments = await prisma.studentPayment.findMany({
            where,
            include: {
                studentClass: {
                    include: {
                        student: { select: { id: true, name: true, lastname: true, usid: true } },
                        class: { include: { cycle: true } },
                    },
                },
                paidStatus: true,
                collectedBy: { select: { id: true, name: true, lastname: true } },
            },
            orderBy: { created_at: 'desc' },
        })

        const headers = [
            'ID', 'Payment Name',
            'Student Name', 'Student USID',
            'Class / Cycle',
            'Price', 'Discount', 'Net Price',
            'Status', 'Due Date', 'Paid At',
            'Collected By', 'Note', 'Created At',
        ]

        const rows = payments.map((p) => {
            const student = p.studentClass?.student
            const cycle = p.studentClass?.class?.cycle
            const net = Number(p.price) - Number(p.discount)

            return [
                p.id,
                p.name,
                student ? `${student.name} ${student.lastname}` : '',
                student?.usid,
                cycle?.name,
                Number(p.price).toFixed(2),
                Number(p.discount).toFixed(2),
                net.toFixed(2),
                p.paidStatus?.name,
                fmtDate(p.due_date),
                fmtDate(p.paid_at),
                p.collectedBy ? `${p.collectedBy.name} ${p.collectedBy.lastname}` : '',
                p.note,
                fmtDate(p.created_at),
            ]
        })

        sendCsv(res, 'payments', buildCsv(headers, rows))
    } catch (err) {
        next(err)
    }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/export/enrollments
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Export student-class enrollments as CSV (useful for reporting).
 *
 * Optional query params:
 *   ?class_id=3   — filter by class
 *
 * httpie test:
 *   http GET localhost:8000/api/settings/export/enrollments > enrollments.csv
 *   http GET "localhost:8000/api/settings/export/enrollments?class_id=3" > class3.csv
 */
router.get('/export/enrollments', async (req, res, next) => {
    try {
        const where = {}
        if (req.query.class_id) where.class_id = Number(req.query.class_id)

        const enrollments = await prisma.studentClasses.findMany({
            where,
            include: {
                student: { select: { id: true, name: true, lastname: true, usid: true, phone_1: true } },
                class: {
                    include: {
                        cycle: true,
                        location: true,
                        employee: { select: { id: true, name: true, lastname: true } },
                    },
                },
            },
            orderBy: { enrolled_at: 'desc' },
        })

        const headers = [
            'Enrollment ID',
            'Student USID', 'Student Name', 'Phone',
            'Cycle', 'Location', 'Teacher',
            'Enrolled At',
        ]

        const rows = enrollments.map((e) => [
            e.id,
            e.student?.usid,
            e.student ? `${e.student.name} ${e.student.lastname}` : '',
            e.student?.phone_1,
            e.class?.cycle?.name,
            e.class?.location?.name,
            e.class?.employee ? `${e.class.employee.name} ${e.class.employee.lastname}` : '',
            fmtDate(e.enrolled_at),
        ])

        sendCsv(res, 'enrollments', buildCsv(headers, rows))
    } catch (err) {
        next(err)
    }
})

module.exports = router