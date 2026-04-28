function generateUSID() {
  const year = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  return `STU-${year}-${rand}`
}

module.exports = { generateUSID }
