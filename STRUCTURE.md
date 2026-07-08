# 🖥️ โครงสร้างโปรเจกต์ — `chatappandpython` (musyav2 — Frontend + BFF)

> เว็บแอป Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 — ทำหน้าที่เป็นทั้ง **หน้าบ้าน (UI)**
> และ **BFF (Backend-for-Frontend)**: มี DB/ตารางของตัวเอง (auth, ประวัติแชท, journal library)
> และ proxy คำขอบางส่วนไปยัง backend Python (`chatapi.python`)
>
> ดูภาพรวมทั้งระบบที่ [`../STRUCTURE.md`](../STRUCTURE.md) — ฝั่ง backend (agents/routers/tools) อยู่ที่ [`../chatapi.python/STRUCTURE.md`](../chatapi.python/STRUCTURE.md) และ [`../chatapi.python/AGENTS.md`](../chatapi.python/AGENTS.md)

---

## 1. ภาพรวม

- **ชื่อแพ็กเกจ**: `musyav2` (package.json) — แอปสำหรับ "AI Analyst — สสส" (กองทุนสนับสนุนการสร้างเสริมสุขภาพ)
- **เฟรมเวิร์ก**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **ไลบรารีสำคัญ**: `pg` (Postgres), `minio` (S3 client), `jsonwebtoken`/`jose`/`bcryptjs` (auth), `pdf-parse`/`pdfjs-dist`/`xlsx` (ประมวลผลไฟล์)
- **ภาษาหลักของ UI**: ภาษาไทย (ใช้ฟอนต์ IBM Plex Sans Thai)
- **เปิดใช้งาน**: `http://localhost:3000`

## 2. ผังโฟลเดอร์

```
chatappandpython/
├── middleware.ts           ← ตรวจ JWT ทุก request, กันหน้า, redirect ไป /login
├── package.json            ← Next.js 16, React 19, Tailwind 4, pg, minio, jose, bcryptjs ฯลฯ
├── docker-compose.yml      ← compose หลัก: frontend + python-ai + postgres + minio + redis
├── docker-compose.hub.yml  ← compose สำหรับดึง image จาก hub (deploy)
├── Dockerfile, .dockerignore, .env.local
├── chatappandpython_postgres_data.tar.gz   ← ไฟล์สำรองข้อมูล Postgres
├── docker, cls, trim_rightpane.js          ← ⚠️ ไฟล์ค้าง/สคริปต์ one-off (ดูข้อสังเกต)
├── app/
│   ├── layout.tsx, page.tsx, ClientLayout.tsx, globals.css   ← root layout + หน้าแรก
│   ├── login/, register/, forgot-password/                  ← หน้าระบบสมาชิก (public)
│   ├── account/                                              ← โปรไฟล์ผู้ใช้
│   ├── approved/                                             ← จัดการผู้ใช้ (เฉพาะ adminsuper)
│   ├── journal/                                              ← คลังรายงาน (Journal Library)
│   ├── fileapa/                                              ← จัดการไฟล์ + APA citation
│   ├── chat/                                                 ← 💬 หน้าแชทหลัก (สองช่อง + stores)
│   ├── musyaend/                                             ← เครื่องมือวิเคราะห์อุบัติเหตุแบบเต็มจอ + DB explorer + Obsidian browser
│   ├── component/                                            ← Sidebar, DatabaseExplorer, chat/* (UI กลาง)
│   └── api/                                                  ← Next.js Route Handlers (อธิบายหัวข้อ 4)
├── lib/                    ← helper modules: auth, db, minio, apa, fileInsights, fileApaMetadata
├── database/               ← SQL init scripts (schema, multi-db, obsidian)
├── docker/                 ← ไฟล์ config สำหรับ Docker (เช่น nginx ฯลฯ)
└── public/                 ← static assets (โลโก้ รูปภาพ ฯลฯ)
```

---

## 3. Layout, Middleware และการป้องกันหน้า

### [`app/layout.tsx`](./app/layout.tsx)
Root layout — โหลดฟอนต์ IBM Plex Sans Thai, ตั้ง metadata "AI Analyst — สสส", ห่อด้วย `ClientLayout`

### [`app/ClientLayout.tsx`](./app/ClientLayout.tsx)
Client-side orchestrator — เรนเดอร์ `Sidebar` + เนื้อหาหลัก + `ChatInput` (เฉพาะหน้าที่ไม่ใช่ auth/fullscreen)
ซ่อน Sidebar/ChatInput ในหน้า: `/musyaend`, หน้า auth, `/fileapa`, `/chat`, `/account`, `/approved`

