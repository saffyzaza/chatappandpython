'use client';

import React, { useEffect, useState } from 'react';

interface AccountUser {
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
  health_zone?: string;
  parent_organization?: string;
  org_code?: string;
  address?: string;
  website?: string;
  approved_at?: string;
  created_at: string;
}

type FormData = Omit<AccountUser, 'id' | 'email' | 'role' | 'status' | 'approved_at' | 'created_at'>;

const ROLE_LABELS: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ (Admin)',
  user: 'ผู้ใช้งาน (User)',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  approved: { label: 'อนุมัติแล้ว', color: 'text-green-700 bg-green-50 border-green-200' },
  pending: { label: 'รอการอนุมัติ', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  rejected: { label: 'ถูกปฏิเสธ', color: 'text-red-700 bg-red-50 border-red-200' },
};

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-7 8a7 7 0 0 1 14 0H5z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-[#f5ece8] bg-[#fffdfa] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-gray-800">
        {value || <span className="italic text-gray-400">ไม่ได้ระบุ</span>}
      </p>
    </div>
  );
}

function EditField({
  label, name, value, onChange, type = 'text',
}: {
  label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="rounded-xl border border-[#e8d8d0] bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[#eb6f45] focus:ring-2 focus:ring-[#eb6f45]/20"
      />
    </div>
  );
}

function Toast({ msg, onClose }: { msg: { type: 'success' | 'error'; text: string }; onClose: () => void }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-lg text-sm font-medium
      ${msg.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
      <span>{msg.type === 'success' ? '✓' : '✕'} {msg.text}</span>
      <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600">✕</button>
    </div>
  );
}

