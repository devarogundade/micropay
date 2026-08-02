import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const config = app.get(ConfigService);

  const corsOrigins = [
    ...(config.get<string[]>('cors.origins') ?? []),
    config.get<string>('cors.appUrl'),
    config.get<string>('cors.codeUrl'),
    config.get<string>('cors.siteUrl'),
    'http://localhost:3000',
    'http://localhost:5000',
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Wallet-Address',
      'x-wallet-address',
      'PAYMENT-SIGNATURE',
      'Payment-Signature',
      'payment-signature',
      'X-PAYMENT',
      'X-Payment',
      'x-payment',
      'Access-Control-Expose-Headers',
      'X-Async',
      'x-async',
      'X-Micropay-Request-Id',
      'x-micropay-request-id',
      'x-admin-api-key',
      'X-Admin-Api-Key',
    ],
    exposedHeaders: [
      'PAYMENT-RESPONSE',
      'Payment-Response',
      'payment-response',
      'PAYMENT-REQUIRED',
      'Payment-Required',
      'payment-required',
      'X-Credit-Applied',
      'X-Credit-Remaining',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidUnknownValues: false,
    }),
  );

  const port = config.get<number>('port') ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(
    `Micropay backend listening on :${port} (network=${config.get('network')})`,
  );
}
void bootstrap();