### [`middleware.ts`](./middleware.ts) — ยามหน้าด่าน (auth gate)
- ตรวจ **JWT** (HS256, lib `jose`) จากคุกกี้ `auth_token`
- **หน้าที่ไม่ต้องล็อกอิน**: `/login`, `/register`, `/forgot-password`, `/reset-password`, static assets
- **หน้าที่ต้องล็อกอิน**: ทุกหน้านอกเหนือจากด้านบน — ไม่งั้น redirect ไป `/login?redirect=[เส้นทางเดิม]`
- **จำกัดสิทธิ์ตาม role**: หน้า `/approved` เปิดได้เฉพาะ role `adminsuper`

---

## 4. หน้าเว็บ (Page Routes ใน `app/`)

| เส้นทาง | ไฟล์ | หน้าที่ |
|---|---|---|
| `/` | [`app/page.tsx`](./app/page.tsx) | หน้าแรก — การ์ดให้ความรู้สุขภาพ (คลายเครียด โภชนาการ ออกกำลังกาย เลิกบุหรี่) ใช้แบรนด์ สสส. |
| `/login` | [`app/login/page.tsx`](./app/login/page.tsx) | ฟอร์มอีเมล+รหัสผ่าน, เรียก `POST /api/auth/login`, จำสถานะ pending/rejected |
| `/register` | [`app/register/page.tsx`](./app/register/page.tsx) | ฟอร์มสมัคร (ชื่อ/อีเมล/รหัสผ่าน/ยืนยันรหัสผ่าน, ตรวจความยาว 8+ ตัวอักษร), เรียก `POST /api/auth/register` |
| `/forgot-password` | [`app/forgot-password/page.tsx`](./app/forgot-password/page.tsx) | ขอลิงก์รีเซ็ตรหัสผ่านทางอีเมล |
| `/account` | [`app/account/page.tsx`](./app/account/page.tsx) | โปรไฟล์ผู้ใช้ (ดู/แก้ชื่อ องค์กร ตำแหน่ง เบอร์โทร จังหวัด เขตสุขภาพ — แก้อีเมล/role/status ไม่ได้) |
| `/approved` | [`app/approved/page.tsx`](./app/approved/page.tsx) | **(adminsuper เท่านั้น)** จัดการผู้ใช้ — แท็บ ทั้งหมด/รออนุมัติ/อนุมัติแล้ว/ปฏิเสธ, อนุมัติ/ปฏิเสธ/แก้ไข/ลบ/สร้างผู้ใช้ใหม่ |
| `/journal` | [`app/journal/page.tsx`](./app/journal/page.tsx) | คลังรายงาน (Policy Brief / Strategy Plan / Work Plan) — ดู/ดาวน์โหลด PDF-Word/ลบ |
| `/fileapa` | [`app/fileapa/page.tsx`](./app/fileapa/page.tsx) | จัดการไฟล์ — ต้นไม้โฟลเดอร์, อัปโหลดแบบลาก-วาง, พรีวิว, สร้าง APA citation (เก็บผ่าน MinIO) |
| `/fileapa/listapa` , `/fileapa/[fileRoute]` | (sub-routes) | ดู/แก้ APA citation ของไฟล์เฉพาะ (`?fileId=...`) |
| `/chat` | [`app/chat/page.tsx`](./app/chat/page.tsx) | 💬 **หน้าแชทหลัก** — เลย์เอาต์ 2 ช่องปรับขนาดได้ (อธิบายละเอียดในหัวข้อ 6) |
| `/chat/sessions/[sessionId]` | [`app/chat/sessions/[sessionId]/page.tsx`](./app/chat/sessions/[sessionId]/page.tsx) | หน้าแชทของ session ที่ระบุ (โครงเดียวกับ `/chat` แต่โหลด state จาก DB ตาม sessionId) |
| `/musyaend` | [`app/musyaend/page.tsx`](./app/musyaend/page.tsx) | 🚗 **(30 KB)** เครื่องมือ "Accident Chat Agent" แบบเต็มจอ — วิเคราะห์อุบัติเหตุเขตสุขภาพที่ 10 พร้อม step pills แสดงสถานะ agent, ปุ่มลัดคำถามสำเร็จรูป, panel แสดง raw output/ข้อจำกัด/รายละเอียดเครื่องมือ |
| `/musyaend/db-explorer` | [`app/musyaend/db-explorer/page.tsx`](./app/musyaend/db-explorer/page.tsx) | สำรวจฐานข้อมูลแบบ read-only — รายชื่อตาราง+จำนวนแถว, ดูคอลัมน์, แบ่งหน้า, ตัวสร้าง WHERE clause — เรียก backend ผ่าน `/api/db/*` (proxy) |
| `/musyaend/obsidian` | [`app/musyaend/obsidian/page.tsx`](./app/musyaend/obsidian/page.tsx) | 🌿 **(55 KB — ใหญ่สุดในโปรเจกต์!)** ตัวค้น/ถามคลังความรู้ Obsidian แบบเต็มรูปแบบ — แท็บ search/ask/status/manage, แสดงผล PDF assets, vault info |

