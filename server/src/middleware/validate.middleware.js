const { ZodError } = require('zod');

const formatZodErrors = (err) =>
  err.errors.map((e) => ({
    path: e.path.join('.'),
    message: e.message,
  }));

const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      if (source === 'query') {
        req.validatedQuery = parsed;
      } else {
        req[source] = parsed;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const apiError = new Error('Validation failed');
        apiError.status = 400;
        apiError.details = formatZodErrors(err);
        return next(apiError);
      }
      return next(err);
    }
  };

module.exports = validate;
