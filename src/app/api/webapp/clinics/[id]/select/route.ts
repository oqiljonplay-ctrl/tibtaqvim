import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webapp/clinics/[id]/select?tgid=<telegramId>
 * Transaction: avvalgi isCurrent=true → false, yangisin → true + lastSelectedAt.
 * Partial unique index DB darajasida bir vaqtning o'zida ikki klinika "aktiv" bo'lishini bloklaydi.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { searchParams } = new URL(req.url)
    const tgId = searchParams.get('tgid') || searchParams.get('telegramId')

    if (!tgId) {
      return NextResponse.json({ ok: false, error: 'tgid required' }, { status: 400 })
    }

    const clinicId = params.id
    if (!clinicId) {
      return NextResponse.json({ ok: false, error: 'clinicId required' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { telegramId: tgId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
    }

    // user_clinics yozuvi bo'lmasa — membership yaratib qo'yamiz
    await prisma.userClinic.upsert({
      where: { userId_clinicId: { userId: user.id, clinicId } },
      create: { userId: user.id, clinicId, role: 'patient', isActive: true },
      update: {},
    })

    // Transaction: eski current → false, yangi → true
    await prisma.$transaction(async (tx) => {
      await tx.userClinic.updateMany({
        where: { userId: user.id, isCurrent: true },
        data: { isCurrent: false },
      })
      await tx.userClinic.update({
        where: { userId_clinicId: { userId: user.id, clinicId } },
        data: { isCurrent: true, lastSelectedAt: new Date() },
      })
    })

    return NextResponse.json({ ok: true, clinicId })
  } catch (err) {
    console.error('[POST /api/webapp/clinics/[id]/select]', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