---

## 5. API Routes (`app/api/` — Next.js Route Handlers)

### 🔐 Authentication — `app/api/auth/*`

| Endpoint | Method | หน้าที่ |
|---|---|---|
| `/api/auth/login` | POST | รับ `{email, password}`, ตรวจ bcrypt hash + สถานะบัญชี, ตั้งคุกกี้ `auth_token` (HttpOnly, 7 วัน), คืน `{user}` — 401/403 ถ้ารหัสผิด/บัญชี pending-rejected |
| `/api/auth/register` | POST | รับ `{name, email, password, role?, status?}` (กำหนด role/status เองได้เฉพาะ adminsuper), ค่าเริ่มต้น `role='user'`, `status='pending'`, ตรวจอีเมลซ้ำ + ความยาวรหัสผ่าน — 201/409/403 |
| `/api/auth/users` | GET | **(adminsuper)** รายชื่อผู้ใช้ทั้งหมด กรองด้วย `?status=all\|pending\|approved\|rejected` |
| `/api/auth/users` | PATCH | **(adminsuper)** อนุมัติ/ปฏิเสธ (`{id, action}`) หรือแก้ไขอีเมล/รหัสผ่าน/role (`{id, email?, new_password?, role?}`) |
| `/api/auth/users` | DELETE | **(adminsuper)** ลบผู้ใช้ `{id}` |
| `/api/auth/me` | GET | คืนข้อมูลผู้ใช้ปัจจุบันจาก JWT payload |
| `/api/auth/logout` | POST | ล้างคุกกี้ `auth_token` |
| `/api/auth/forgot-password` | POST | เริ่ม flow รีเซ็ตรหัสผ่านทางอีเมล |
| `/api/auth/reset-password` | POST | รีเซ็ตรหัสผ่านด้วย token |

### 💬 Chat — `app/api/chat/*`

| Endpoint | Method | หน้าที่ |
|---|---|---|
| `/api/chat` | POST | **เส้นทางหลักของแชท** — รับ `{sessionId, prompt, history[], mode?, tools[], attached_files[]?, doc_type?}` แล้ว**ส่งต่อ (proxy)** ไปยัง backend Python ตาม `mode`: `"thaijo"` → `/api/thaijo`, `"thaijo-report"` → `/api/thaijo/report`, `"report"/"database"/"compare"` → endpoint เฉพาะ, ค่าอื่น (`normal/stats/obsidian/multi`) → `/api/analyze` — ส่งกลับเป็น **SSE stream** (`text/event-stream`) |
| `/api/chat/history` | GET | ไม่ระบุ `sessionId` → คืนรายการ session ของผู้ใช้ (สูงสุด 50); ระบุ → คืน state ของ session เดียว (`{state: ChatSessionState}`) — อ่านจากตาราง `chat_sessions` |
| `/api/chat/history` | POST | บันทึก/อัปเดต state ของ session (`{sessionId, state}`) แบบ upsert — คืน 403 ถ้าผู้ใช้ไม่ใช่เจ้าของ session |

### 📁 Files — `app/api/files/*`

| Endpoint | Method | หน้าที่ |
|---|---|---|
| `/api/files/upload` | POST | รับ multipart form (`file`), สร้างรหัสไฟล์ 6 หลัก, ตรวจ MIME type, เก็บไว้ใน temp dir — คืน `{id, name, extension, size, previewKind, uploadedAt}` (`previewKind`: pdf/csv/xlsx/text/unsupported) |
| `/api/files/[fileId]` | GET / DELETE | ดึงเนื้อหาไฟล์จาก MinIO (พร้อม Content-Type ที่ถูกต้อง) / ลบไฟล์ออกจาก MinIO + temp |
| `/api/files/[fileId]/ai-metadata` | GET | สกัด metadata ด้วย AI (ชื่อเรื่อง ผู้แต่ง บทคัดย่อ หน่วยงาน ปี) จาก PDF (`pdf-parse`) หรือ CSV/XLSX (`xlsx`) |
| `/api/files/[fileId]/insights` | GET | สร้างกราฟ/สรุปข้อมูลตารางอัตโนมัติ (หาแนวโน้มตัวเลข ไทม์ไลน์ ค่าสูงสุด) |

### 📝 APA Citation — `app/api/generate-apa`

