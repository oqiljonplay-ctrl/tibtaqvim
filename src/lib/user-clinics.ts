import { prisma } from './prisma'
import { UserRole } from '@prisma/client'

/**
 * Idempotent: foydalanuvchini klinikaga "qo'shadi".
 * Agar allaqachon bo'lsa — hech narsa qilmaydi.
 * Non-critical: xato bo'lsa asosiy flow to'xtatilmaydi.
 */
export async function ensureUserClinic(
  userId: string,
  clinicId: string,
  role: UserRole = 'patient'
): Promise<void> {
  try {
    await prisma.userClinic.upsert({
      where: { userId_clinicId: { userId, clinicId } },
      create: { userId, clinicId, role, isActive: true },
      update: {},
    })
  } catch (e) {
    console.error('[ensureUserClinic] error:', e)
  }
}

/**
 * Foydalanuvchining barcha klinikalarini qaytaradi.
 * tibId / phone / telegramId orqali related user records topadi.
 */
export async function getUserAllClinicIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tibId: true, phone: true, telegramId: true },
  })
  if (!user) return []

  const orFilters = [
    user.tibId ? { tibId: user.tibId } : null,
    user.phone ? { phone: user.phone } : null,
    user.telegramId ? { telegramId: user.telegramId } : null,
  ].filter(Boolean) as { tibId?: string; phone?: string; telegramId?: string }[]

  const relatedUsers = await prisma.user.findMany({
    where: { OR: orFilters },
    select: { id: true },
  })

  const userIds = relatedUsers.map((u) => u.id)

  const userClinics = await prisma.userClinic.findMany({
    where: { userId: { in: userIds }, isActive: true },
    select: { clinicId: true },
    distinct: ['clinicId'],
  })

  return userClinics.map((uc) => uc.clinicId)
}
