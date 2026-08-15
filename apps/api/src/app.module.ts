import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { configuration, validateEnvironment } from './config/configuration.js';
import { DatabaseModule } from './database/database.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { ProfilesModule } from './modules/profiles/profiles.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['../../.env', '.env'],
      load: [configuration],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.getOrThrow<number>('rateLimit.ttlMs'),
          limit: config.getOrThrow<number>('rateLimit.limit'),
        },
      ],
    }),
    DatabaseModule,
    AdminModule,
    HealthModule,
    IdentityModule,
    ProductsModule,
    ProfilesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