| Endpoint | Method | หน้าที่ |
|---|---|---|
| `/api/generate-apa` | POST | สกัด metadata จาก PDF/CSV/XLSX แล้วสร้าง citation รูปแบบ APA, เก็บผลลัพธ์ใน MinIO bucket `apa-docs`, คืน `{id, title, author, agency, year, abstract, apa_string}` |

### 📚 Journal Reports — `app/api/journal-reports/*`

| Endpoint | Method | หน้าที่ |
|---|---|---|
| `/api/journal-reports` | GET | รายการรายงานของผู้ใช้ (ไม่รวม `html_content` เพื่อ payload เล็ก) |
| `/api/journal-reports` | POST | บันทึกรายงานใหม่ลงตาราง `journal_reports` — คืน `{id, created_at}` |
| `/api/journal-reports/[id]` | GET / DELETE | ดึงรายงานแบบเต็ม (มี `html_content`) / ลบรายงาน |

### 🐍 Python Proxy — `app/api/python/[prefix]/[...path]`

| รายละเอียด |
|---|
| **prefix ที่อนุญาต**: `accident-chat`, `accident-policy`, `db`, `obsidian` เท่านั้น (อื่น ๆ คืน 404) |
| รับทุก method (GET/POST/PUT/DELETE), ส่งต่อ query params, headers (content-type), body ไปยัง `PYTHON_API_URL/api/[prefix]/[...path]` |
| คืนผลลัพธ์กลับพร้อม status, body, headers ที่เลือก (content-type, cache-control, transfer-encoding) — **คือทางผ่านหลักที่ทำให้ frontend คุยกับ backend Python ได้แบบโปร่งใส** |

### 🔬 ThaiJO Topics — `app/api/thaijo-topics`

| Endpoint | Method | หน้าที่ |
|---|---|---|
| `/api/thaijo-topics` | GET | ดึงรายการหัวข้อ/หมวดหมู่งานวิจัย ThaiJO (proxy ไป backend Python) |

---

## 6. หน้าแชทหลัก (`app/chat/`) — สถาปัตยกรรม UI + State

### โครงหน้าจอ — `page.tsx`
เลย์เอาต์ 2 ช่องที่ปรับขนาดได้ด้วยการลาก (resizer, จำกัดสัดส่วน 20–80%), มีปุ่มย่อ/ขยายแต่ละช่อง:
- **LeftPane** — ประวัติ session, ข้อความปัจจุบัน, สถานะ pipeline AI ที่กำลังสตรีม
- **RightPane** — แสดงผลรายงาน HTML/text, สลับแท็บได้แบบไดนามิก (เปิดอัตโนมัติเมื่อมี custom event `thaijo-text-stream`/`thaijo-html-stream`/`open-journal-report`)

### [`LeftPane.tsx`](./app/chat/LeftPane.tsx) (15 KB)
- subscribe กับ `chatSessionStore` (ข้อความ session) ผ่าน `useSyncExternalStore`, กับ `streamingStore` (ขั้นตอน pipeline สด ๆ), กับ `thaijoStore` (รายงานเสร็จแล้ว)
- ดึงประวัติจาก DB อัตโนมัติเมื่อโหลดครั้งแรก (ผ่าน `/api/chat/history`)
- เลื่อนลงล่างอัตโนมัติเมื่อมีข้อความ/ขั้นตอนใหม่, ปุ่มคัดลอก/แก้ไขคำตอบ AI

### [`RightPane.tsx`](./app/chat/RightPane.tsx) (49 KB — ใหญ่สุดใน `app/chat/`)
- โหมด **HTML**: แสดงรายงาน journal ใน iframe (รับ chunk ที่สตรีมมา)
- โหมด **Text**: แสดงสรุปบทความแบบ typewriter effect, ตัวหนา
- มีปุ่มสร้าง PDF/Word, จัดการ search state, เริ่ม wizard สร้างรายงาน, ปุ่มปิดช่อง
- ⚠️ ไฟล์นี้เคยถูกตัดโค้ดออกด้วย `trim_rightpane.js` (ดูข้อสังเกตท้ายเอกสาร)

### Store ทั้ง 7 ตัว (`app/chat/*Store.ts`) — ใช้ "custom event + listener" แทน Redux/Zustand

