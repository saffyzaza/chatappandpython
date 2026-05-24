'use client';

import React, { useCallback, useEffect, useState } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  prefix?: string;
  organization?: string;
  position?: string;
  department?: string;
  phone?: string;
  province?: string;
  created_at: string;
  approved_at?: string;
}

const STATUS_TABS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'pending', label: 'รออนุมัติ' },
  { key: 'approved', label: 'อนุมัติแล้ว' },
  { key: 'rejected', label: 'ถูกปฏิเสธ' },
];

const STATUS_BADGE: Record<string, string> = {
  approved: 'bg-green-50 text-green-700 border border-green-200',
  pending: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  rejected: 'bg-red-50 text-red-700 border border-red-200',
};
const STATUS_LABEL: Record<string, string> = {
  approved: 'อนุมัติแล้ว',
  pending: 'รออนุมัติ',
  rejected: 'ถูกปฏิเสธ',
};
const ROLE_LABEL: Record<string, string> = {
  adminsuper: 'Admin Super',
  admin: 'Admin',
  user: 'User',
};

interface EditState {
  email: string;
  new_password: string;
  role: string;
}

interface CreateState {
  name: string;
  email: string;
  password: string;
  role: string;
  status: string;
}

const CREATE_DEFAULT: CreateState = { name: '', email: '', password: '', role: 'user', status: 'approved' };

