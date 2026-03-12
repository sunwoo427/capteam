import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import authRoutes from './routes/auth';
import workspaceRoutes from './routes/workspaces';
import chatRoutes from './routes/chat';
import uploadRoutes from './routes/upload';
import prisma from './lib/prisma';

dotenv.config();

const app = express();
const server = http.createServer(app); // Express를 http 서버로 래핑
const io = new SocketIOServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// 업로드된 파일을 외부에서 접근할 수 있도록 정적 폴더로 설정
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.set('io', io);

app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
// chat.ts의 라우트들은 이미 /api/workspaces/:workspaceId/... 형태를 기대하므로 중복 등록 제거 대신 경로를 명확히 함
app.use('/api/workspaces', chatRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Evaluation App Backend is running!', timestamp: new Date().toISOString() });
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
    socket.on('send_message', async (data: { workspaceId: string; userId: string; content: string; type?: string; fileUrl?: string }) => {
        try {
            const newMessage = await prisma.chatMessage.create({
                data: {
                    workspaceId: data.workspaceId,
                    userId: data.userId,
                    content: data.content,
                    type: data.type || 'TEXT',
                    fileUrl: data.fileUrl || null
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

// [DEBUG] 모든 요청 로깅 미들웨어
app.use((req: Request, res: Response, next) => {
    console.log(`[REQ] ${req.method} ${req.url}`);
    next();
});

server.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
