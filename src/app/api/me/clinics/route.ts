import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me/clinics?tgid=<telegramId>
 * user_clinics — yagona a'zolik haqiqat manbai.
 * currentClinicId: isCurrent=true bo'lgan klinika (DB'da doimiy saqlanadi).
 * lastClinicId: oxirgi bron (backward compat uchun saqlanadi).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tgId = searchParams.get('tgid') || searchParams.get('telegramId')

    if (!tgId) {
      return NextResponse.json({ clinics: [], currentClinicId: null, lastClinicId: null })
    }

    const user = await prisma.user.findFirst({
      where: { telegramId: tgId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ clinics: [], currentClinicId: null, lastClinicId: null })
    }

    const userClinics = await prisma.userClinic.findMany({
      where: { userId: user.id, isActive: true },
      select: { clinicId: true, isCurrent: true, lastSelectedAt: true },
      orderBy: [
        { isCurrent: 'desc' },
        { lastSelectedAt: 'desc' },
        { joinedAt: 'desc' },
      ],
    })

    if (userClinics.length === 0) {
      return NextResponse.json({ clinics: [], currentClinicId: null, lastClinicId: null })
    }

    const clinicIds = userClinics.map((uc) => uc.clinicId)
    const currentClinicId = userClinics.find((uc) => uc.isCurrent)?.clinicId ?? null

    const [clinicRows, lastAppt] = await Promise.all([
      prisma.clinic.findMany({
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
      }),
      prisma.appointment.findFirst({
        where: { userId: user.id, clinicId: { in: clinicIds } },
        orderBy: { createdAt: 'desc' },
        select: { clinicId: true },
      }),
    ])

    const lastClinicId = lastAppt?.clinicId ?? clinicIds[0] ?? null

    // Tartiblash: isCurrent → lastSelectedAt → lastAppt → joinedAt
    const orderMap = new Map(userClinics.map((uc, i) => [uc.clinicId, i]))
    const sorted = [...clinicRows].sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99))

    return NextResponse.json({
      clinics: sorted.map((c) => ({
        ...c,
        rating: typeof c.rating === 'number' ? c.rating : null,
      })),
      currentClinicId,
      lastClinicId,
    })
  } catch (err) {
    console.error('[GET /api/me/clinics]', err)
    return NextResponse.json({ clinics: [], currentClinicId: null, lastClinicId: null })
  }
}
