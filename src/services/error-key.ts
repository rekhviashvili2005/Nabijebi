import { ApiError } from '@/services/api-client';

// Maps an API failure to a translation key under "errors"
export function getErrorKey(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 0) {
      return 'errors.network';
    }
    if (cause.status === 400) {
      return 'errors.invalidInput';
    }
    if (cause.status === 403) {
      return 'errors.forbidden';
    }
    if (cause.status === 404) {
      return 'errors.notFound';
    }
  }

  return 'errors.generic';
}