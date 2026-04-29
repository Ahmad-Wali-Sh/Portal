function generateUSID() {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(100000 + Math.random() * 900000)

  return `STU-${yy}${mm}${dd}-${rand}`
}

module.exports = { generateUSID }
