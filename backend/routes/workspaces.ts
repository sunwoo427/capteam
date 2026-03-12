import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// 랜덤 6자리 초대 코드 생성 함수
function generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 3.9. 팀방 고정/해제 토글 API
router.patch('/:id/pin', async (req: Request, res: Response) => {
    try {
        const workspaceId = (req.params.id as string).trim();
        const userId = (req.body.userId as string || '').trim();

        console.log(`[WORKSPACE] /pin request: wsId='${workspaceId}', userId='${userId}'`);

        if (!userId) return res.status(400).json({ error: '사용자 ID가 필요합니다.' });

        // 먼저 해당 멤버가 존재하는지 확인
        const member = await prisma.workspaceMember.findFirst({
            where: { userId, workspaceId }
        });

        if (!member) {
            console.log(`[WORKSPACE] /pin FAILED: member not found for wsId='${workspaceId}', userId='${userId}'`);
            return res.status(404).json({ error: '해당 팀방의 멤버가 아닙니다.' });
        }

        const updatedMember = await prisma.workspaceMember.update({
            where: { id: member.id },
            data: { isPinned: !member.isPinned }
        });

        console.log(`[WORKSPACE] /pin SUCCESS: wsId=${workspaceId}, userId=${userId}, isPinned=${updatedMember.isPinned}`);
        res.status(200).json({ isPinned: updatedMember.isPinned });
    } catch (error) {
        console.error('[WORKSPACE] /pin internal error:', error);
        res.status(500).json({ error: '팀방 고정 처리에 실패했습니다.' });
    }
});

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

router.get('/user/:userId', async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId as string;
        console.log(`[WORKSPACE] fetchWorkspaces for userId: ${userId}`);

        const memberships = await prisma.workspaceMember.findMany({
            where: { userId },
            include: {
                workspace: true
            },
            orderBy: [
                { isPinned: 'desc' }, // 고정된 방 우선
                { joinedAt: 'desc' }  // 최근 가입한 방 우선
            ]
        });

        console.log(`[WORKSPACE] User ${userId} has ${memberships.length} memberships`);

        const workspaces = memberships.map((m: any) => ({
            ...m.workspace,
            role: m.role,
            isPinned: m.isPinned,
            joinedAt: m.joinedAt
        }));

        res.status(200).json(workspaces);
    } catch (error) {
        console.error('[WORKSPACE] Error fetching user workspaces:', error);
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
                },
                tasks: {
                    include: {
                        assignees: {
                            include: {
                                user: { select: { id: true, name: true, avatarUrl: true } }
                            }
                        }
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

// 3.5. 팀 기여도 통계 API (균등 분배 방식)
router.get('/:id/stats', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // DONE 상태인 태스크와 담당자 정보 조회
        const doneTasks = await prisma.task.findMany({
            where: { workspaceId: id as string, status: 'DONE' },
            include: {
                assignees: {
                    include: { user: { select: { id: true, name: true } } }
                }
            }
        });

        // 워크스페이스 멤버 전체 조회 (기여도 0인 멤버도 포함)
        const members = await prisma.workspaceMember.findMany({
            where: { workspaceId: id as string },
            include: { user: { select: { id: true, name: true } } }
        });

        // 균등 분배: 각 완료된 태스크 배점을 담당자 수로 나눠 분배
        const pointsMap: Record<string, { name: string, points: number }> = {};
        for (const member of members) {
            pointsMap[member.userId] = { name: member.user.name, points: 0 };
        }

        let totalPoints = 0;
        for (const task of doneTasks) {
            const assigneeCount = task.assignees.length;
            if (assigneeCount === 0) continue;
            const share = task.points / assigneeCount;
            for (const assignee of task.assignees) {
                const entry = pointsMap[assignee.userId];
                if (entry) {
                    entry.points += share;
                }
            }
            totalPoints += task.points;
        }

        // 비율 계산 후 배열로 반환
        const stats = Object.entries(pointsMap).map(([userId, { name, points }]) => ({
            userId,
            name,
            points: Math.round(points * 10) / 10, // 소수점 1자리
            percent: totalPoints > 0 ? Math.round((points / totalPoints) * 1000) / 10 : 0
        })).sort((a, b) => b.points - a.points);

        res.status(200).json({ stats, totalPoints });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to calculate stats' });
    }
});