| Store | จัดการอะไร | เก็บที่ไหน |
|---|---|---|
| [`chatSessionStore.ts`](./app/chat/chatSessionStore.ts) | ข้อความ+เมตาดาต้าของแต่ละ session — `getChatSessionState`, `saveChatSessionState`, `createChatSessionMessage`, `subscribeToChatSession`, `generateChatSessionId` | `sessionStorage` (client) + ตาราง `chat_sessions` (server ผ่าน `/api/chat/history`) |
| [`streamingStore.ts`](./app/chat/streamingStore.ts) | ขั้นตอน pipeline ที่กำลังสตรีมสด ๆ — `getStreamingSteps`, `setStreamingSteps`, `getPlannedAgents`, `clearStreamingState` | in-memory `Map` |
| [`attachedFilesStore.ts`](./app/chat/attachedFilesStore.ts) | ไฟล์ที่แนบเข้าแชทเพื่อวิเคราะห์ — `attachFile`, `detachFile`, `clearAttachedFiles` | in-memory array |
| [`chatDraftStore.ts`](./app/chat/chatDraftStore.ts) | ข้อความร่างใน ChatInput — `getDraft`, `setDraft`, `clearDraft` | in-memory string |
| [`databaseExplorerStore.ts`](./app/chat/databaseExplorerStore.ts) | เปิด/ปิด panel DatabaseExplorer — `getDatabaseExplorerOpen`, `toggleDatabaseExplorer` | in-memory boolean |
| [`thaijoStore.ts`](./app/chat/thaijoStore.ts) | สถานะรายงาน ThaiJO (สตรีม HTML/text, ค้นหา, wizard) — `getThaijoReport`, `startThaijoHtmlStream`, `appendThaijoHtmlChunk`, `openWizardDirect` | in-memory object + custom events (`thaijo-report-updated`, `thaijo-html-stream`, `thaijo-wizard-event` ฯลฯ) |
| [`chatTypes.ts`](./app/chat/chatTypes.ts) | type definitions กลาง — `ChatMessageRole`, `AgentStepStatus`, `ChatSessionMessage`, `ChatSessionState` | (ไม่ใช่ store แต่เป็น shared types) |

> 💡 **ทำไมไม่ใช้ Redux/Zustand?** โค้ดเลือกใช้ `CustomEvent` + listener pattern (เบา ไม่เพิ่ม dependency, ใช้ `useSyncExternalStore` ของ React ให้ปลอดภัยกับ SSR) — ดูหัวข้อ "ข้อสังเกต" สำหรับข้อเสนอแนะเพิ่มเติม

### โฟลเดอร์ย่อยใน `app/chat/`
- **`journal-template/`** — เทมเพลตสร้างเอกสาร: [`buildJournalHtml.ts`](./app/chat/journal-template/buildJournalHtml.ts) (ประกอบ HTML), [`journalHtmlStyles.ts`](./app/chat/journal-template/journalHtmlStyles.ts) / [`journalDocxStyles.ts`](./app/chat/journal-template/journalDocxStyles.ts) (สไตล์สำหรับ HTML/Word)
- **`sessions/[sessionId]/`** — dynamic route หน้าแชทของ session เฉพาะ (ใช้โครง LeftPane/RightPane เดียวกับหน้าแม่)

---

## 7. Components กลาง (`app/component/`)

| ไฟล์ | หน้าที่ |
|---|---|
| [`Sidebar.tsx`](./app/component/Sidebar.tsx) (30 KB) | เมนูซ้าย — Journal Library, แชทใหม่, ค้นหา, รายการแชทแบ่งตามวันที่ (ยุบ/ขยายได้), ปุ่มเปิด DatabaseExplorer, เมนูโปรไฟล์ผู้ใช้+ออกจากระบบ — ดึงประวัติจาก `/api/chat/history`, ล้าง draft/attached/streaming เมื่อเริ่มแชทใหม่ |
| [`DatabaseExplorer.tsx`](./app/component/DatabaseExplorer.tsx) | Modal แสดงไฟล์ที่อัปโหลดไว้ใน MinIO — ค้นหาตามชื่อ/path, แนบ/ถอดไฟล์เพื่อใช้ในแชท, ป้ายบอกประเภทไฟล์ (CSV/XLSX/PDF), ปุ่มรีเฟรช |
| [`chat/ChatInput.tsx`](./app/component/chat/ChatInput.tsx) (39 KB — **ไฟล์ใหญ่สุดในโปรเจกต์ส่วน UI**) | ช่องพิมพ์แชทแบบ multi-tool — เลือกเครื่องมือ (`report`/`stats`/`tavily`/`database`/`thaijo`/`obsidian`), อัปโหลดไฟล์/รูปภาพ, ขยายอัตโนมัติ — เมื่อกดส่ง: `POST /api/chat` พร้อม `{sessionId, prompt, history, mode, tools, attached_files}` แล้วฟัง SSE event อัปเดต store ต่าง ๆ |
| [`chat/MarkdownContent.tsx`](./app/component/chat/MarkdownContent.tsx) (18.7 KB) | เรนเดอร์ markdown แบบกำหนดเอง — ลิงก์/โค้ด/ตัวหนา/ตัวเอียง/ขีดทับ/URL เปล่า, สร้างกราฟแท่งจากตารางข้อมูลอัตโนมัติ (`renderInline`, `LineWithBold`) |
| [`chat/AgentPipelinePanel.tsx`](./app/component/chat/AgentPipelinePanel.tsx) (4.2 KB) | Panel แสดงขั้นตอน agent ที่กำลังทำงานสด ๆ — ชื่อ agent, สถานะ (pending/running/done) พร้อม spinner, ขยายดูรายละเอียด (ความคิด/ผลลัพธ์/โค้ดที่สร้าง) |

