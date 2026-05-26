import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me/clinics?tgid=<telegramId>
 * user_clinics — yagona a'zolik haqiqat manbai.
 * faqat isActive=true klinikalar qaytariladi.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tgId = searchParams.get('tgid') || searchParams.get('telegramId')

    if (!tgId) {
      return NextResponse.json({ clinics: [], lastClinicId: null })
    }

    const user = await prisma.user.findFirst({
      where: { telegramId: tgId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ clinics: [], lastClinicId: null })
    }

    // user_clinics — a'zolik manbai (appointments emas)
    const userClinics = await prisma.userClinic.findMany({
      where: { userId: user.id, isActive: true },
      select: { clinicId: true },
    })

    if (userClinics.length === 0) {
      return NextResponse.json({ clinics: [], lastClinicId: null })
    }

    const clinicIds = userClinics.map((uc) => uc.clinicId)

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
      // Oxirgi bron — UX tartiblash uchun (a'zolik emas)
      prisma.appointment.findFirst({
        where: { userId: user.id, clinicId: { in: clinicIds } },
        orderBy: { createdAt: 'desc' },
        select: { clinicId: true },
      }),
    ])

    const lastClinicId = lastAppt?.clinicId ?? clinicIds[0] ?? null

    const sorted = lastClinicId
      ? [
          ...clinicRows.filter((c) => c.id === lastClinicId),
          ...clinicRows.filter((c) => c.id !== lastClinicId),
        ]
      : clinicRows

    return NextResponse.json({
      clinics: sorted.map((c) => ({
        ...c,
        rating: typeof c.rating === 'number' ? c.rating : null,
      })),
      lastClinicId,
    })
  } catch (err) {
    console.error('[GET /api/me/clinics]', err)
    return NextResponse.json({ clinics: [], lastClinicId: null })
  }
}
