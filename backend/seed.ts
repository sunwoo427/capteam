import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: './dev.db' } as any);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Start seeding...');

    const testEmails = ['test@naver.com', 'dummy1@test.com', 'dummy2@test.com', 'dummy3@test.com', 'dummy4@test.com'];

    // Get user IDs for these emails and specifically 'test-user-id'
    const existingUsers = await prisma.user.findMany({
        where: {
            OR: [
                { email: { in: testEmails } },
                { id: 'test-user-id' }
            ]
        },
        select: { id: true }
    });
    const userIds = existingUsers.map(u => u.id);

    // 기존 더미 데이터 정리 (연관 데이터 포함) - 외래키 제약조건 방지


    if (userIds.length > 0) {
        await prisma.taskComment.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.task.deleteMany({ where: { createdById: { in: userIds } } });
        await prisma.messageReadReceipt.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.chatMessage.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.workspaceMember.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    // 1. 메인 테스트 계정 생성 (test@naver.com / test)
    try {
        const mainUser = await prisma.user.create({
            data: {
                id: 'test-user-id',
                email: 'test@naver.com',
                name: '김테스트 (Me)',
            },
        });
        console.log(`Created main user: ${mainUser.name}`);
    } catch (e) {
        console.error("Failed to create main user:", e);
    }

    // 2. 더미 팀원 4명 생성
    const dummyUsers = [
        { id: 'dummy-1', email: 'dummy1@test.com', name: '이더미' },
        { id: 'dummy-2', email: 'dummy2@test.com', name: '박더미' },
        { id: 'dummy-3', email: 'dummy3@test.com', name: '최더미' },
        { id: 'dummy-4', email: 'dummy4@test.com', name: '정더미' },
    ];

    for (const data of dummyUsers) {
        try {
            const user = await prisma.user.upsert({
                where: { email: data.email },
                update: { name: data.name },
                create: {
                    id: data.id,
                    email: data.email,
                    name: data.name
                },
            });
            console.log(`Created/Updated dummy user: ${user.name}`);
        } catch (e) {
            console.error(`Failed to upsert dummy user: ${data.name}`, e);
        }
    }

    // 3. 더미 팀방(Workspace) 생성 및 팀원 추가
    try {
        const dummyWorkspace = await prisma.workspace.create({
            data: {
                name: '웹서비스 설계 프로젝트',
                subject: '졸업 작품 준비',
                inviteCode: 'DEMO1234',
                deadline: new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
                members: {
                    create: [
                        { userId: 'test-user-id', role: 'LEADER' },
                        { userId: 'dummy-1', role: 'MEMBER' },
                        { userId: 'dummy-2', role: 'MEMBER' },
                        { userId: 'dummy-3', role: 'MEMBER' },
                        { userId: 'dummy-4', role: 'MEMBER' },
                    ]
                },
                tasks: {
                    create: [
                        {
                            title: 'DB 스키마 설계',
                            status: 'DONE',
                            points: 10,
                            createdById: 'test-user-id',
                            assignees: { create: [{ userId: 'dummy-1' }] },
                        },
                        {
                            title: '메인 API 개발',
                            status: 'IN_PROGRESS',
                            points: 20,
                            createdById: 'test-user-id',
                            assignees: { create: [{ userId: 'test-user-id' }] },
                            deadline: new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000)
                        },
                        {
                            title: '로그인 화면 UI 구현',
                            status: 'TODO',
                            points: 5,
                            createdById: 'test-user-id',
                            assignees: { create: [{ userId: 'dummy-2' }] },
                            deadline: new Date(new Date().getTime() + 5 * 24 * 60 * 60 * 1000)
                        }
                    ]
                }
            }
        });
        console.log(`Created dummy workspace: ${dummyWorkspace.name}`);
    } catch (e) {
        console.error("Failed to create dummy workspace:", e);
    }

    console.log('Seeding finished.');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
