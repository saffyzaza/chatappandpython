import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword, verifyToken, COOKIE_NAME } from '@/lib/auth';

const ALLOWED_ROLES = ['user', 'admin', 'adminsuper'];
const ALLOWED_STATUSES = ['pending', 'approved'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, role, status } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
    }

    // ตรวจสอบว่าเป็น adminsuper หรือไม่ (ถ้าต้องการระบุ role/status)
    let resolvedRole = 'user';
    let resolvedStatus = 'pending';

    if (role !== undefined || status !== undefined) {
      const token = req.cookies.get(COOKIE_NAME)?.value;
      const payload = token ? await verifyToken(token) : null;
      if (!payload || payload.role !== 'adminsuper') {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์กำหนด role หรือ status' }, { status: 403 });
      }
      if (role && ALLOWED_ROLES.includes(role)) resolvedRole = role;
      if (status && ALLOWED_STATUSES.includes(status)) resolvedStatus = status;
    }

    const existing = await pool.query('SELECT id FROM accounts WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    await pool.query(
      `INSERT INTO accounts (name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5)`,
      [name.trim(), email.toLowerCase().trim(), passwordHash, resolvedRole, resolvedStatus]
    );

    return NextResponse.json(
      { message: resolvedStatus === 'approved' ? 'สร้างบัญชีสำเร็จ' : 'ลงทะเบียนสำเร็จ บัญชีของคุณอยู่ระหว่างรอการอนุมัติ' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[register]', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 });
  }
}
