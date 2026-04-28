/**
 * routeFactory.js
 *
 * Builds an Express Router for a resource from a config object.
 *
 * Config shape:
 * {
 *   model:        string,           // Prisma model name e.g. 'student'
 *   basePath:     string,           // e.g. '/api/students'
 *   routes:       string[],         // ['getAll','getById','post','patch','delete']
 *   middleware:   function[],       // Express middleware array (optional)
 *   searchFields: string[],         // fields to search on ?search= (optional)
 *   include:      object,           // Prisma include object (optional)
 *   orderBy:      object,           // default orderBy override (optional)
 *   hooks: {
 *     beforeGetAll:  async (req, res, undefined) => void
 *     beforeGetById: async (req, res, undefined) => void
 *     beforeCreate:  async (req, res, body)      => modifiedBody | void
 *     afterCreate:   async (req, res, record)    => modifiedRecord | void
 *     beforeUpdate:  async (req, res, body)      => modifiedBody | void
 *     afterUpdate:   async (req, res, record)    => modifiedRecord | void
 *     beforeDelete:  async (req, res, record)    => void
 *     afterDelete:   async (req, res, record)    => void
 *   }
 * }
 */

const { Router } = require('express')
const  prisma  = require('../config/prisma')
const { buildQuery } = require('./queryBuilder')
const { runHook } = require('./hookRunner')

const VALID_ROUTES = ['getAll', 'getById', 'post', 'patch', 'delete']

/**
 * Builds and returns an Express Router for a single resource.
 * @param {object} config
 * @returns {Router}
 */