---

## 8. Library Helpers (`lib/`)

| ไฟล์ | export หลัก | ใช้ที่ไหน |
|---|---|---|
| [`auth.ts`](./lib/auth.ts) | `hashPassword`/`verifyPassword` (bcryptjs cost 12), `signToken`/`verifyToken` (JWT HS256, 7 วัน), `COOKIE_NAME='auth_token'` | ทุก endpoint ใน `/api/auth/*` และ `middleware.ts` |
| [`db.ts`](./lib/db.ts) | Connection pool ของ `pg` (อ่าน `DATABASE_URL`, SSL ตาม `DATABASE_SSL`) — singleton | ทุก API route ที่คุยกับ Postgres |
| [`minio.ts`](./lib/minio.ts) | MinIO client + `ensureBucket`/`ensureApaBucket` (bucket `fileapa` และ `apa-docs`) | `/api/files/*`, `/api/generate-apa`, `DatabaseExplorer` |
| [`apa.ts`](./lib/apa.ts) | `extractYear`, `detectAgency`, `detectAuthor`, `buildApaString`, `canGenerateApa` — ใช้ `pdf-parse` (lazy-load) และ `xlsx` สกัด metadata | `/api/generate-apa`, `/api/files/[fileId]/ai-metadata` |
| [`fileInsights.ts`](./lib/fileInsights.ts) | `buildChartsFromRows`, `isLikelyTimeline`, `buildChartInsight`, `buildRowsPreview` — วิเคราะห์ข้อมูลตารางสร้างกราฟ/สรุป | `/api/files/[fileId]/insights` |
| [`fileApaMetadata.ts`](./lib/fileApaMetadata.ts) | จัดการ metadata ของ APA citation ที่เก็บไว้ | หน้า `/fileapa/*`, `/api/generate-apa` |

---

## 9. ฐานข้อมูล (`database/`)

### [`schema.sql`](./database/schema.sql) — ตารางหลักของฝั่ง frontend (DB `musyadata`)

| ตาราง | คอลัมน์สำคัญ | หมายเหตุ |
|---|---|---|
| **`accounts`** | `id` (UUID), `name`, `email` (UNIQUE), `password_hash`, `role` (user/admin/adminsuper), `status` (pending/approved/rejected), ฟิลด์โปรไฟล์ (organization, position, phone, province, health_zone ฯลฯ), `reset_token`/`reset_token_expires`, `approved_by`/`approved_at`, `created_at`/`updated_at` | มี index บน `email`, `status`, `reset_token`; trigger auto-update `updated_at` |
| **`chat_sessions`** | `id` (UUID PK), `session_id` (TEXT UNIQUE), `user_id` (FK → accounts), `status`, `last_user_prompt`, `messages_json` (JSONB) | index บน `user_id`, `updated_at DESC` |
| **`journal_reports`** | `id` (UUID PK), `user_id` (FK → accounts CASCADE), `title`, `query`, `doc_type` (policy/plan/workplan), `article_count`, `topic_plan`, `html_content` | index บน `user_id`, `created_at DESC` |

**ผู้ใช้ทดสอบที่ seed มาในสคริปต์:**
- Admin: `musya@gmail.com` / `123456musya`
- Adminsuper: `supermusya@gmail.com` / `123456musya`
- ผู้ใช้ทดสอบ: `musya01@gmail.com` ถึง `musya32@gmail.com` (รหัสผ่านรูปแบบ `1234musya01` ฯลฯ)

> ⚠️ **อย่าลืม**: ถ้านำไปใช้งานจริง ควรเปลี่ยนรหัสผ่าน seed users เหล่านี้ทันที (ข้อมูลนี้อยู่ในไฟล์ schema ที่ commit ไว้ใน repo)

### ไฟล์อื่น ๆ ใน `database/`
- [`init-multiple-dbs.sh`](./database/init-multiple-dbs.sh) — สคริปต์สร้างหลาย database ตอน container เริ่มทำงาน
- [`init-musya.sql`](./database/init-musya.sql) — init เฉพาะ DB `musya`
- [`init-obsidian.sql`](./database/init-obsidian.sql) — สร้างตาราง `obsidian_*` (ใช้ฝั่ง backend Python ด้วย — mount ผ่าน docker-compose เป็น `25_obsidian.sql`)

