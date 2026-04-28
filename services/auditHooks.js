// services/auditHooks.js
const { writeAuditLog } = require('./auditLogger')

/**
 * Returns a hooks object that audits CREATE, UPDATE, and DELETE.
 * @param {string} model      - Prisma model name (camelCase)
 * @param {string} entityType - e.g. 'subject'
 * @param {object} prisma     - Prisma client instance
 */
function auditHooks(model, entityType, prisma) {
  return {
    afterCreate: async (req, res, data) => {
      await writeAuditLog(prisma, {
        action: 'create',
        entity_type: entityType,
        entity_id: data.id,
        newValue: data,
        actor: req.employee,
        actorIp: req.ip,
      })
    },
    beforeUpdate: async (req, res, body) => {
      const id = parseInt(req.params.id, 10)
      req._oldRecord = await prisma[model].findUnique({ where: { id } })
      return body
    },
    afterUpdate: async (req, res, record) => {
      await writeAuditLog(prisma, {
        action: 'update',
        entity_type: entityType,
        entity_id: record.id,
        oldValue: req._oldRecord,
        newValue: record,
        actor: req.employee,
        actorIp: req.ip,
      })
    },
    beforeDelete: async (req, res, record) => {
      req._deletedRecord = record
    },
    afterDelete: async (req, res, record) => {
      await writeAuditLog(prisma, {
        action: 'delete',
        entity_type: entityType,
        entity_id: record.id,
        oldValue: req._deletedRecord ?? record,
        newValue: null,
        actor: req.employee,
        actorIp: req.ip,
      })
    },
  }
}

module.exports = { auditHooks }
