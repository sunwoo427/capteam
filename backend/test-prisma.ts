import { PrismaClient } from '@prisma/client';
console.log('1. Connecting to DB...');
const prisma = new PrismaClient();

async function test() {
    try {
        console.log('2. Querying...');
        const users = await prisma.user.findMany();
        console.log('3. Success! Found users:', users.length);
    } catch (e: any) {
        console.error('ERROR MESSAGE:', e.message);
        console.error('FULL ERROR:', e);
    } finally {
        await prisma.$disconnect();
    }
}
test();