export default function AccountPage() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormData>({ name: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        const u = d.user ?? null;
        setUser(u);
        if (u) initForm(u);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  function initForm(u: AccountUser) {
    setForm({
      name: u.name ?? '',
      prefix: u.prefix ?? '',
      phone: u.phone ?? '',
      organization: u.organization ?? '',
      position: u.position ?? '',
      department: u.department ?? '',
      province: u.province ?? '',
      health_zone: u.health_zone ?? '',
      parent_organization: u.parent_organization ?? '',
      org_code: u.org_code ?? '',
      address: u.address ?? '',
      website: u.website ?? '',
    });
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleCancel() {
    if (user) initForm(user);
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
      setUser((prev) => prev ? { ...prev, ...form } as AccountUser : prev);
      setEditing(false);
      setToast({ type: 'success', text: 'บันทึกข้อมูลสำเร็จ' });
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) {
      setToast({ type: 'error', text: 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน' });
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
      setPwForm({ current: '', newPw: '', confirm: '' });
      setToast({ type: 'success', text: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' });
    } finally {
      setPwSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fcfbf9]">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">กำลังโหลดข้อมูล...</span>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fcfbf9]">
        <p className="text-sm text-gray-500">ไม่พบข้อมูลบัญชีผู้ใช้</p>
      </main>
    );
  }

  const statusInfo = STATUS_LABELS[user.status] ?? { label: user.status, color: 'text-gray-700 bg-gray-50 border-gray-200' };
  const joinDate = new Date(user.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const approvedDate = user.approved_at
    ? new Date(user.approved_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <main className="min-h-screen bg-[#fcfbf9] px-4 py-6 md:px-6 lg:px-8">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">

        {/* Header */}
        <section className="overflow-hidden rounded-[28px] border border-[#f1ddd4] bg-white shadow-sm">
          <div className="relative isolate overflow-hidden px-6 py-8 md:px-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(235,111,69,0.18),_transparent_35%),linear-gradient(135deg,_#fff8f4_0%,_#ffffff_65%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#eb6f45] text-white shadow-sm">
                  <UserIcon />
                </div>
                <div className="space-y-2">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">{user.name}</h1>
                    <p className="mt-1 text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 lg:items-end">
                <div className="grid grid-cols-3 gap-3 lg:min-w-[360px]">
                  <div className="rounded-2xl border border-[#f3e2da] bg-white/90 px-4 py-3 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">สิทธิ์</p>
                    <p className="mt-1 text-sm font-semibold text-gray-800">{ROLE_LABELS[user.role] ?? user.role}</p>
                  </div>
                  <div className="rounded-2xl border border-[#f3e2da] bg-white/90 px-4 py-3 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">จังหวัด</p>
                    <p className="mt-1 text-sm font-semibold text-gray-800">{user.province || '—'}</p>
                  </div>
                  <div className="rounded-2xl border border-[#f3e2da] bg-white/90 px-4 py-3 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">สถานะ</p>
                    <p className={`mt-1 text-sm font-semibold ${user.status === 'approved' ? 'text-green-700' : user.status === 'pending' ? 'text-yellow-700' : 'text-red-700'}`}>
                      {statusInfo.label}
                    </p>
                  </div>
                </div>

                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-2 rounded-xl bg-[#eb6f45] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d4623c]"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    แก้ไขโปรไฟล์
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-xl bg-[#eb6f45] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d4623c] disabled:opacity-60"
                    >
                      {saving && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                      บันทึก
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid grid-cols-1 gap-6">

            {/* ข้อมูลบัญชี */}
            <article className="rounded-[24px] border border-[#f1e4de] bg-white p-6 shadow-sm md:p-7">
              <div className="mb-5 flex flex-col gap-2 border-b border-[#f4ebe7] pb-4">
                <h2 className="text-lg font-bold text-gray-900">ข้อมูลบัญชี</h2>
                <p className="text-sm text-gray-500">ข้อมูลพื้นฐานของบัญชีผู้ใช้งาน</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {editing ? (
                  <>
                    <EditField label="ชื่อ - นามสกุล" name="name" value={form.name ?? ''} onChange={handleFormChange} />
                    <EditField label="คำนำหน้า" name="prefix" value={form.prefix ?? ''} onChange={handleFormChange} />
                    <div className="rounded-2xl border border-[#f5ece8] bg-[#f9f9f9] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">อีเมล</p>
                      <p className="mt-2 text-sm text-gray-400">{user.email}</p>
                    </div>
                    <EditField label="เบอร์โทรศัพท์" name="phone" value={form.phone ?? ''} onChange={handleFormChange} />
                    <Field label="สิทธิ์การใช้งาน" value={ROLE_LABELS[user.role] ?? user.role} />
                    <Field label="สถานะบัญชี" value={statusInfo.label} />
                  </>
                ) : (
                  <>
                    <Field label="ชื่อ - นามสกุล" value={user.name} />
                    <Field label="คำนำหน้า" value={user.prefix} />
                    <Field label="อีเมล" value={user.email} />
                    <Field label="เบอร์โทรศัพท์" value={user.phone} />
                    <Field label="สิทธิ์การใช้งาน" value={ROLE_LABELS[user.role] ?? user.role} />
                    <Field label="สถานะบัญชี" value={statusInfo.label} />
                  </>
                )}
              </div>
            </article>

            {/* ข้อมูลหน่วยงาน */}
            <article className="rounded-[24px] border border-[#f1e4de] bg-white p-6 shadow-sm md:p-7">
              <div className="mb-5 flex flex-col gap-2 border-b border-[#f4ebe7] pb-4">
                <h2 className="text-lg font-bold text-gray-900">ข้อมูลหน่วยงาน</h2>
                <p className="text-sm text-gray-500">รายละเอียดหน่วยงานและตำแหน่ง</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {editing ? (
                  <>
                    <EditField label="ชื่อหน่วยงาน" name="organization" value={form.organization ?? ''} onChange={handleFormChange} />
                    <EditField label="ตำแหน่ง" name="position" value={form.position ?? ''} onChange={handleFormChange} />
                    <EditField label="สาขา / ฝ่าย" name="department" value={form.department ?? ''} onChange={handleFormChange} />
                    <EditField label="หน่วยงานต้นสังกัด" name="parent_organization" value={form.parent_organization ?? ''} onChange={handleFormChange} />
                    <EditField label="รหัสหน่วยงาน" name="org_code" value={form.org_code ?? ''} onChange={handleFormChange} />
                    <EditField label="เว็บไซต์" name="website" value={form.website ?? ''} onChange={handleFormChange} />
                  </>
                ) : (
                  <>
                    <Field label="ชื่อหน่วยงาน" value={user.organization} />
                    <Field label="ตำแหน่ง" value={user.position} />
                    <Field label="สาขา / ฝ่าย" value={user.department} />
                    <Field label="หน่วยงานต้นสังกัด" value={user.parent_organization} />
                    <Field label="รหัสหน่วยงาน" value={user.org_code} />
                    <Field label="เว็บไซต์" value={user.website} />
                  </>
                )}
              </div>
            </article>

            {/* ข้อมูลพื้นที่ */}
            <article className="rounded-[24px] border border-[#f1e4de] bg-white p-6 shadow-sm md:p-7">
              <div className="mb-5 flex flex-col gap-2 border-b border-[#f4ebe7] pb-4">
                <h2 className="text-lg font-bold text-gray-900">ข้อมูลพื้นที่</h2>
                <p className="text-sm text-gray-500">จังหวัดและเขตสุขภาพที่สังกัด</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {editing ? (
                  <>
                    <EditField label="จังหวัด" name="province" value={form.province ?? ''} onChange={handleFormChange} />
                    <EditField label="เขตสุขภาพ" name="health_zone" value={form.health_zone ?? ''} onChange={handleFormChange} />
                    <div className="md:col-span-2">
                      <EditField label="ที่อยู่" name="address" value={form.address ?? ''} onChange={handleFormChange} />
                    </div>
                  </>
                ) : (
                  <>
                    <Field label="จังหวัด" value={user.province} />
                    <Field label="เขตสุขภาพ" value={user.health_zone} />
                    <div className="md:col-span-2">
                      <Field label="ที่อยู่" value={user.address} />
                    </div>
                  </>
                )}
              </div>
            </article>

            {/* เปลี่ยนรหัสผ่าน */}
            <article className="rounded-[24px] border border-[#f1e4de] bg-white p-6 shadow-sm md:p-7">
              <div className="mb-5 flex flex-col gap-2 border-b border-[#f4ebe7] pb-4">
                <h2 className="text-lg font-bold text-gray-900">เปลี่ยนรหัสผ่าน</h2>
                <p className="text-sm text-gray-500">กรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่</p>
              </div>
              <form onSubmit={handleChangePassword} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {(
                  [
                    { label: 'รหัสผ่านปัจจุบัน', key: 'current' as const },
                    { label: 'รหัสผ่านใหม่', key: 'newPw' as const },
                    { label: 'ยืนยันรหัสผ่านใหม่', key: 'confirm' as const },
                  ] as const
                ).map(({ label, key }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</label>
                    <div className="relative">
                      <input
                        type={showPw[key] ? 'text' : 'password'}
                        value={pwForm[key]}
                        onChange={(e) => setPwForm((p) => ({ ...p, [key]: e.target.value }))}
                        required
                        className="w-full rounded-xl border border-[#e8d8d0] bg-white py-2 pl-3 pr-10 text-sm text-gray-800 outline-none transition focus:border-[#eb6f45] focus:ring-2 focus:ring-[#eb6f45]/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((p) => ({ ...p, [key]: !p[key] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPw[key] ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>
                ))}
                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={pwSaving}
                    className="flex items-center gap-2 rounded-xl bg-[#eb6f45] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d4623c] disabled:opacity-60"
                  >
                    {pwSaving && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                    บันทึกรหัสผ่านใหม่
                  </button>
                </div>
              </form>
            </article>

          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-6">
            <section className="rounded-[24px] border border-[#f1e4de] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900">สิทธิ์การใช้งาน</h2>
              <p className="mt-2 text-sm text-gray-500">สิทธิ์ที่บัญชีนี้สามารถดำเนินการได้ภายในระบบ</p>
              <div className="mt-5 space-y-3">
                {[
                  'เข้าถึงระบบ AI วิเคราะห์ข้อมูล',
                  'อัปโหลดและจัดการเอกสาร',
                  'สร้างและดูรายงาน',
                  ...(user.role === 'admin' ? ['จัดการบัญชีผู้ใช้งาน', 'อนุมัติ/ปฏิเสธบัญชีใหม่'] : []),
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl bg-[#fff6f1] px-4 py-3">
                    <span className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-[#eb6f45]" />
                    <p className="text-sm leading-6 text-gray-700">{item}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-[#f1e4de] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900">ข้อมูลเพิ่มเติม</h2>
              <div className="mt-4 space-y-4 text-sm text-gray-600">
                <div className="rounded-2xl border border-[#f5ece8] bg-[#fffdfa] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">วันที่สมัคร</p>
                  <p className="mt-2 font-medium text-gray-800">{joinDate}</p>
                </div>
                {approvedDate && (
                  <div className="rounded-2xl border border-[#f5ece8] bg-[#fffdfa] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">วันที่อนุมัติ</p>
                    <p className="mt-2 font-medium text-gray-800">{approvedDate}</p>
                  </div>
                )}
                <div className="rounded-2xl border border-[#f5ece8] bg-[#fffdfa] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">หมายเหตุ</p>
                  <p className="mt-2 leading-6">สามารถขอเปลี่ยนแปลงสิทธิ์การใช้งานผ่านผู้ดูแลระบบได้</p>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