export default function ApprovedPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createState, setCreateState] = useState<CreateState>(CREATE_DEFAULT);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit modal
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editState, setEditState] = useState<EditState>({ email: '', new_password: '', role: 'user' });
  const [showPassword, setShowPassword] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirm
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/users?status=${tab}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUsers(data.users);
    } catch {
      showToast('ไม่สามารถโหลดข้อมูลได้', false);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleApprove = async (user: User, action: 'approve' | 'reject') => {
    setActionLoading(user.id + action);
    try {
      const res = await fetch('/api/auth/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(action === 'approve' ? `อนุมัติ ${user.name} แล้ว` : `ปฏิเสธ ${user.name} แล้ว`);
      fetchUsers();
    } catch (e: unknown) {
      showToast((e as Error).message || 'เกิดข้อผิดพลาด', false);
    } finally {
      setActionLoading(null);
    }
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditState({ email: user.email, new_password: '', role: user.role });
    setEditError('');
    setShowPassword(false);
  };

  const handleCreateSave = async () => {
    if (!createState.name.trim() || !createState.email.trim() || !createState.password.trim()) {
      setCreateError('กรุณากรอกชื่อ, อีเมล และรหัสผ่าน');
      return;
    }
    if (createState.password.length < 6) {
      setCreateError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    setCreateLoading(true);
    setCreateError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createState.name.trim(),
          email: createState.email.trim(),
          password: createState.password,
          role: createState.role,
          status: createState.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`สร้างบัญชี ${createState.name} แล้ว`);
      setShowCreate(false);
      setCreateState(CREATE_DEFAULT);
      fetchUsers();
    } catch (e: unknown) {
      setCreateError((e as Error).message || 'เกิดข้อผิดพลาด');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    setEditLoading(true);
    setEditError('');
    try {
      const body: Record<string, string> = { id: editUser.id };
      if (editState.email !== editUser.email) body.email = editState.email;
      if (editState.new_password.trim()) body.new_password = editState.new_password;
      if (editState.role !== editUser.role) body.role = editState.role;

      if (Object.keys(body).length === 1) {
        setEditError('ไม่มีข้อมูลที่เปลี่ยนแปลง');
        return;
      }

      const res = await fetch('/api/auth/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`อัปเดตข้อมูล ${editUser.name} แล้ว`);
      setEditUser(null);
      fetchUsers();
    } catch (e: unknown) {
      setEditError((e as Error).message || 'เกิดข้อผิดพลาด');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/auth/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteUser.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`ลบบัญชี ${deleteUser.name} แล้ว`);
      setDeleteUser(null);
      fetchUsers();
    } catch (e: unknown) {
      showToast((e as Error).message || 'เกิดข้อผิดพลาด', false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.organization || '').toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    all: users.length,
    pending: users.filter(u => u.status === 'pending').length,
    approved: users.filter(u => u.status === 'approved').length,
    rejected: users.filter(u => u.status === 'rejected').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
          ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">จัดการผู้ใช้งาน</h1>
            <p className="text-sm text-gray-500 mt-1">อนุมัติ แก้ไข และจัดการบัญชีผู้ใช้ทั้งหมด</p>
          </div>
          <button
            onClick={() => { setCreateState(CREATE_DEFAULT); setCreateError(''); setShowCreate(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#eb6f45] text-white text-sm font-medium rounded-xl hover:bg-[#d4613a] transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            สร้าง Users
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
          {STATUS_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                ${tab === t.key
                  ? 'bg-[#eb6f45] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              {t.label}
              {counts[t.key as keyof typeof counts] > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full
                  ${tab === t.key ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {counts[t.key as keyof typeof counts]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4 relative w-full max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ, อีเมล, หน่วยงาน..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eb6f45]/40 focus:border-[#eb6f45] bg-white"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              <svg className="animate-spin mr-2 h-5 w-5 text-[#eb6f45]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              กำลังโหลด...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-40">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <p className="text-sm">ไม่พบข้อมูลผู้ใช้</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ผู้ใช้งาน</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">หน่วยงาน</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">สถานะ</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">วันที่สมัคร</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#eb6f45]/10 text-[#eb6f45] flex items-center justify-center font-semibold text-sm shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        <p>{user.organization || '—'}</p>
                        {user.position && <p className="text-xs text-gray-400">{user.position}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border
                          ${user.role === 'adminsuper'
                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : user.role === 'admin'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                          {ROLE_LABEL[user.role] || user.role}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[user.status] || ''}`}>
                          {STATUS_LABEL[user.status] || user.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400">
                        {new Date(user.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {user.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(user, 'approve')}
                                disabled={actionLoading === user.id + 'approve'}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
                              >
                                {actionLoading === user.id + 'approve' ? '...' : 'อนุมัติ'}
                              </button>
                              <button
                                onClick={() => handleApprove(user, 'reject')}
                                disabled={actionLoading === user.id + 'reject'}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                              >
                                {actionLoading === user.id + 'reject' ? '...' : 'ปฏิเสธ'}
                              </button>
                            </>
                          )}
                          {user.status === 'rejected' && (
                            <button
                              onClick={() => handleApprove(user, 'approve')}
                              disabled={actionLoading === user.id + 'approve'}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === user.id + 'approve' ? '...' : 'อนุมัติ'}
                            </button>
                          )}
                          {user.status === 'approved' && (
                            <button
                              onClick={() => handleApprove(user, 'reject')}
                              disabled={actionLoading === user.id + 'reject'}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === user.id + 'reject' ? '...' : 'ระงับ'}
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(user)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#eb6f45] hover:bg-[#eb6f45]/10 transition-colors"
                            title="แก้ไข"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteUser(user)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="ลบ"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">สร้างบัญชีผู้ใช้ใหม่</h2>
                <p className="text-xs text-gray-400 mt-0.5">กรอกข้อมูลเพื่อสร้างบัญชี</p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">ชื่อ-นามสกุล <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={createState.name}
                  onChange={e => setCreateState(s => ({ ...s, name: e.target.value }))}
                  placeholder="กรอกชื่อ-นามสกุล"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eb6f45]/40 focus:border-[#eb6f45]"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">อีเมล <span className="text-red-400">*</span></label>
                <input
                  type="email"
                  value={createState.email}
                  onChange={e => setCreateState(s => ({ ...s, email: e.target.value }))}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eb6f45]/40 focus:border-[#eb6f45]"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">รหัสผ่าน <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    value={createState.password}
                    onChange={e => setCreateState(s => ({ ...s, password: e.target.value }))}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eb6f45]/40 focus:border-[#eb6f45]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCreatePassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">บทบาท (Role)</label>
                <select
                  value={createState.role}
                  onChange={e => setCreateState(s => ({ ...s, role: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eb6f45]/40 focus:border-[#eb6f45] bg-white"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="adminsuper">Admin Super</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">สถานะเริ่มต้น</label>
                <select
                  value={createState.status}
                  onChange={e => setCreateState(s => ({ ...s, status: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eb6f45]/40 focus:border-[#eb6f45] bg-white"
                >
                  <option value="approved">อนุมัติทันที</option>
                  <option value="pending">รออนุมัติ</option>
                </select>
              </div>

              {createError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {createError}
                </p>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreateSave}
                disabled={createLoading}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#eb6f45] rounded-xl hover:bg-[#d4613a] disabled:opacity-50 transition-colors"
              >
                {createLoading ? 'กำลังสร้าง...' : 'สร้างบัญชี'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">แก้ไขข้อมูลผู้ใช้</h2>
                <p className="text-xs text-gray-400 mt-0.5">{editUser.name}</p>
              </div>
              <button
                onClick={() => setEditUser(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">อีเมล</label>
                <input
                  type="email"
                  value={editState.email}
                  onChange={e => setEditState(s => ({ ...s, email: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eb6f45]/40 focus:border-[#eb6f45]"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">รหัสผ่านใหม่ <span className="text-gray-400 font-normal">(เว้นว่างถ้าไม่เปลี่ยน)</span></label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={editState.new_password}
                    onChange={e => setEditState(s => ({ ...s, new_password: e.target.value }))}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eb6f45]/40 focus:border-[#eb6f45]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">บทบาท (Role)</label>
                <select
                  value={editState.role}
                  onChange={e => setEditState(s => ({ ...s, role: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eb6f45]/40 focus:border-[#eb6f45] bg-white"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="adminsuper">Admin Super</option>
                </select>
              </div>

              {editError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {editError}
                </p>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setEditUser(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleEditSave}
                disabled={editLoading}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#eb6f45] rounded-xl hover:bg-[#d4613a] disabled:opacity-50 transition-colors"
              >
                {editLoading ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-red-50 rounded-full mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
            </div>
            <h3 className="text-center text-base font-semibold text-gray-900 mb-1">ยืนยันการลบบัญชี</h3>
            <p className="text-center text-sm text-gray-500 mb-6">
              คุณต้องการลบบัญชี <span className="font-medium text-gray-700">{deleteUser.name}</span> ใช่หรือไม่? การดำเนินการนี้ไม่สามารถเรียกคืนได้
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteUser(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? 'กำลังลบ...' : 'ลบบัญชี'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