---

## 10. Auth Flow (ภาพรวม)

```
1. ผู้ใช้กรอกฟอร์มที่ /login → POST /api/auth/login {email, password}
2. route handler:
   - ค้นหา account จาก email
   - ตรวจสถานะบัญชี (pending/rejected → ปฏิเสธด้วย 403)
   - verifyPassword(password, password_hash)  [lib/auth.ts, bcryptjs]
   - signToken({userId, email, role, name})   [JWT HS256, อายุ 7 วัน]
   - ตั้งคุกกี้ auth_token (HttpOnly, sameSite=lax)
3. ทุก request ถัดไป → middleware.ts:
   - อ่านคุกกี้ auth_token, verifyToken() ด้วย jose
   - ถ้าไม่ผ่าน/ไม่มี → redirect ไป /login?redirect=[เดิม]
   - ถ้าเข้าหน้า /approved แต่ role ≠ adminsuper → ปฏิเสธ
4. component ฝั่ง client เรียก GET /api/auth/me เพื่อรู้ข้อมูลผู้ใช้ปัจจุบัน
5. ออกจากระบบ → POST /api/auth/logout → ล้างคุกกี้
```

**ไม่มีการเก็บ token ฝั่ง client** (ไม่ใช้ localStorage) — ใช้ HttpOnly cookie ล้วน ๆ ปลอดภัยจาก XSS อ่าน token โดยตรง

---

## 11. การไหลของข้อมูล — ตัวอย่างที่ใช้บ่อย

### ตัวอย่างที่ 1: ส่งข้อความแชทแล้วได้คำตอบ AI

```
ผู้ใช้พิมพ์ "สถิติโรคหัวใจ" + เลือกเครื่องมือ "stats" ใน ChatInput
   ↓
ChatInput: POST /api/chat
   { sessionId, prompt: "สถิติโรคหัวใจ", mode: "stats", tools: ["stats"], attached_files: [...] }
   ↓
app/api/chat/route.ts:
   - ดู mode="stats" → ส่งต่อไปยัง PYTHON_API_URL/api/analyze
   - ส่ง history + ข้อมูลที่จำเป็นไปด้วย
   - รับ SSE stream กลับจาก backend Python แล้วส่งต่อเป็น text/event-stream
   ↓
เบราว์เซอร์รับ SSE stream:
   - ChatInput ฟัง custom events: streaming-state-updated, thaijo-text-stream ฯลฯ
   - อัปเดต streamingStore (ขั้นตอน agent), chatSessionStore (ข้อความ)
   ↓
UI re-render ผ่าน useSyncExternalStore:
   - LeftPane: แสดง pipeline สด ๆ + ข้อความ
   - RightPane: แสดงผลลัพธ์ text/HTML
   - AgentPipelinePanel: แสดงสถานะแต่ละ agent
   ↓
เมื่อเสร็จ: POST /api/chat/history บันทึกลง chat_sessions → ปรากฏใน Sidebar
```

### ตัวอย่างที่ 2: อัปโหลดไฟล์แล้วใช้วิเคราะห์

```
DatabaseExplorer → เลือกไฟล์ → POST /api/files/upload (FormData)
   ↓
app/api/files/upload: สร้างรหัสไฟล์ 6 หลัก, เก็บใน temp dir, คืน {id, name, extension, previewKind}
   ↓
attachFile({id, name, extension}) → อัปเดต attachedFilesStore → badge ไฟล์ปรากฏใน ChatInput
   ↓
ผู้ใช้พิมพ์คำถาม + กดส่ง → attached_files ถูกแนบไปกับ POST /api/chat
   ↓
backend Python อ่านไฟล์ (ผ่าน id/path), วิเคราะห์, ส่งผลลัพธ์กลับ
   ↓
แสดงสรุป + กราฟใน RightPane
```

---

## 12. รูปแบบสถาปัตยกรรมที่ใช้ (Patterns ที่ควรรู้ก่อนแก้โค้ด)

| เรื่อง | แนวทางที่ใช้ | เหตุผล (ที่อนุมานจากโค้ด) |
|---|---|---|
| **State management** | Custom event store (`CustomEvent` + listener) แทน Redux/Zustand, ใช้ `useSyncExternalStore` ของ React | เบา ไม่เพิ่ม dependency, ปลอดภัยกับ SSR |
| **Streaming คำตอบ AI** | Server-Sent Events (SSE) ทางเดียว ไม่ใช้ WebSocket | งานนี้เป็น "server พูด client ฟัง" ทางเดียวเป็นหลัก SSE จึงง่ายกว่า |
| **เก็บไฟล์** | สองระบบคู่กัน: ไฟล์แนบแชท → temp dir local (ชั่วคราว); MinIO → citation/รายงาน (ถาวร) | แยกของชั่วคราว/ถาวรออกจากกันชัดเจน |
| **Auth** | JWT ใน HttpOnly cookie, ตรวจที่ `middleware.ts` ทุก request, ไม่เก็บ token ฝั่ง client เลย | ป้องกัน XSS อ่าน token, รวม logic ตรวจสอบไว้จุดเดียว |
| **Database** | Postgres เป็น source of truth เดียว, เก็บข้อความแชทเป็น JSONB (ยืดหยุ่นเปลี่ยน schema ได้ง่าย) | รองรับโครงสร้างข้อความที่ซับซ้อน/เปลี่ยนบ่อยจาก AI |

