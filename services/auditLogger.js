const prisma = require('../config/prisma')

async function writeAuditLog(tx, { action, entity_type, entity_id, oldValue, newValue, actor, actorIp }) {
  const actorName = actor
    ? `${actor.name} ${actor.lastname ?? ''}`.trim()
    : 'System'

  await tx.auditLog.create({
    data: {
      action,
      entity_type,
      entity_id,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
      actor_name: actorName,
      actor_ip: actorIp ?? null,
      actor_id: actor?.id ?? null,   // null is allowed now
    },
  })
}

module.exports = { writeAuditLog }
