📂 1-fayl: Prisma schema yangilash
Fayl: prisma/schema.prisma
Qilish: Mavjud model blokchalari oxiriga (faylning oxiriga) shu blokni qo'shing:   model BotState {
  telegramId String   @id
  step       String
  data       Json     @default("{}")
  expiresAt  DateTime @default(dbgenerated("(now() + interval '30 minutes')")) @db.Timestamp(6)
  createdAt  DateTime @default(now()) @db.Timestamp(6)
  updatedAt  DateTime @default(now()) @db.Timestamp(6)

  @@index([expiresAt])
  @@map("bot_states")
}
Keyin terminalda:
npx prisma db pull
npx prisma generate
⚠️ db pull orqali Prisma schema'ni DB bilan to'liq sinxronlashtiradi (ikkala migratsiya ham bizniki, konflikt yo'q).
📂 2-fayl: Yangi helper yaratish
Fayl: bot/state/dbState.ts (yangi fayl yarating)
To'liq mazmun:
// bot/state/dbState.ts
// DB-backed bot state — Vercel serverless cold start'larga bardoshli

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface BotState {
  step: string;
  data: Record<string, any>;
}

/**
 * State olish. Agar yo'q yoki muddati o'tgan bo'lsa — null qaytaradi.
 */
export async function getState(telegramId: string): Promise<BotState | null> {
  const tgId = String(telegramId);
  
  const row = await prisma.botState.findUnique({
    where: { telegramId: tgId },
  });
  
  if (!row) return null;
  
  // Muddati o'tgan bo'lsa — o'chiramiz va null qaytaramiz
  if (row.expiresAt < new Date()) {
    await prisma.botState.delete({ where: { telegramId: tgId } }).catch(() => {});
    return null;
  }
  
  return {
    step: row.step,
    data: row.data as Record<string, any>,
  };
}

/**
 * State saqlash (yangi yoki yangilash). expiresAt avtomatik 30 daqiqaga uzaytiriladi.
 */
export async function setState(
  telegramId: string,
  step: string,
  data: Record<string, any> = {}
): Promise<void> {
  const tgId = String(telegramId);
  
  await prisma.botState.upsert({
    where: { telegramId: tgId },
    create: {
      telegramId: tgId,
      step,
      data: data as any,
    },
    update: {
      step,
      data: data as any,
      // updatedAt va expiresAt DB trigger orqali avtomatik yangilanadi
    },
  });
}

/**
 * State data'sini birga saqlash (mavjud data ustiga qo'shadi).
 */
export async function patchState(
  telegramId: string,
  patch: Record<string, any>
): Promise<void> {
  const current = await getState(telegramId);
  if (!current) {
    // State yo'q bo'lsa, yangi yaratamiz step = 'unknown' bilan
    await setState(telegramId, 'unknown', patch);
    return;
  }
  await setState(telegramId, current.step, { ...current.data, ...patch });
}

/**
 * State o'chirish (masalan, jarayon tugagach).
 */
export async function clearState(telegramId: string): Promise<void> {
  const tgId = String(telegramId);
  await prisma.botState.delete({
    where: { telegramId: tgId },
  }).catch(() => {
    // Yo'q bo'lsa — muammo emas
  });
}

/**
 * Lazy cleanup — har 100 ta chaqiruvda bir marta eski state'larni tozalaydi.
 * Bu pg_cron'siz ishlash uchun.
 */
let cleanupCounter = 0;
export async function maybeCleanup(): Promise<void> {
  cleanupCounter++;
  if (cleanupCounter % 100 !== 0) return;
  
  try {
    await prisma.$executeRawSELECT cleanup_expired_bot_states();
  } catch (err) {
    console.error('[botState] cleanup failed:', err);
  }
}
📂 3-fayl: Eski in-memory Map'ni topish va almashtirish
Qaysi faylda ekanligini topish. Lokal kompyuteringizda terminalda:
cd c:\loyiha\nextBOT
findstr /S /I /N "userState" bot\*.ts src\*.ts
findstr /S /I /N "new Map" bot\*.ts src\*.ts
Bu sizga aniq fayl + qator raqami ko'rsatadi. Kutilgan natija — bot/state/userState.ts yoki shunga o'xshash fayl.
Variant A: Eski Map fayli to'liq almashtirish
Agar bot/state/userState.ts yoki bot/state/index.ts da shunga o'xshash kod bo'lsa:
// ESKI KOD (in-memory Map — Vercel'da YO'QOLADI)
const userState = new Map<string, any>();

export function getState(tgId: string) {
  return userState.get(tgId);
}
export function setState(tgId: string, state: any) {
  userState.set(tgId, state);
}
export function clearState(tgId: string) {
  userState.delete(tgId);
}
Bu faylni to'liq almashtiring quyidagi mazmun bilan (DB versiyasiga proxy):
// bot/state/userState.ts (yoki index.ts)
// Eski in-memory Map'dan DB-backed state'ga o'tish
// API o'zgarishsiz — barcha eski chaqiruvlar ishlashda davom etadi

export { 
  getState, 
  setState, 
  patchState, 
  clearState, 
  maybeCleanup 
} from './dbState';
Variant B: Agar Map alohida fayl emas, balki kod ichida bo'lsa
Bu holda, userState.get(), userState.set(), userState.delete() chaqiruvlari async ga aylanishi kerak. Masalan:
// ESKI:
const state = userState.get(tgId);
if (state?.step === 'awaiting_contact') { ... }

// YANGI:
import { getState, setState, clearState } from './state/dbState';

const state = await getState(tgId);
if (state?.step === 'awaiting_contact') { ... }
// ESKI:
userState.set(tgId, { step: 'choose_service', data: {...} });

// YANGI:
await setState(tgId, 'choose_service', { ...data });
// ESKI:
userState.delete(tgId);

// YANGI:
await clearState(tgId);
🎯 Sizdan kerak bo'lgan ish — qisqa ro'yxat
prisma/schema.prisma ga BotState model qo'shish (yuqorida)
bot/state/dbState.ts yangi fayl yaratish (yuqorida to'liq kod)
Terminalda:
findstr /S /I /N "userState" bot\*.ts src\*.ts
findstr /S /I /N "new Map" bot\*.ts src\*.ts
Natijani menga yuboring — men aniq fayl + qator bo'yicha ko'rsataman
npx prisma db pull && npx prisma generate
git add . && git commit -m "feat: bot state moved to DB — survives Vercel cold starts" va git push
❓ Davom etamiz
findstr natijasini menga yuboring (qaysi faylda Map ishlatilgan). Men sizga har bir qator uchun aniq diff beraman — qaysi qatorni qaysi qator bilan almashtirishingizni. Keyin git push qilasiz va Vercel avtomatik deploy qiladi.
Yoki agar userState.ts alohida fayl bo'lsa, faqat Variant A'ni qiling — boshqa fayllarda hech narsa o'zgarmaydi.