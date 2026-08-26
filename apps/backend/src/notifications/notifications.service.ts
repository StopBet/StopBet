import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CommunityMute } from './entities/community-mute.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    @InjectRepository(CommunityMute)
    private readonly communityMuteRepo: Repository<CommunityMute>,
  ) {}

  findAllForUser(userId: string): Promise<Notification[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async markRead(id: string, userId: string): Promise<void> {
    const notification = await this.repo.findOne({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notificación no encontrada');
    await this.repo.update(id, { read: true });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.update({ userId, read: false }, { read: true });
  }

  // CA5.6: silenciar/reactivar notificaciones de comunidad desde el perfil
  async muteCommunity(userId: string): Promise<void> {
    const existing = await this.communityMuteRepo.findOne({ where: { userId } });
    if (!existing) {
      await this.communityMuteRepo.save(this.communityMuteRepo.create({ userId }));
    }
  }

  async unmuteCommunity(userId: string): Promise<void> {
    await this.communityMuteRepo.delete({ userId });
  }

  async isCommunityMuted(userId: string): Promise<boolean> {
    const existing = await this.communityMuteRepo.findOne({ where: { userId } });
    return !!existing;
  }
}
