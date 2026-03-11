import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const router = Router();
const adapter = new PrismaBetterSqlite3({ url: './dev.db' } as any);
const prisma = new PrismaClient({ adapter });

// 회원가입
router.post('/register', async (req: Request, res: Response) => {
    console.log('[AUTH] /register incoming request body:', req.body);
    try {
        const { email, name, studentId, password, department, avatarUrl } = req.body;

        if (!email || !name || !studentId || !password || !department) {
            console.log('[AUTH] /register failed: Missing fields');
            return res.status(400).json({ error: 'All fields (email, name, studentId, password, department) are required' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists with this email' });
        }

        const newUser = await prisma.user.create({
            data: { email, name, studentId, password, department, avatarUrl }
        });

        console.log('[AUTH] /register User successfully created:', newUser.id);
        res.status(201).json(newUser);
    } catch (error) {
        console.error('[AUTH] /register Internal Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 로그인 (테스트용: 이메일만으로 유저 조회)
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 아이디(이메일) 찾기: 이름 + 학번으로 조회
router.post('/find-email', async (req: Request, res: Response) => {
    try {
        const { name, studentId } = req.body;
        if (!name || !studentId) {
            return res.status(400).json({ error: '이름과 학번을 모두 입력해 주세요.' });
        }

        const user = await prisma.user.findFirst({ where: { name, studentId } });
        if (!user) {
            return res.status(404).json({ error: '일치하는 회원 정보가 없습니다.' });
        }

        // 이메일 일부 마스킹: ab****@naver.com
        const [local, domain] = user.email.split('@');
        const masked = (local ?? '').slice(0, 2) + '****' + '@' + (domain ?? '');
        res.status(200).json({ maskedEmail: masked });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 비밀번호 재설정: 이메일 + 학번 확인 후 새 비밀번호 설정
router.post('/reset-password', async (req: Request, res: Response) => {
    try {
        const { email, studentId, newPassword } = req.body;
        if (!email || !studentId || !newPassword) {
            return res.status(400).json({ error: '이메일, 학번, 새 비밀번호를 모두 입력해 주세요.' });
        }

        const user = await prisma.user.findFirst({ where: { email, studentId } });
        if (!user) {
            return res.status(404).json({ error: '이메일 또는 학번이 일치하지 않습니다.' });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { password: newPassword }
        });

        res.status(200).json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
