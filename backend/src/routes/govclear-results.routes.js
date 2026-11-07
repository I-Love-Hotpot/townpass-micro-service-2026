import { createHash } from 'node:crypto';

const answer = { anyOf: [{ type: 'string', minLength: 1, maxLength: 4000, pattern: '\\S' }, { type: 'null' }] };
export const resultSchema = {
  type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'resultId', 'generatedAt', 'inputMode', 'summary', 'sixQuestions'],
  properties: {
    schemaVersion: { const: 1, type: 'integer' },
    resultId: { type: 'string', format: 'uuid' },
    generatedAt: { type: 'string', format: 'date-time' },
    inputMode: { type: 'string', enum: ['text', 'image'] },
    // Optional for compatibility with already installed clients; new clients always include it.
    sourceText: { type: 'string', minLength: 1, maxLength: 6000, pattern: '\\S' },
    summary: { type: 'string', minLength: 1, maxLength: 6000, pattern: '\\S' },
    sixQuestions: {
      type: 'object', additionalProperties: false,
      required: ['who', 'what', 'when', 'where', 'why', 'how'],
      properties: Object.fromEntries(['who', 'what', 'when', 'where', 'why', 'how'].map(key => [key, answer]))
    }
  }
};
function canonical(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}
export default async function govclearResultsRoutes(app, { allowedOrigins = [] } = {}) {
  app.options('/api/govclear/results', async (request, reply) => {
    if (!allowedOrigins.includes(request.headers.origin) || request.headers['access-control-request-method'] !== 'POST') {
      return reply.code(403).send();
    }
    return reply.header('Access-Control-Allow-Methods', 'POST')
      .header('Access-Control-Allow-Headers', 'Content-Type').code(204).send();
  });
  app.post('/api/govclear/results', {
    bodyLimit: 128 * 1024,
    schema: { body: resultSchema },
    // Keep these checks before validation: Fastify's default AJV configuration can strip unknown fields.
    preValidation: async (request, reply) => {
      const body = request.body;
      if (body && typeof body === 'object') {
        const extra = Object.keys(body).some(key => !Object.hasOwn(resultSchema.properties, key));
        const sixExtra = body.sixQuestions && typeof body.sixQuestions === 'object' &&
          Object.keys(body.sixQuestions).some(key => !Object.hasOwn(resultSchema.properties.sixQuestions.properties, key));
        if (extra || sixExtra) return reply.code(400).send({ error: 'Unexpected result fields' });
      }
    }
  }, async (request, reply) => {
    const payload = JSON.stringify(canonical(request.body));
    const digest = createHash('sha256').update(payload).digest('hex');
    const id = request.body.resultId;
    reply.header('Cache-Control', 'no-store');
    try {
      await app.db.execute('INSERT INTO govclear_results (result_id, payload, payload_sha256) VALUES (?, ?, ?)', [id, payload, digest]);
      return reply.code(201).send({ resultId: id, status: 'stored', duplicate: false });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        try {
          const [rows] = await app.db.execute('SELECT payload_sha256 FROM govclear_results WHERE result_id = ?', [id]);
          if (rows[0]?.payload_sha256 === digest) return reply.code(200).send({ resultId: id, status: 'stored', duplicate: true });
          return reply.code(409).send({ error: 'Result ID already belongs to different content' });
        } catch { /* Return a retryable error without logging document contents. */ }
      }
      request.log.warn({ code: error.code }, 'GovClear result storage failed');
      return reply.code(503).send({ error: 'Result storage unavailable; retry with the same resultId' });
    }
  });
}
