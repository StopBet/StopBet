import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { ReactionEmoji, ReactionSummary } from '@stopbet/shared-types';
import { CommunityPost } from './entities/community-post.entity';
import { PostReply } from './entities/post-reply.entity';
import { PostReaction } from './entities/post-reaction.entity';
import { PostReport } from './entities/post-report.entity';
import { AttendanceConfirmation } from './entities/attendance-confirmation.entity';
import { User } from '../users/entities/user.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateReplyDto } from './dto/create-reply.dto';

// CA3: a partir de 5 reportes una publicación entra a la cola de moderación
const REPORT_THRESHOLD = 5;

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(CommunityPost)
    private readonly postRepo: Repository<CommunityPost>,
    @InjectRepository(PostReply)
    private readonly replyRepo: Repository<PostReply>,
    @InjectRepository(PostReaction)
    private readonly reactionRepo: Repository<PostReaction>,
    @InjectRepository(PostReport)
    private readonly reportRepo: Repository<PostReport>,
    @InjectRepository(AttendanceConfirmation)
    private readonly attendanceRepo: Repository<AttendanceConfirmation>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAnnouncements(sede: string, userId: string) {
    const posts = await this.postRepo.find({
      where: { type: 'announcement', sede },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });

    const postIds = posts.map((p) => p.id);
    const attended = postIds.length
      ? await this.attendanceRepo.find({ where: { postId: In(postIds), userId } })
      : [];
    const attendedSet = new Set(attended.map((a) => a.postId));

    return posts.map((p) => this.serializeAnnouncement(p, attendedSet.has(p.id)));
  }

  async createAnnouncement(dto: CreateAnnouncementDto, authorId: string) {
    const post = this.postRepo.create({
      authorId,
      type: 'announcement',
      sede: dto.sede,
      title: dto.title ?? null,
      body: dto.body,
      eventDate: dto.eventDate ? new Date(dto.eventDate) : null,
    });
    const saved = await this.postRepo.save(post);
    const author = await this.userRepo.findOneOrFail({ where: { id: authorId } });
    saved.author = author;
    return this.serializeAnnouncement(saved, false);
  }

  async toggleAttendance(postId: string, userId: string) {
    const post = await this.postRepo.findOne({ where: { id: postId, type: 'announcement' } });
    if (!post) throw new NotFoundException('Anuncio no encontrado');

    const existing = await this.attendanceRepo.findOne({ where: { postId, userId } });
    if (existing) {
      await this.attendanceRepo.delete(existing.id);
      return { attends: false };
    }
    await this.attendanceRepo.save(this.attendanceRepo.create({ postId, userId }));
    return { attends: true };
  }

  async findPosts(sede: string, page: number, limit: number, userId: string) {
    const skip = (page - 1) * limit;
    const [posts, total] = await this.postRepo.findAndCount({
      where: { type: 'forum_post', sede },
      relations: ['author'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    if (!posts.length) return { data: [], total, page, limit };

    const postIds = posts.map((p) => p.id);

    const [replyCounts, reactions] = await Promise.all([
      this.replyRepo
        .createQueryBuilder('r')
        .select('r.postId', 'postId')
        .addSelect('COUNT(*)', 'count')
        .where('r.postId IN (:...ids)', { ids: postIds })
        .groupBy('r.postId')
        .getRawMany<{ postId: string; count: string }>(),
      this.reactionRepo.find({ where: { postId: In(postIds) } }),
    ]);

    const replyCountMap = new Map(replyCounts.map((r) => [r.postId, Number(r.count)]));
    const reactionsByPost = this.groupReactionsByPost(reactions);

    return {
      data: posts.map((p) =>
        this.serializePost(
          p,
          reactionsByPost.get(p.id) ?? [],
          replyCountMap.get(p.id) ?? 0,
          userId,
        ),
      ),
      total,
      page,
      limit,
    };
  }

  async createPost(dto: CreatePostDto, authorId: string) {
    const post = await this.postRepo.save(
      this.postRepo.create({ authorId, type: 'forum_post', sede: dto.sede, body: dto.body }),
    );
    const author = await this.userRepo.findOneOrFail({ where: { id: authorId } });
    post.author = author;
    return this.serializePost(post, [], 0, authorId);
  }

  async addReaction(postId: string, emoji: ReactionEmoji, userId: string) {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Publicación no encontrada');

    const existing = await this.reactionRepo.findOne({
      where: { postId, authorId: userId, emoji },
    });
    if (!existing) {
      await this.reactionRepo.save(
        this.reactionRepo.create({ postId, authorId: userId, emoji }),
      );
    }
    return this.reactionSummary(postId, userId);
  }

  async removeReaction(postId: string, emoji: ReactionEmoji, userId: string) {
    const existing = await this.reactionRepo.findOne({
      where: { postId, authorId: userId, emoji },
    });
    if (existing) await this.reactionRepo.delete(existing.id);
    return this.reactionSummary(postId, userId);
  }

  async findReplies(postId: string) {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Publicación no encontrada');

    const replies = await this.replyRepo.find({
      where: { postId },
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });
    return replies.map((r) => this.serializeReply(r));
  }

  async createReply(postId: string, dto: CreateReplyDto, authorId: string) {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Publicación no encontrada');

    const reply = await this.replyRepo.save(
      this.replyRepo.create({ postId, authorId, body: dto.body }),
    );
    const author = await this.userRepo.findOneOrFail({ where: { id: authorId } });
    reply.author = author;
    return this.serializeReply(reply);
  }

  async reportPost(postId: string, reporterId: string) {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Publicación no encontrada');

    const existing = await this.reportRepo.findOne({ where: { postId, reporterId } });
    if (!existing) {
      await this.reportRepo.save(this.reportRepo.create({ postId, reporterId }));
      await this.postRepo.increment({ id: postId }, 'reportCount', 1);
    }
    return { reported: true };
  }

  // CA3: cola de moderación — publicaciones con 5+ reportes para revisión del psicólogo
  async findFlaggedPosts(sede: string, requesterId: string) {
    await this.assertPsychologist(requesterId);
    const posts = await this.postRepo.find({
      where: { sede, reportCount: MoreThanOrEqual(REPORT_THRESHOLD) },
      relations: ['author'],
      order: { reportCount: 'DESC' },
    });
    return posts.map((p) => this.serializePost(p, [], 0, requesterId));
  }

  // CA3: el psicólogo elimina una publicación reportada desde el dashboard
  async deletePost(postId: string, requesterId: string) {
    await this.assertPsychologist(requesterId);
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    await this.postRepo.delete(postId);
    return { deleted: true };
  }

  private async assertPsychologist(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.role !== 'psychologist') {
      throw new ForbiddenException('Solo un psicólogo puede moderar la comunidad');
    }
  }

  private async reactionSummary(postId: string, userId: string) {
    const reactions = await this.reactionRepo.find({ where: { postId } });
    return { reactions: this.buildReactionSummaries(reactions, userId) };
  }

  private groupReactionsByPost(reactions: PostReaction[]): Map<string, PostReaction[]> {
    const map = new Map<string, PostReaction[]>();
    for (const r of reactions) {
      if (!map.has(r.postId)) map.set(r.postId, []);
      map.get(r.postId)!.push(r);
    }
    return map;
  }

  private buildReactionSummaries(reactions: PostReaction[], userId: string): ReactionSummary[] {
    const byEmoji = new Map<string, { count: number; userReacted: boolean }>();
    for (const r of reactions) {
      const cur = byEmoji.get(r.emoji) ?? { count: 0, userReacted: false };
      cur.count++;
      if (r.authorId === userId) cur.userReacted = true;
      byEmoji.set(r.emoji, cur);
    }
    return Array.from(byEmoji.entries()).map(([emoji, d]) => ({
      emoji: emoji as ReactionEmoji,
      count: d.count,
      userReacted: d.userReacted,
    }));
  }

  private serializeAnnouncement(p: CommunityPost, userAttends: boolean) {
    return {
      id: p.id,
      authorId: p.authorId,
      authorName: `${p.author.firstName} ${p.author.lastName}`,
      authorRole: p.author.role,
      type: p.type,
      sede: p.sede,
      title: p.title,
      body: p.body,
      eventDate: p.eventDate?.toISOString() ?? null,
      userAttends,
      createdAt: p.createdAt.toISOString(),
    };
  }

  private serializePost(
    p: CommunityPost,
    reactions: PostReaction[],
    replyCount: number,
    userId: string,
  ) {
    return {
      id: p.id,
      authorId: p.authorId,
      authorName: `${p.author.firstName} ${p.author.lastName}`,
      authorRole: p.author.role,
      type: p.type,
      sede: p.sede,
      body: p.body,
      reportCount: p.reportCount,
      replyCount,
      reactions: this.buildReactionSummaries(reactions, userId),
      createdAt: p.createdAt.toISOString(),
    };
  }

  private serializeReply(r: PostReply) {
    return {
      id: r.id,
      postId: r.postId,
      authorId: r.authorId,
      authorName: `${r.author.firstName} ${r.author.lastName}`,
      authorRole: r.author.role,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
