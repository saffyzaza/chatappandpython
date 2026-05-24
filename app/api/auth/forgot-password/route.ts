import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'กรุณากรอกอีเมล' }, { status: 400 });
    }

    const result = await pool.query(
      'SELECT id, name FROM accounts WHERE email = $1 AND status = $2',
      [email.toLowerCase().trim(), 'approved']
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { message: 'หากอีเมลนี้ถูกต้อง คุณจะได้รับลิงก์รีเซ็ตรหัสผ่าน' },
        { status: 200 }
      );
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query(
      'UPDATE accounts SET reset_token = $1, reset_token_expires = $2 WHERE email = $3',
      [resetToken, expires, email.toLowerCase().trim()]
    );

    console.log(`[forgot-password] Reset link: ${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`);

    return NextResponse.json(
      { message: 'หากอีเมลนี้ถูกต้อง คุณจะได้รับลิงก์รีเซ็ตรหัสผ่าน' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[forgot-password]', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 });
  }
}
