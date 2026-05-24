"use client";

import React, { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด');
        return;
      }

      setSent(true);
    } catch {
      setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-lg border border-gray-100">
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center w-20 h-20 bg-[#eb6f45] rounded-full text-white shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"></rect>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
            </svg>
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">ลืมรหัสผ่าน?</h2>
          <p className="mt-2 text-sm text-gray-500 text-center">
            กรุณากรอกอีเมลของคุณ เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้
          </p>
        </div>

        {sent ? (
          <div className="space-y-6">
            <div className="flex items-start gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-4 text-sm text-green-800">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <div>
                <p className="font-semibold">ส่งลิงก์แล้ว</p>
                <p className="mt-1 text-green-700">หากอีเมล <strong>{email}</strong> มีอยู่ในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านเร็ว ๆ นี้</p>
              </div>
            </div>
            <Link
              href="/login"
              className="flex items-center justify-center w-full px-4 py-3 text-white bg-[#eb6f45] rounded-lg hover:bg-[#d8562b] font-bold text-base transition shadow-sm"
            >
              กลับหน้าเข้าสู่ระบบ
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-1.5">
                  อีเมล
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-[#eb6f45] focus:border-[#eb6f45] outline-none transition text-sm"
                  placeholder="example@email.com"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 text-white bg-[#eb6f45] rounded-lg hover:bg-[#d8562b] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#eb6f45] font-bold text-base transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  )}
                  {loading ? 'กำลังส่ง...' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}
                </button>
              </div>
            </form>

            <div className="relative pt-6 border-t border-gray-100">
              <div className="text-center text-sm">
                <span className="text-gray-500 font-medium">
                  กลับไปหน้า{' '}
                  <Link href="/login" className="font-bold text-[#eb6f45] hover:text-[#d8562b] transition">
                    เข้าสู่ระบบ
                  </Link>
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}