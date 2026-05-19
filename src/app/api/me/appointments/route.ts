import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma, AppointmentStatus } from '@prisma/client'

const PAGE_SIZE = 20

// GET /api/me/appointments?telegramId=...&scope=current|all&clinicId=...&status=...&dateFrom=...&dateTo=...&sort=asc|desc&cursor=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const telegramId = searchParams.get('telegramId')
  if (!telegramId) {
    return NextResponse.json({ error: 'telegramId majburiy' }, { status: 400 })
  }

  const scope = searchParams.get('scope') === 'all' ? 'all' : 'current'
  const clinicId = searchParams.get('clinicId') || null
  const statusParam = searchParams.get('status')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const sort = searchParams.get('sort') === 'asc' ? 'asc' : 'desc'
  const cursor = searchParams.get('cursor')

  if (scope === 'current' && !clinicId) {
    return NextResponse.json({ error: 'clinicId scope=current uchun majburiy' }, { status: 400 })
  }

  // Telegramdan user topish
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, phone: true, tibId: true, telegramId: true },
  })

  if (!user) {
    return NextResponse.json({ appointments: [], nextCursor: null, total: 0 })
  }

  // tibId / phone / telegramId orqali barcha related user IDlarni topish
  const orFilters = [
    user.tibId ? { tibId: user.tibId } : null,
    user.phone ? { phone: user.phone } : null,
    { telegramId },
  ].filter(Boolean) as Prisma.UserWhereInput[]

  const relatedUsers = await prisma.user.findMany({
    where: { OR: orFilters },
    select: { id: true },
  })

  const userIds = relatedUsers.map((u) => u.id)
  if (userIds.length === 0) {
    return NextResponse.json({ appointments: [], nextCursor: null, total: 0 })
  }

  // Where clause: userId yoki patientPhone (phone bo'lsa ikkalasini ham tekshir)
  const userOrFilters: Prisma.AppointmentWhereInput[] = [{ userId: { in: userIds } }]
  if (user.phone) userOrFilters.push({ patientPhone: user.phone })
  const where: Prisma.AppointmentWhereInput = { OR: userOrFilters }

  if (scope === 'current' && clinicId) {
    where.clinicId = clinicId
  }

  if (statusParam) {
    const statuses = statusParam.split(',').map((s) => s.trim()).filter(Boolean) as AppointmentStatus[]
    if (statuses.length > 0) {
      where.status = { in: statuses }
    }
  }

  if (dateFrom || dateTo) {
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (dateFrom) {
      const d = new Date(dateFrom)
      if (!isNaN(d.getTime())) dateFilter.gte = d
    }
    if (dateTo) {
      const d = new Date(dateTo)
      if (!isNaN(d.getTime())) dateFilter.lte = d
    }
    if (dateFilter.gte || dateFilter.lte) {
      where.date = dateFilter
    }
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      clinic: { select: { id: true, name: true, logoUrl: true, city: true } },
      branch: { select: { id: true, name: true, address: true } },
      service: { select: { id: true, name: true, type: true, price: true } },
      doctor: { select: { id: true, firstName: true, lastName: true, specialty: true, photoUrl: true } },
      slot: { select: { startTime: true, endTime: true } },
    },
    orderBy: [{ date: sort }, { id: sort }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = appointments.length > PAGE_SIZE
  const items = hasMore ? appointments.slice(0, PAGE_SIZE) : appointments
  const nextCursor = hasMore ? items[items.length - 1].id : null

  let total: number | null = null
  if (!cursor) {
    total = await prisma.appointment.count({ where })
  }

  return NextResponse.json({ appointments: items, nextCursor, total, scope })
}
