import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    helmet({
      // La CSP por defecto bloquea los scripts/estilos inline que usa Swagger UI
      // en /api/docs. HSTS (S.6) queda activo con los defaults de helmet.
      contentSecurityPolicy: false,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // elimina propiedades no declaradas en el DTO
      forbidNonWhitelisted: true, // error 400 si llegan props extra
      transform: true,        // convierte query params a sus tipos declarados
    }),
  );

  // Vercel le da una URL distinta a cada preview deployment, y el equipo levanta
  // la web en local contra este mismo backend. Con una sola string quedaba
  // habilitado un origen y bloqueados todos los demás, sin aviso salvo el error
  // de CORS en la consola del navegador.
  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('StopBet API')
    .setDescription('API clínica de StopBet para tratamiento de ludopatía')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Node cierra las conexiones inactivas a los 5 s, pero el proxy de Railway las
  // mantiene más tiempo. Cuando el cliente reutiliza una que el servidor ya cerró,
  // la petición llega y se procesa pero la respuesta no vuelve. En Android eso solo
  // rompe las escrituras: OkHttp reintenta los GET por su cuenta, nunca un POST.
  //
  // Medido el 2026-09-02 desde el teléfono contra Railway:
  //   teléfono  23:23:02.020  POST /check-ins
  //   servidor  03:23:01.985  POST /check-ins 201 64ms
  //   teléfono  23:23:02.243  TypeError: Network request failed
  //
  // El tope tiene que quedar por encima del que use el proxy, y headersTimeout por
  // encima de keepAliveTimeout o Node corta antes de leer las cabeceras.
  const server = app.getHttpServer();
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`StopBet backend corriendo en puerto ${port}`);
}

bootstrap();
