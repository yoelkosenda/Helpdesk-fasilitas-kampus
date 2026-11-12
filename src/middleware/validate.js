const { badRequest } = require('../utils/http');

// Validasi request dengan skema zod. source: 'body' | 'query' | 'params'
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(badRequest('Data tidak valid', details));
  }
  req.valid = req.valid || {};
  req.valid[source] = result.data;
  next();
};

module.exports = validate;
