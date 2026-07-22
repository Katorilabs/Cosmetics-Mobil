import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/http-exception.filter.js';

type AppSetupOptions = {
  enableShutdownHooks?: boolean;
};

export function configureApp(
  app: NestExpressApplication,
  options: AppSetupOptions = {},
): void {
  const config = app.get(ConfigService);

  app.use(helmet());
  app.useBodyParser('text', {
    limit: '1mb',
    type: ['text/csv', 'application/csv'],
  });

  if (options.enableShutdownHooks ?? true) {
    app.enableShutdownHooks();
  }

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.getOrThrow<string[]>('http.corsOrigins'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  if (config.getOrThrow<string>('environment') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Cosmedia API')
      .setDescription('Versioned API for products, INCI data and skin-profile matching')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', in: 'header', name: 'x-admin-key' }, 'admin-key')
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }
}
