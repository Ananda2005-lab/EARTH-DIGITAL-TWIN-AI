import { HttpStatus } from '@nestjs/common';
import { AppException, errorCodeForStatus } from './app-exception';

describe('AppException', () => {
  it('preserves status, code, message and details', () => {
    const details = { field: 'email' };
    const error = AppException.validation('Invalid input', details);

    expect(error.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.message).toBe('Invalid input');
    expect(error.details).toBe(details);
    expect(error.getResponse()).toEqual({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      code: 'VALIDATION_FAILED',
      message: 'Invalid input',
      details,
    });
  });

  it.each([
    [AppException.unauthorised(), 401, 'UNAUTHORISED'],
    [AppException.forbidden(), 403, 'FORBIDDEN'],
    [AppException.notFound(), 404, 'NOT_FOUND'],
    [AppException.conflict('duplicate'), 409, 'CONFLICT'],
    [AppException.rateLimited(), 429, 'RATE_LIMITED'],
    [AppException.upstreamUnavailable(), 503, 'UPSTREAM_UNAVAILABLE'],
    [AppException.internal(), 500, 'INTERNAL_ERROR'],
  ])('creates the expected domain error', (error, status, code) => {
    expect(error.getStatus()).toBe(status);
    expect(error.code).toBe(code);
  });

  it.each([
    [400, 'BAD_REQUEST'],
    [401, 'UNAUTHORISED'],
    [422, 'VALIDATION_FAILED'],
    [502, 'UPSTREAM_UNAVAILABLE'],
    [504, 'UPSTREAM_UNAVAILABLE'],
    [500, 'INTERNAL_ERROR'],
    [418, 'BAD_REQUEST'],
  ] as const)('maps HTTP status %s to %s', (status, code) => {
    expect(errorCodeForStatus(status)).toBe(code);
  });
});
