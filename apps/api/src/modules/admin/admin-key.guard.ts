import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

type HeaderRequest = {
  header(name: string): string | undefined;
};

@Injectable()
export class AdminKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedKey = this.config.get<string>('admin.apiKey');
    const suppliedKey = context.switchToHttp().getRequest<HeaderRequest>().header('x-admin-key');

    if (!expectedKey || !suppliedKey) {
      throw new UnauthorizedException('Admin credentials are required');
    }

    const expected = Buffer.from(expectedKey);
    const supplied = Buffer.from(suppliedKey);
    const isValid = expected.length === supplied.length && timingSafeEqual(expected, supplied);

    if (!isValid) {
      throw new UnauthorizedException('Admin credentials are invalid');
    }

    return true;
  }
}
