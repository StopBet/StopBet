import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientAssignment } from '../psychologists/entities/patient-assignment.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { Invoice } from './entities/invoice.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { BillingOverviewService } from './billing-overview.service';
import { OverdueInvoicesService } from './overdue-invoices.service';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, User, Notification, PatientAssignment])],
  controllers: [BillingController],
  providers: [BillingService, BillingOverviewService, OverdueInvoicesService],
  exports: [BillingService],
})
export class BillingModule {}
