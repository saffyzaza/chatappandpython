import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyToken, hashPassword, COOKIE_NAME } from '@/lib/auth';

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.role !== 'adminsuper') return null;
  return payload;
}

// GET /api/auth/users — list all users (admin only)
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status'); // pending | approved | rejected | all

  const query = status && status !== 'all'
    ? `SELECT id, name, email, role, status, prefix, organization, position, department,
              phone, province, created_at, approved_at
       FROM accounts WHERE status = $1 ORDER BY created_at DESC`
    : `SELECT id, name, email, role, status, prefix, organization, position, department,
              phone, province, created_at, approved_at
       FROM accounts ORDER BY created_at DESC`;

  const result = await pool.query(query, status && status !== 'all' ? [status] : []);
  return NextResponse.json({ users: result.rows });
}

// PATCH /api/auth/users — update a user (admin only)
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const body = await req.json();
  const { id, action, email, new_password, role } = body;

  if (!id) return NextResponse.json({ error: 'ไม่ระบุ id' }, { status: 400 });

  // approve / reject
  if (action === 'approve' || action === 'reject') {
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await pool.query(
      `UPDATE accounts SET status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3`,
      [newStatus, admin.userId, id]
    );
    return NextResponse.json({ success: true, status: newStatus });
  }

  // edit email / password / role
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (email !== undefined) {
    // ตรวจสอบว่า email ซ้ำหรือไม่
    const dup = await pool.query(
      `SELECT id FROM accounts WHERE email = $1 AND id != $2`,
      [email.toLowerCase().trim(), id]
    );
    if (dup.rows.length > 0) {
      return NextResponse.json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' }, { status: 409 });
    }
    fields.push(`email = $${idx++}`);
    values.push(email.toLowerCase().trim());
  }

  if (new_password !== undefined && new_password.trim() !== '') {
    if (new_password.length < 6) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
    }
    const hashed = await hashPassword(new_password);
    fields.push(`password_hash = $${idx++}`);
    values.push(hashed);
  }

  if (role !== undefined && (role === 'adminsuper' || role === 'admin' || role === 'user')) {
    fields.push(`role = $${idx++}`);
    values.push(role);
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะอัปเดต' }, { status: 400 });
  }

  values.push(id);
  await pool.query(
    `UPDATE accounts SET ${fields.join(', ')} WHERE id = $${idx}`,
    values
  );

  return NextResponse.json({ success: true });
}

// DELETE /api/auth/users — delete a user (admin only)
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ไม่ระบุ id' }, { status: 400 });

  // ป้องกันการลบตัวเอง
  if (id === admin.userId) {
    return NextResponse.json({ error: 'ไม่สามารถลบบัญชีของตัวเองได้' }, { status: 400 });
  }

  await pool.query(`DELETE FROM accounts WHERE id = $1`, [id]);
  return NextResponse.json({ success: true });
}