function buildResourceRouter(config) {
  const {
    model,
    routes = VALID_ROUTES,
    middleware = [],
    searchFields = [],
    include = undefined,
    orderBy: defaultOrderBy = undefined,
    hooks = {},
  } = config

  if (!model) throw new Error('routeFactory: model is required')

  const db = prisma[model]
  if (!db) throw new Error(`routeFactory: prisma model "${model}" not found`)

  const router = Router()

  // Apply shared middleware to all routes in this resource
  if (middleware.length > 0) {
    router.use(...middleware)
  }

  // ── GET ALL ───────────────────────────────────────────────────────────────
  if (routes.includes('getAll')) {
    router.get('/', async (req, res, next) => {
      try {
        await runHook(hooks.beforeGetAll, req, res, undefined)

        const { where, orderBy, skip, take, _page, _limit } = buildQuery(
          req.query,
          searchFields
        )

        const [total, data] = await prisma.$transaction([
          db.count({ where }),
          db.findMany({
            where,
            orderBy: defaultOrderBy ?? orderBy,
            ...(skip !== undefined && { skip }),
            ...(take !== undefined && { take }),
            ...(include && { include }),
          }),
        ])

        res.json({
          data,
          meta: {
            total,
            page: _page,
            limit: _limit,
            pages: _limit > 0 ? Math.ceil(total / _limit) : 1,
          },
        })
      } catch (err) {
        next(err)
      }
    })
  }

  // ── GET BY ID ─────────────────────────────────────────────────────────────
  if (routes.includes('getById')) {
    router.get('/:id', async (req, res, next) => {
      try {
        await runHook(hooks.beforeGetById, req, res, undefined)

        const id = parseInt(req.params.id, 10)
        if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' })

        const record = await db.findUnique({
          where: { id },
          ...(include && { include }),
        })

        if (!record) return res.status(404).json({ message: `${model} not found` })

        res.json({ data: record })
      } catch (err) {
        next(err)
      }
    })
  }

  // // ── POST (CREATE) ─────────────────────────────────────────────────────────
  // if (routes.includes('post')) {
  //   router.post('/', async (req, res, next) => {
  //     try {
  //       let body = req.body

  //       body = await runHook(hooks.beforeCreate, req, res, body)

  //       const record = await db.create({
  //         data: body,
  //         ...(include && { include }),
  //       })

  //       const result = await runHook(hooks.afterCreate, req, res, record)

  //       res.status(201).json({ data: result ?? record })
  //     } catch (err) {
  //       next(err)
  //     }
  //   })
  // }

  if (routes.includes('post')) {
  router.post('/', async (req, res, next) => {
    try {
      let body = req.body

      body = await runHook(hooks.beforeCreate, req, res, body)

      // ✅ FIX STARTS HERE
      if (body.start_date) {
        body.start_date = new Date(body.start_date).toISOString()
      }

      if (body.end_date) {
        body.end_date = new Date(body.end_date).toISOString()
      }
      // ✅ FIX ENDS HERE

      const record = await db.create({
        data: body,
        ...(include && { include }),
      })

      const result = await runHook(hooks.afterCreate, req, res, record)

      res.status(201).json({ data: result ?? record })
    } catch (err) {
      next(err)
    }
  })
}

  // // ── PATCH (PARTIAL UPDATE) ────────────────────────────────────────────────
  // if (routes.includes('patch')) {
  //   router.patch('/:id', async (req, res, next) => {
  //     try {
  //       const id = parseInt(req.params.id, 10)
  //       if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' })

  //       let body = req.body

  //       body = await runHook(hooks.beforeUpdate, req, res, body)

  //       const existing = await db.findUnique({ where: { id } })
  //       if (!existing) return res.status(404).json({ message: `${model} not found` })

  //       const record = await db.update({
  //         where: { id },
  //         data: body,
  //         ...(include && { include }),
  //       })

  //       const result = await runHook(hooks.afterUpdate, req, res, record)

  //       res.json({ data: result ?? record })
  //     } catch (err) {
  //       next(err)
  //     }
  //   })
  // }



  router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    let body = req.body

    body = await runHook(hooks.beforeUpdate, req, res, body)

    // ✅ FIX STARTS HERE
    if (body.start_date) {
      body.start_date = new Date(body.start_date).toISOString()
    }

    if (body.end_date) {
      body.end_date = new Date(body.end_date).toISOString()
    }
    // ✅ FIX ENDS HERE

    const existing = await db.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ message: `${model} not found` })

    const record = await db.update({
      where: { id },
      data: body,
      ...(include && { include }),
    })

    const result = await runHook(hooks.afterUpdate, req, res, record)

    res.json({ data: result ?? record })
  } catch (err) {
    next(err)
  }
})

  // ── PUT (FULL UPDATE) ─────────────────────────────────────────────────────
  if (routes.includes('put')) {
    router.put('/:id', async (req, res, next) => {
      try {
        const id = parseInt(req.params.id, 10)
        if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' })

        let body = req.body

        body = await runHook(hooks.beforeUpdate, req, res, body)

        const existing = await db.findUnique({ where: { id } })
        if (!existing) return res.status(404).json({ message: `${model} not found` })

        const record = await db.update({
          where: { id },
          data: body,
          ...(include && { include }),
        })

        const result = await runHook(hooks.afterUpdate, req, res, record)

        res.json({ data: result ?? record })
      } catch (err) {
        next(err)
      }
    })
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (routes.includes('delete')) {
    router.delete('/:id', async (req, res, next) => {
      try {
        const id = parseInt(req.params.id, 10)
        if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' })

        const existing = await db.findUnique({ where: { id } })
        if (!existing) return res.status(404).json({ message: `${model} not found` })

        await runHook(hooks.beforeDelete, req, res, existing)

        const record = await db.delete({ where: { id } })

        await runHook(hooks.afterDelete, req, res, record)

        res.json({ data: record, message: `${model} deleted` })
      } catch (err) {
        next(err)
      }
    })
  }

  return router
}

/**
 * Registers all resources onto an Express app.
 *
 * @param {import('express').Application} app
 * @param {object[]} resources  - array of resource config objects
 *
 * @example
 * registerRoutes(app, [
 *   {
 *     model: 'student',
 *     basePath: '/api/students',
 *     routes: ['getAll', 'getById', 'post', 'patch', 'delete'],
 *     middleware: [employeeAuth, requirePermission(PERMISSIONS.STUDENT_VIEW)],
 *     searchFields: ['name', 'lastname', 'usid'],
 *     include: { gender: true },
 *     hooks: {
 *       afterCreate: async (req, res, data) => {
 *         await notifyNewStudent(data)
 *       }
 *     }
 *   }
 * ])
 */
function registerRoutes(app, resources) {
  for (const config of resources) {
    if (!config.basePath) {
      throw new Error(`routeFactory: basePath is required for model "${config.model}"`)
    }
    const router = buildResourceRouter(config)
    app.use(config.basePath, router)
    console.log(`[factory] ${config.model} → ${config.basePath} [${(config.routes ?? VALID_ROUTES).join(', ')}]`)
  }
}

module.exports = { registerRoutes, buildResourceRouter }