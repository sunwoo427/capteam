import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const router = Router();
const adapter = new PrismaBetterSqlite3({ url: './dev.db' } as any);
const prisma = new PrismaClient({ adapter });

// 1. 특정 워크스페이스의 채팅 내역 및 읽음 정보 가져오기
router.get('/:workspaceId/chat', async (req: Request, res: Response) => {
    try {
        const workspaceId = req.params.workspaceId as string;

        // 속한 모든 메시지와 각 메시지의 읽음 목록(readReceipts)을 함께 로드합니다.
        const messages = await prisma.chatMessage.findMany({
            where: { workspaceId: workspaceId },
            orderBy: { createdAt: 'asc' }, // 과거부터 최신순
            include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
                readReceipts: {
                    include: {
                        user: { select: { id: true, name: true } }
                    }
                }
            }
        });

        res.status(200).json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
});

// 1.5. 특정 사용자의 안 읽은 메시지 개수 조회 API
router.get('/:workspaceId/chat/unread', async (req: Request, res: Response) => {
    try {
        const workspaceId = req.params.workspaceId as string;
        const userId = req.query.userId as string;

        if (!userId) {
            return res.status(400).json({ error: 'userId query parameter is required' });
        }

        // 해당 워크스페이스의 메시지 중 내가 쓴 것이 아니며, 내가 읽음 처리하지 않은 메시지 수 카운트
        const unreadCount = await prisma.chatMessage.count({
            where: {
                workspaceId: workspaceId,
                userId: { not: userId },
                readReceipts: {
                    none: { userId: userId }
                }
            }
        });

        res.status(200).json({ unreadCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});

// 2. 메시지 읽음 처리 (내역 추가) API
router.post('/:workspaceId/chat/read', async (req: Request, res: Response) => {
    try {
        const { messageId, userId } = req.body;

        if (!messageId || !userId) {
            return res.status(400).json({ error: 'messageId and userId are required' });
        }

        // 특정 메시지를 이미 이 유저가 읽었는지 확인 (중복 방지)
        const alreadyRead = await prisma.messageReadReceipt.findUnique({
            where: {
                messageId_userId: { messageId, userId }
            }
        });

        if (!alreadyRead) {
            const newReceipt = await prisma.messageReadReceipt.create({
                data: { messageId, userId }
            });
            return res.status(201).json(newReceipt);
        }

        res.status(200).json({ message: 'Already marked as read' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to mark message as read' });
    }
});

// 3. 특정 방 알림 끄기/켜기 토글
router.put('/:workspaceId/mute', async (req: Request, res: Response) => {
    try {
        const workspaceId = req.params.workspaceId as string;
        const { userId, isMuted } = req.body;

        if (!userId || typeof isMuted !== 'boolean') {
            return res.status(400).json({ error: 'userId and isMuted (boolean) are required' });
        }

        const member = await prisma.workspaceMember.update({
            where: {
                userId_workspaceId: { userId, workspaceId: workspaceId }
            },
            data: { isMuted }
        });

        res.status(200).json(member);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to toggle mute status' });
    }
});

export default router;
