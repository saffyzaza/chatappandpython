import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyToken, verifyPassword, hashPassword, COOKIE_NAME } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ error: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ' }, { status: 401 });
    }

    const result = await pool.query(
      `SELECT id, name, email, role, status, prefix, organization, position, department,
              phone, province, health_zone, parent_organization, org_code, address, website,
              approved_at, created_at
       FROM accounts WHERE id = $1`,
      [payload.userId]
    );

    const user = result.rows[0];
    if (!user) {
      return NextResponse.json({ error: 'ไม่พบบัญชีผู้ใช้' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('[me]', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token ไม่ถูกต้อง' }, { status: 401 });

    const body = await req.json();
    const { current_password, new_password, ...profileFields } = body;

    // เปลี่ยนรหัสผ่าน
    if (current_password !== undefined || new_password !== undefined) {
      if (!current_password || !new_password) {
        return NextResponse.json({ error: 'กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่' }, { status: 400 });
      }
      if (new_password.length < 8) {
        return NextResponse.json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
      }
      const r = await pool.query('SELECT password_hash FROM accounts WHERE id = $1', [payload.userId]);
      const acc = r.rows[0];
      if (!acc) return NextResponse.json({ error: 'ไม่พบบัญชี' }, { status: 404 });
      const valid = await verifyPassword(current_password, acc.password_hash);
      if (!valid) return NextResponse.json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, { status: 400 });
      const newHash = await hashPassword(new_password);
      await pool.query('UPDATE accounts SET password_hash = $1 WHERE id = $2', [newHash, payload.userId]);
      return NextResponse.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    }

    // อัปเดตโปรไฟล์
    const allowed = ['name', 'prefix', 'phone', 'organization', 'position', 'department',
                     'province', 'health_zone', 'parent_organization', 'org_code', 'address', 'website'];
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const key of allowed) {
      if (key in profileFields) {
        updates.push(`${key} = $${idx}`);
        values.push(profileFields[key] || null);
        idx++;
      }
    }
    if (updates.length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะอัปเดต' }, { status: 400 });
    }
    values.push(payload.userId);
    await pool.query(`UPDATE accounts SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    return NextResponse.json({ message: 'บันทึกข้อมูลสำเร็จ' });
  } catch (error) {
    console.error('[me PATCH]', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 });
  }
}
