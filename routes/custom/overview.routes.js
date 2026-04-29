/**
 * Overview Routes
 *
 * Custom routes for aggregated class/subject overview and teacher actions
 */

const { Router } = require('express')
const prisma = require('../../config/prisma')

const router = Router()

/**
 * GET /api/overview
 * Returns aggregated data: all classes with their subjects and activation status
 */
router.get('/', async (req, res, next) => {
  try {
    // Get all classes with their cycle and subjects
    const classes = await prisma.classes.findMany({
      include: {
        cycle: {
          include: {
            cycleSubjects: {
              include: {
                subject: true,
              },
            },
          },
        },
        location: true,
        employee: {
          select: { id: true, name: true, lastname: true, email: true },
        },
        subjectActivates: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    })

    // Transform data for overview
    const overview = classes.map((cls) => {
      const subjects = cls.cycle.cycleSubjects.map((cs) => {
        const activation = cls.subjectActivates.find(
          (sa) => sa.subject_id === cs.subject.id
        )
        return {
          subject: cs.subject,
          activation: activation || null,
          status: activation?.status || 'INACTIVE',
          date_start: activation?.date_start || null,
          date_end: activation?.date_end || null,
        }
      })

      return {
        class: {
          id: cls.id,
          start_date: cls.start_date,
          end_date: cls.end_date,
          time_start: cls.time_start,
          time_end: cls.time_end,
          cycle: cls.cycle,
          location: cls.location,
          teacher: cls.employee,
        },
        subjects,
      }
    })

    res.json({ data: overview })
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/subject-activations/:id/activate
 * Activate a subject (set status to ACTIVE)
 */
router.patch('/subject-activations/:id/activate', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' })

    const existing = await prisma.subjectActivate.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ message: 'Subject activation not found' })

    const updated = await prisma.subjectActivate.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        date_start: new Date().toISOString().split('T')[0],
      },
      include: { class: true, subject: true },
    })

    res.json({ data: updated, message: 'Subject activated successfully' })
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/subject-activations/:id/deactivate
 * Deactivate a subject (set status to INACTIVE)
 */
router.patch('/subject-activations/:id/deactivate', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' })

    const existing = await prisma.subjectActivate.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ message: 'Subject activation not found' })

    const updated = await prisma.subjectActivate.update({
      where: { id },
      data: {
        status: 'INACTIVE',
      },
      include: { class: true, subject: true },
    })

    res.json({ data: updated, message: 'Subject deactivated successfully' })
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/subject-activations/:id/finish
 * Mark a subject as finished (set status to FINISHED)
 */
router.patch('/subject-activations/:id/finish', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' })

    const existing = await prisma.subjectActivate.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ message: 'Subject activation not found' })

    const updated = await prisma.subjectActivate.update({
      where: { id },
      data: {
        status: 'FINISHED',
        date_end: new Date().toISOString().split('T')[0],
      },
      include: { class: true, subject: true },
    })

    res.json({ data: updated, message: 'Subject marked as finished' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
