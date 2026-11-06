export default async function healthRoutes(app, { allowedOrigins }) {
  app.get('/', { exposeHeadRoute: false }, async (request, reply) => {
    try {
      await app.db.query({ sql: 'SELECT 1', timeout: 3000 })
      return { status: 'ok' }
    } catch (error) {
      request.log.warn({ code: error.code }, 'Database readiness check failed')
      return reply.code(503).send({ status: 'unavailable' })
    }
  })

  app.get('/health', { exposeHeadRoute: false }, async (request, reply) => {
    try {
      await app.db.query({ sql: 'SELECT 1', timeout: 3000 })
      return { status: 'ok' }
    } catch (error) {
      request.log.warn({ code: error.code }, 'Database readiness check failed')
      return reply.code(503).send({ status: 'unavailable' })
    }
  })

  app.options('/health', async (request, reply) => {
    if (
      !allowedOrigins.includes(request.headers.origin) ||
      request.headers['access-control-request-method'] !== 'GET'
    ) {
      return reply.code(403).send()
    }

    return reply
      .header('Access-Control-Allow-Methods', 'GET')
      .header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      .code(204)
      .send()
  })
}
