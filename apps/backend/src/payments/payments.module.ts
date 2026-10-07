import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingModule } from '../billing/billing.module';
import { Invoice } from '../billing/entities/invoice.entity';
import { User } from '../users/entities/user.entity';
import { PaymentCharge } from './entities/payment-charge.entity';
import { PaymentInscription } from './entities/payment-inscription.entity';
import { OneclickPaymentsService } from './oneclick-payments.service';
import { OneclickController } from './oneclick.controller';
import { OneclickGateway } from './oneclick.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentInscription, PaymentCharge, Invoice, User]), BillingModule],
  controllers: [OneclickController],
  providers: [OneclickGateway, OneclickPaymentsService],
  exports: [OneclickPaymentsService],
})
export class PaymentsModule {}