// 3.6. 팀방 기본 정보 수정 API (이름, 마감일, 공지사항) - 팀장 전용
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, deadline, notice, userId } = req.body as { name?: string; deadline?: string; notice?: string; userId: string };

        if (!userId) return res.status(400).json({ error: '사용자 ID가 필요합니다.' });

        const member = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: userId as string, workspaceId: id as string } }
        });
        if (!member || member.role !== 'LEADER') {
            return res.status(403).json({ error: '팀장만 수정할 수 있습니다.' });
        }

        const updated = await prisma.workspace.update({
            where: { id: id as string },
            data: {
                ...(name !== undefined ? { name } : {}),
                ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
                ...(notice !== undefined ? { notice } : {}),
            }
        });
        res.status(200).json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '팀방 정보 수정에 실패했습니다.' });
    }
});

// 3.7. 초대코드 재발급 API - 팀장 전용
router.post('/:id/regenerate-invite', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { userId } = req.body as { userId: string };

        if (!userId) return res.status(400).json({ error: '사용자 ID가 필요합니다.' });

        const member = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: userId as string, workspaceId: id as string } }
        });
        if (!member || member.role !== 'LEADER') {
            return res.status(403).json({ error: '팀장만 초대코드를 재발급할 수 있습니다.' });
        }

        let newCode = generateInviteCode();
        let exists = await prisma.workspace.findUnique({ where: { inviteCode: newCode } });
        while (exists) {
            newCode = generateInviteCode();
            exists = await prisma.workspace.findUnique({ where: { inviteCode: newCode } });
        }

        const updated = await prisma.workspace.update({
            where: { id: id as string },
            data: { inviteCode: newCode }
        });
        res.status(200).json({ inviteCode: updated.inviteCode });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '초대코드 재발급에 실패했습니다.' });
    }
});

// 3.8. 팀원 강제 퇴장 API (팀장 전용)
router.delete('/:id/kick/:targetUserId', async (req: Request, res: Response) => {
    try {
        const { id, targetUserId } = req.params;
        const { userId } = req.body as { userId: string };

        if (!userId) return res.status(400).json({ error: '사용자 ID가 필요합니다.' });

        const leader = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: userId as string, workspaceId: id as string } }
        });
        if (!leader || leader.role !== 'LEADER') {
            return res.status(403).json({ error: '팀장만 팀원을 내보낼 수 있습니다.' });
        }
        if (userId === targetUserId) {
            return res.status(400).json({ error: '본인을 내보낼 수 없습니다.' });
        }

        await prisma.workspaceMember.delete({
            where: { userId_workspaceId: { userId: targetUserId as string, workspaceId: id as string } }
        });
        res.status(200).json({ message: '팀원을 내보냈습니다.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '팀원 내보내기에 실패했습니다.' });
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

        await prisma.taskComment.deleteMany({ where: { task: { workspaceId: id as string } } });
        await prisma.taskAssignee.deleteMany({ where: { task: { workspaceId: id as string } } });
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

        // 귄한 검증: fromUserId가 현재 팀방의 팀장인지 확인
        const currentLeader = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: fromUserId as string, workspaceId: id as string } }
        });

        if (!currentLeader || currentLeader.role !== 'LEADER') {
            return res.status(403).json({ error: '팀장만이 권한을 위임할 수 있습니다.' });
        }

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

        // [NEW] 실시간 소켓 알림 전송
        const io = req.app.get('io');
        const workspace = await prisma.workspace.findUnique({ where: { id: id as string } });
        if (io && workspace) {
            io.to(id).emit('role_delegated', {
                workspaceId: id,
                workspaceName: workspace.name,
                newLeaderId: toUserId,
                fromUserId: fromUserId
            });
        }

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
        const { title, description, points, deadline, assignedToIds = [], createdById } = req.body;

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
                createdById: createdById as string,
                status: 'TODO',
                assignees: {
                    create: Array.isArray(assignedToIds) ? assignedToIds.map((userId: string) => ({
                        userId
                    })) : []
                }
            },
            include: {
                assignees: {
                    include: {
                        user: { select: { id: true, name: true } }
                    }
                }
            }
        });

        res.status(201).json(task);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// 8. 태스크 완료 처리 API (팀장 전용)
router.put('/:id/tasks/:taskId/complete', async (req: Request, res: Response) => {
    try {
        const { id: workspaceId, taskId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: '사용자 ID가 필요합니다.' });
        }

        // 팀장 권한 검증
        const member = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: userId as string, workspaceId: workspaceId as string } }
        });

        if (!member || member.role !== 'LEADER') {
            return res.status(403).json({ error: '오직 팀장만이 태스크를 완료 처리할 수 있습니다.' });
        }

        const task = await prisma.task.update({
            where: { id: taskId as string },
            data: { status: 'DONE' },
            include: {
                assignees: {
                    include: {
                        user: { select: { id: true, name: true } }
                    }
                }
            }
        });

        res.status(200).json(task);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '태스크 완료 처리에 실패했습니다.' });
    }
});

export default router;
