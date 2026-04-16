/**
 * installment.service.js
 *
 * Business logic for generating installment payment records
 * when a student is enrolled in a class (StudentClasses created).
 *
 * Called from the afterCreate hook of the studentClasses resource.
 */

const { prisma } = require('../config/prisma')

/**
 * Generates StudentPayment installment rows for a newly created StudentClasses record.
 *
 * @param {object} studentClass - the created StudentClasses record
 * @returns {Promise<object[]>}  - the created payment records
 *
 * @example
 * // in routeConfig.js hooks:
 * afterCreate: async (req, res, data) => {
 *   await generateInstallments(data)
 * }
 */
async function generateInstallments(studentClass) {
  // Fetch the class to get installment count + price
  const classRecord = await prisma.classes.findUnique({
    where: { id: studentClass.class_id },
  })

  if (!classRecord) throw new Error(`Class ${studentClass.class_id} not found`)

  const { installments, installments_price, start_date } = classRecord

  // Nothing to generate if class has no installment config
  if (!installments || !installments_price || installments <= 0) return []

  // Get the pending status id
  const pendingStatus = await prisma.paidStatus.findUnique({
    where: { name: 'pending' },
  })
  if (!pendingStatus) throw new Error('PaidStatus "pending" not found in DB')

  // Build installment rows — due dates spaced 1 month apart from class start
  const payments = []
  for (let i = 0; i < installments; i++) {
    const dueDate = new Date(start_date)
    dueDate.setMonth(dueDate.getMonth() + i)

    payments.push({
      student_class_id: studentClass.id,
      name: `Installment ${i + 1} of ${installments}`,
      price: installments_price,
      discount: 0,
      paid_status_id: pendingStatus.id,
      due_date: dueDate,
    })
  }

  const created = await prisma.$transaction(
    payments.map((p) => prisma.studentPayment.create({ data: p }))
  )

  console.log(`[installment.service] Created ${created.length} installments for StudentClass ${studentClass.id}`)
  return created
}

module.exports = { generateInstallments }