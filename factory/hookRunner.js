/**
 * hookRunner.js
 *
 * Runs a hook function if it exists.
 * - Hook signature: async (req, res, data) => modifiedData | void
 * - If the hook returns a value, that value replaces `data` for the next step.
 * - If the hook returns void/undefined, original data is preserved.
 * - Errors thrown inside hooks bubble up to the global error handler.
 *
 * @param {Function|undefined} hook  - the hook function
 * @param {object}             req   - Express request
 * @param {object}             res   - Express response
 * @param {any}                data  - current payload (body, record, etc.)
 * @returns {Promise<any>}           - original or modified data
 */
async function runHook(hook, req, res, data) {
  if (typeof hook !== 'function') return data
  const result = await hook(req, res, data)
  return result !== undefined ? result : data
}

module.exports = { runHook }