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

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`StopBet backend corriendo en puerto ${port}`);
}

bootstrap();
