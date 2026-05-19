import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me/clinics?tgid=<telegramId>
 * Foydalanuvchi bronlari orqali bog'liq klinikalar ro'yxati.
 * Auth yo'q — tgid URL param'dan olinadi (webapp pattern).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tgId = searchParams.get('tgid') || searchParams.get('telegramId')

    if (!tgId) {
      return NextResponse.json({ clinics: [], lastClinicId: null })
    }

    // Find user records by telegramId
    const users = await prisma.user.findMany({
      where: { telegramId: tgId },
      select: { id: true, clinicId: true },
    })

    if (users.length === 0) {
      return NextResponse.json({ clinics: [], lastClinicId: null })
    }

    const clinicIdSet = new Set(
      users.map((u) => u.clinicId).filter((id): id is string => !!id)
    )

    // Also check appointments to find all clinics user has booked at
    const appts = await prisma.appointment.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
      select: { clinicId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    for (const a of appts) {
      if (a.clinicId) clinicIdSet.add(a.clinicId)
    }

    const clinicIds = [...clinicIdSet]
    if (clinicIds.length === 0) {
      return NextResponse.json({ clinics: [], lastClinicId: null })
    }

    const clinics = await prisma.clinic.findMany({
      where: { id: { in: clinicIds }, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        city: true,
        logoUrl: true,
        address: true,
        phone: true,
        rating: true,
      },
    })

    const lastClinicId = appts[0]?.clinicId ?? users[0]?.clinicId ?? null

    // Sort: last visited clinic first
    const sorted = lastClinicId
      ? [
          ...clinics.filter((c) => c.id === lastClinicId),
          ...clinics.filter((c) => c.id !== lastClinicId),
        ]
      : clinics

    return NextResponse.json({
      clinics: sorted.map((c) => ({
        ...c,
        rating: c.rating !== null && c.rating !== undefined ? Number(c.rating) : null,
      })),
      lastClinicId,
    })
  } catch (err) {
    console.error('[GET /api/me/clinics]', err)
    return NextResponse.json({ clinics: [], lastClinicId: null })
  }
}