---

## 13. ตัวแปรแวดล้อมที่ต้องตั้งค่า

```bash
# Auth
JWT_SECRET=<ความลับยาว ๆ สุ่ม ๆ>
NODE_ENV=production|development

# Database
DATABASE_URL=postgresql://postgres:1234@postgres:5432/musyadata
DATABASE_SSL=true|false

# Python Backend
PYTHON_API_URL=http://python-ai:8000      # ใน container — นอก container ใช้ http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000

# MinIO
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=fileapa
MINIO_APA_BUCKET=apa-docs

# อื่น ๆ
NEXT_PUBLIC_APP_URL=http://localhost:3000
CHAT_UPLOAD_TMP_DIR=...                    # โฟลเดอร์ temp สำหรับไฟล์แนบแชท
```

> ตัวแปรจริงอยู่ใน `.env.local` (ไม่ commit เข้า git) — ดูตัวอย่างค่าที่ใช้ตอน build/deploy ได้จาก `docker-compose.yml`

---

## 14. ข้อสังเกต / สิ่งที่อาจอยากปรับปรุง

1. **ไฟล์ค้างที่ root** — `docker` และ `cls` เป็นไฟล์ขนาด **0 ไบต์** (ดูเหมือนเกิดจากพิมพ์คำสั่งแล้ว shell redirect ผิดเป็นไฟล์ เช่น `docker ... > docker`) — ลบได้เลย
2. **`trim_rightpane.js`** — สคริปต์ one-off ที่ใช้ตัดโค้ดส่วน line 6-358 ออกจาก `RightPane.tsx` ไปแล้ว (เห็นจากโค้ดในไฟล์: `kept = [...lines.slice(0,5), ...lines.slice(358)]`) — งานเสร็จแล้ว ไม่จำเป็นต้องเก็บสคริปต์นี้ไว้ต่อ
3. **ชื่อไม่ตรงกัน**: โฟลเดอร์หน้าเว็บ `app/fileapa/` ตั้งชื่อคนละแบบกับ API `app/api/files/` — ทำให้ค้นหา/อ้างอิงสับสนได้ (อาจรวมเป็นชื่อเดียวกันในอนาคต)
4. **`ChatInput.tsx` ขนาดใหญ่ (39 KB)** — รวมหลายหน้าที่ไว้ในไฟล์เดียว (เลือกเครื่องมือ, อัปโหลดไฟล์, จัดการข้อความ, ฟัง SSE) — ถ้าจะแก้ไขบ่อย ๆ น่าจะแยกเป็น sub-component ย่อย เช่น `ToolSelector`, `FileUploadZone`, `MessageComposer`
5. **`musyaend/page.tsx` (30 KB) และ `musyaend/obsidian/page.tsx` (55 KB — ใหญ่สุดในโปรเจกต์)** — เป็นหน้าเฉพาะทางที่ค่อนข้างก้อนใหญ่ก้อนเดียว อาจพิจารณาแยกส่วนแสดงผล/ลอจิกออกจากกันถ้าจะขยายฟีเจอร์ต่อ
6. **`chatappandpython_postgres_data.tar.gz`** — ไฟล์ backup ฐานข้อมูลถูก commit ไว้ใน repo — ควรพิจารณาว่าจำเป็นต้องเก็บไว้ใน git หรือย้ายไปเก็บที่อื่น (มักทำให้ repo บวมและมีความเสี่ยงเรื่องข้อมูล/รหัสผ่านหลุด)
7. **รหัสผ่าน seed users อยู่ใน `schema.sql`** — เช่น `musya@gmail.com` / `123456musya` ถูก commit ไว้ใน repo ตรง ๆ — ถ้าจะ deploy จริงต้องเปลี่ยนรหัสผ่านเหล่านี้ก่อน

---

*สร้างจากการอ่านซอร์สโค้ดจริง 2026-06-08 — หากแก้โค้ดภายหลัง ให้ตรวจสอบความถูกต้องกับโค้ดจริงเสมอ*
