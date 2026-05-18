import React from 'react'

const accountSections = [
  {
    title: 'ข้อมูลบัญชีหน่วยงาน',
    description: 'ข้อมูลพื้นฐานสำหรับการใช้งานระบบของหน่วยงาน',
    fields: [
      { label: 'ชื่อหน่วยงาน', value: 'สำนักงานกองทุนสนับสนุนการสร้างเสริมสุขภาพ (สสส.)' },
      { label: 'ประเภทบัญชี', value: 'หน่วยงานภาครัฐ / องค์กรสนับสนุนสุขภาวะ' },
      { label: 'สิทธิ์การใช้งาน', value: 'ผู้ดูแลหน่วยงาน (Agency Admin)' },
      { label: 'สถานะบัญชี', value: 'ใช้งานอยู่' },
    ],
  },
  {
    title: 'ข้อมูลผู้ประสานงานหลัก',
    description: 'รายละเอียดของเจ้าหน้าที่หรือผู้แทนหน่วยงานที่รับผิดชอบบัญชีนี้',
    fields: [
      { label: 'ชื่อ - นามสกุล', value: 'นางสาวตัวอย่าง ผู้ประสานงาน' },
      { label: 'ตำแหน่ง', value: 'นักวิชาการส่งเสริมสุขภาพชำนาญการ' },
      { label: 'สาขา / ฝ่าย', value: 'ฝ่ายพัฒนาองค์ความรู้และนวัตกรรมสุขภาวะ' },
      { label: 'ยศ / คำนำหน้า', value: 'นางสาว' },
      { label: 'เบอร์โทรศัพท์', value: '02-343-1500 ต่อ 245' },
      { label: 'อีเมล', value: 'agency.account@thaihealth.or.th' },
    ],
  },
  {
    title: 'ข้อมูลพื้นที่และสังกัด',
    description: 'รายละเอียดเชิงพื้นที่และข้อมูลประกอบของหน่วยงาน',
    fields: [
      { label: 'จังหวัด', value: 'กรุงเทพมหานคร' },
      { label: 'เขตสุขภาพ', value: 'เขตสุขภาพที่ 13 กรุงเทพมหานคร' },
      { label: 'หน่วยงานต้นสังกัด', value: 'สำนักงานกองทุนสนับสนุนการสร้างเสริมสุขภาพ (สสส.)' },
      { label: 'รหัสหน่วยงาน', value: 'THAIHEALTH-ACC-001' },
      { label: 'ที่อยู่', value: '99/8 ซอยงามดูพลี แขวงทุ่งมหาเมฆ เขตสาทร กรุงเทพมหานคร 10120' },
      { label: 'เว็บไซต์', value: 'www.thaihealth.or.th' },
    ],
  },
]

const permissionItems = [
  'จัดการข้อมูลบัญชีและผู้ใช้งานภายในหน่วยงาน',
  'เข้าถึงคลังเอกสารและฐานข้อมูลองค์ความรู้',
  'สร้างและจัดการรายงานสรุปผล',
  'ใช้งานเครื่องมือ AI สำหรับวิเคราะห์ข้อมูลและเอกสาร',
  'กำหนดสิทธิ์ผู้ใช้งานย่อยภายในระบบ',
]

export default function AccountPage() {
  return (
    <main className="min-h-screen bg-[#fcfbf9] px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-[#f1ddd4] bg-white shadow-sm">
          <div className="relative isolate overflow-hidden px-6 py-8 md:px-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(235,111,69,0.18),_transparent_35%),linear-gradient(135deg,_#fff8f4_0%,_#ffffff_65%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#eb6f45] text-white shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18"></path>
                    <path d="M5 21V7l8-4v18"></path>
                    <path d="M19 21V11l-6-4"></path>
                    <path d="M9 9v.01"></path>
                    <path d="M9 12v.01"></path>
                    <path d="M9 15v.01"></path>
                    <path d="M9 18v.01"></path>
                  </svg>
                </div>

                <div className="space-y-2">
                  <span className="inline-flex rounded-full border border-[#f2d2c3] bg-[#fff3ed] px-3 py-1 text-xs font-semibold tracking-wide text-[#b44f2c]">
                    Agency Account
                  </span>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
                      บัญชีหน่วยงาน สสส.
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 md:text-base">
                      หน้าข้อมูลบัญชีของหน่วยงาน สำนักงานกองทุนสนับสนุนการสร้างเสริมสุขภาพ (สสส.) สำหรับจัดการข้อมูลผู้ประสานงาน สิทธิ์การเข้าถึงระบบ และรายละเอียดหน่วยงานที่ใช้ในระบบงานกลาง
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[360px]">
                <div className="rounded-2xl border border-[#f3e2da] bg-white/90 px-4 py-3 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">สิทธิ์หลัก</p>
                  <p className="mt-1 text-sm font-semibold text-gray-800">Agency Admin</p>
                </div>
                <div className="rounded-2xl border border-[#f3e2da] bg-white/90 px-4 py-3 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">จังหวัด</p>
                  <p className="mt-1 text-sm font-semibold text-gray-800">กรุงเทพมหานคร</p>
                </div>
                <div className="rounded-2xl border border-[#f3e2da] bg-white/90 px-4 py-3 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">สถานะ</p>
                  <p className="mt-1 text-sm font-semibold text-[#b44f2c]">พร้อมใช้งาน</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid grid-cols-1 gap-6">
            {accountSections.map((section) => (
              <article key={section.title} className="rounded-[24px] border border-[#f1e4de] bg-white p-6 shadow-sm md:p-7">
                <div className="mb-5 flex flex-col gap-2 border-b border-[#f4ebe7] pb-4">
                  <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
                  <p className="text-sm text-gray-500">{section.description}</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {section.fields.map((field) => (
                    <div key={field.label} className="rounded-2xl border border-[#f5ece8] bg-[#fffdfa] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{field.label}</p>
                      <p className="mt-2 text-sm font-medium leading-6 text-gray-800">{field.value}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <aside className="flex flex-col gap-6">
            <section className="rounded-[24px] border border-[#f1e4de] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900">สิทธิ์การใช้งาน</h2>
              <p className="mt-2 text-sm text-gray-500">สิทธิ์ที่บัญชีหน่วยงานนี้สามารถดำเนินการได้ภายในระบบ</p>

              <div className="mt-5 space-y-3">
                {permissionItems.map((item) => (
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">นโยบายข้อมูล</p>
                  <p className="mt-2 leading-6">บัญชีนี้ใช้สำหรับการเข้าถึงระบบสารสนเทศภายในและการประสานงานข้อมูลด้านการสร้างเสริมสุขภาพ</p>
                </div>
                <div className="rounded-2xl border border-[#f5ece8] bg-[#fffdfa] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">วันปรับปรุงล่าสุด</p>
                  <p className="mt-2 font-medium text-gray-800">11 พฤษภาคม 2026</p>
                </div>
                <div className="rounded-2xl border border-[#f5ece8] bg-[#fffdfa] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">หมายเหตุ</p>
                  <p className="mt-2 leading-6">สามารถขอเปลี่ยนแปลงข้อมูลหน่วยงาน ตำแหน่ง หรือสิทธิ์การใช้งานเพิ่มเติมผ่านผู้ดูแลระบบกลางได้</p>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}
