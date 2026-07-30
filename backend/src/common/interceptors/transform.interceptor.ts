import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { ApiResponseDto } from '../dto/api-response.dto';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

/**
 * Wraps plain controller returns in the standard envelope.
 * Controllers that already return `{ success, data, ... }` are left as-is.
 * Use `@SkipTransform()` for legacy OpenAI-shaped routes during migration.
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

    return next.handle().pipe(
      map((data) => {
        if (data === undefined || data === null) {
          return { success: true, data: null } satisfies ApiResponseDto;
        }
        if (
          typeof data === 'object' &&
          data !== null &&
          'success' in data &&
          typeof (data as ApiResponseDto).success === 'boolean'
        ) {
          return data;
        }
        return { success: true, data } satisfies ApiResponseDto;
      }),
    );
  }
}
