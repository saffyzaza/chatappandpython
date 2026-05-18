"use client";

import React from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-lg border border-gray-100">
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center w-20 h-20 bg-[#eb6f45] rounded-full text-white shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">ลืมรหัสผ่าน?</h2>
          <p className="mt-2 text-sm text-gray-500 text-center">
            กรุณากรอกอีเมลของคุณ เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้
          </p>
        </div>

        <form className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-1.5">
              อีเมล
            </label>
            <div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-[#eb6f45] focus:border-[#eb6f45] outline-none transition text-sm"
                placeholder="example@email.com"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full px-4 py-3 text-white bg-[#eb6f45] rounded-lg hover:bg-[#d8562b] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#eb6f45] font-bold text-base transition shadow-sm"
            >
              ส่งลิงก์ตั้งรหัสผ่านใหม่
            </button>
          </div>
        </form>

        <div className="relative mt-8 pt-6 border-t border-gray-100">
          <div className="text-center text-sm">
            <span className="text-gray-500 font-medium">
              กลับไปหน้า{' '}
              <Link href="/login" className="font-bold text-[#eb6f45] hover:text-[#d8562b] transition">
                เข้าสู่ระบบ
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}