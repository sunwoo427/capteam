import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const router = Router();
const adapter = new PrismaBetterSqlite3({ url: './dev.db' } as any);
const prisma = new PrismaClient({ adapter });

// 랜덤 6자리 초대 코드 생성 함수
function generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 1. 방(Workspace) 생성 API
router.post('/', async (req: Request, res: Response) => {
    try {
        const { name, subject, deadline, leaderId } = req.body;

        if (!name || !leaderId) {
            return res.status(400).json({ error: 'Workspace name and leaderId are required' });
        }

        // 리더 유저가 존재하는지 확인, 없으면 테스트를 위해 임시 유저 생성
        let leader = await prisma.user.findUnique({ where: { id: leaderId } });
        if (!leader) {
            if (leaderId === 'test-user-id') {
                leader = await prisma.user.create({
                    data: {
                        id: 'test-user-id',
                        email: 'test@example.com',
                        name: 'Test User'
                    }
                });
            } else {
                return res.status(404).json({ error: 'Leader user not found' });
            }
        }

        // 유니크한 초대 코드 생성
        let inviteCode = generateInviteCode();
        let codeExists = await prisma.workspace.findUnique({ where: { inviteCode } });
        while (codeExists) {
            inviteCode = generateInviteCode();
            codeExists = await prisma.workspace.findUnique({ where: { inviteCode } });
        }

        // 트랜잭션: 방 생성 후 해당 방에 리더를 WorkspaceMember로 추가
        const workspace = await prisma.$transaction(async (tx) => {
            const newWorkspace = await tx.workspace.create({
                data: {
                    name,
                    subject,
                    deadline: deadline ? new Date(deadline) : null,
                    inviteCode,
                }
            });

            await tx.workspaceMember.create({
                data: {
                    userId: leaderId,
                    workspaceId: newWorkspace.id,
                    role: 'LEADER'
                }
            });

            return newWorkspace;
        });

        res.status(201).json(workspace);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error while creating workspace' });
    }
});

// 특정 사용자가 속해 있는 팀방(Workspace) 목록 반환 API
router.get('/user/:userId', async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId as string;

        const memberships = await prisma.workspaceMember.findMany({
            where: { userId },
            include: {
                workspace: true
            }
        });

        const workspaces = memberships.map((m: any) => ({
            ...m.workspace,
            role: m.role
        }));

        res.status(200).json(workspaces);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch user workspaces' });
    }
});

// 2. 초대 코드로 방 참가하기 API
router.post('/join', async (req: Request, res: Response) => {
    try {
        const { inviteCode, userId } = req.body;

        if (!inviteCode || !userId) {
            return res.status(400).json({ error: 'Invite code and userId are required' });
        }

        // 유저 확인
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 초대 코드로 방 찾기
        const workspace = await prisma.workspace.findUnique({ where: { inviteCode } });
        if (!workspace) {
            return res.status(404).json({ error: 'Invalid invite code or workspace not found' });
        }

        // 이미 가입된 멤버인지 확인 (복합 키)
        const existingMember = await prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId,
                    workspaceId: workspace.id
                }
            }
        });

        if (existingMember) {
            return res.status(400).json({ error: 'User is already a member of this workspace', workspace });
        }

        // 멤버로 추가 (MEMBER 권한)
        const newMember = await prisma.workspaceMember.create({
            data: {
                userId,
                workspaceId: workspace.id,
                role: 'MEMBER'
            }
        });

        res.status(200).json({ message: 'Successfully joined workspace', memberInfo: newMember, workspace });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error while joining workspace' });
    }
});

// 3. 방 상세 정보 및 멤버 목록 조회 API
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const workspace = await prisma.workspace.findUnique({
            where: { id: id as string },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, name: true, email: true, avatarUrl: true } }
                    }
                }
            }
        });

        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        res.status(200).json(workspace);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch workspace details' });
    }
});

// 4. 팀방 나가기 API
router.delete('/:id/leave/:userId', async (req: Request, res: Response) => {
    try {
        const { id, userId } = req.params;

        const member = await prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId: userId as string,
                    workspaceId: id as string
                }
            }
        });

        if (!member) {
            return res.status(404).json({ error: 'User is not a member of this workspace' });
        }

        // 만약 리더가 나가는 경우 (추가적인 로직 필요 - 현재는 단순 멤버 삭제만 구현)
        if (member.role === 'LEADER') {
            // TODO: 방장 역할 위임 또는 방 삭제 로직
            console.warn('Leader is leaving the workspace, might need special handling');
        }

        await prisma.workspaceMember.delete({
            where: {
                userId_workspaceId: {
                    userId: userId as string,
                    workspaceId: id as string
                }
            }
        });

        res.status(200).json({ message: 'Successfully left the workspace' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to leave the workspace' });
    }
});

// 5. 팀방 전체 삭제 API (리더가 양도 없이 나갈 때 사용)
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // cascade 옵션이 없으므로 연관 데이터 수동 삭제
        await prisma.taskComment.deleteMany({ where: { task: { workspaceId: id as string } } });
        await prisma.task.deleteMany({ where: { workspaceId: id as string } });
        await prisma.messageReadReceipt.deleteMany({ where: { message: { workspaceId: id as string } } });
        await prisma.chatMessage.deleteMany({ where: { workspaceId: id as string } });
        await prisma.workspaceMember.deleteMany({ where: { workspaceId: id as string } });
        await prisma.workspace.delete({ where: { id: id as string } });

        res.status(200).json({ message: 'Successfully deleted the workspace' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete the workspace' });
    }
});

// 6. 팀장 권한 위임 API
router.post('/:id/delegate', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { fromUserId, toUserId } = req.body;

        await prisma.$transaction([
            prisma.workspaceMember.update({
                where: { userId_workspaceId: { userId: fromUserId as string, workspaceId: id as string } },
                data: { role: 'MEMBER' }
            }),
            prisma.workspaceMember.update({
                where: { userId_workspaceId: { userId: toUserId as string, workspaceId: id as string } },
                data: { role: 'LEADER' }
            })
        ]);

        res.status(200).json({ message: 'Successfully delegated leader role' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delegate leader role' });
    }
});

// 7. 태스크 추가 API (팀장만 가능)
router.post('/:id/tasks', async (req: Request, res: Response) => {
    try {
        const { id: workspaceId } = req.params;
        const { title, description, points, deadline, assignedToId, createdById } = req.body;

        if (!title || !createdById) {
            return res.status(400).json({ error: '태스크 제목과 작성자 ID가 필요합니다.' });
        }

        // 팀장 권한 확인
        const member = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: createdById as string, workspaceId: workspaceId as string } }
        });

        if (!member || member.role !== 'LEADER') {
            return res.status(403).json({ error: '팀장만 태스크를 추가할 수 있습니다.' });
        }

        const task = await prisma.task.create({
            data: {
                workspaceId: workspaceId as string,
                title,
                description: description || null,
                points: points ? parseInt(points) : 1,
                deadline: deadline ? new Date(deadline) : null,
                assignedToId: assignedToId || null,
                createdById: createdById as string,
                status: 'TODO',
            }
        });

        res.status(201).json(task);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

export default router;
