import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import authRoutes from './routes/auth';
import workspaceRoutes from './routes/workspaces';
import chatRoutes from './routes/chat';

dotenv.config();

const app = express();
const server = http.createServer(app); // Express를 http 서버로 래핑
const io = new SocketIOServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});
const adapter = new PrismaBetterSqlite3({ url: './dev.db' } as any);
const prisma = new PrismaClient({ adapter });
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/workspaces', chatRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Evaluation App Backend is running!' });
});

// ——— Socket.io 실시간 이벤트 처리 ———
io.on('connection', (socket) => {
    console.log(`[Socket] 클라이언트 연결됨: ${socket.id}`);

    // 1. 특정 워크스페이스 채팅방에 참여
    socket.on('join_room', (workspaceId: string) => {
        socket.join(workspaceId);
        console.log(`[Socket] ${socket.id} 가 방 ${workspaceId} 에 참여`);
    });

    // 2. 메시지 전송 (DB 저장 후 방 전체에 브로드캐스트)
    socket.on('send_message', async (data: { workspaceId: string; userId: string; content: string }) => {
        try {
            const newMessage = await prisma.chatMessage.create({
                data: {
                    workspaceId: data.workspaceId,
                    userId: data.userId,
                    content: data.content
                },
                include: {
                    user: { select: { id: true, name: true, avatarUrl: true } },
                    readReceipts: { include: { user: { select: { id: true, name: true } } } }
                }
            });
            // 보낸 사람 포함 같은 방의 모든 클라이언트에게 전송
            io.to(data.workspaceId).emit('new_message', newMessage);
        } catch (e) {
            console.error('[Socket] send_message 오류:', e);
        }
    });

    // 3. 읽음 처리 이벤트 (실시간 동기화)
    socket.on('mark_read', async (data: { messageId: string; userId: string; workspaceId: string }) => {
        try {
            const existing = await prisma.messageReadReceipt.findUnique({
                where: { messageId_userId: { messageId: data.messageId, userId: data.userId } }
            });
            if (!existing) {
                const receipt = await prisma.messageReadReceipt.create({
                    data: { messageId: data.messageId, userId: data.userId },
                    include: { user: { select: { id: true, name: true } } }
                });
                // 해당 방 전체에 읽음 정보 브로드캐스트
                io.to(data.workspaceId).emit('read_update', { messageId: data.messageId, reader: receipt.user });
            }
        } catch (e) {
            console.error('[Socket] mark_read 오류:', e);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] 클라이언트 연결 해제: ${socket.id}`);
    });
});

server.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
