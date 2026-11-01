import { HttpErrorResponse } from '@angular/common/http';

export const isNotFoundError = (error: unknown): boolean => error instanceof HttpErrorResponse && error.status === 404;
