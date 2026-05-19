import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Starting user_clinics data migration...')

  const usersWithClinic = await prisma.user.findMany({
    where: { clinicId: { not: null } },
    select: { id: true, clinicId: true, role: true, createdAt: true, isActive: true },
  })

  console.log(`📊 Found ${usersWithClinic.length} users with clinicId`)

  let created = 0
  let skipped = 0

  for (const u of usersWithClinic) {
    if (!u.clinicId) continue
    try {
      await prisma.userClinic.upsert({
        where: { userId_clinicId: { userId: u.id, clinicId: u.clinicId } },
        create: { userId: u.id, clinicId: u.clinicId, role: u.role, joinedAt: u.createdAt, isActive: u.isActive },
        update: {},
      })
      created++
    } catch (e: any) {
      console.error(`❌ Error for user ${u.id}:`, e.message)
      skipped++
    }
  }

  console.log(`✅ From users.clinicId — Created/upserted: ${created}, Errors: ${skipped}`)

  // Backfill from appointments: (userId, clinicId) pairs that aren't in user_clinics yet
  const appointmentPairs = await prisma.appointment.findMany({
    where: { userId: { not: null } },
    select: { userId: true, clinicId: true },
    distinct: ['userId', 'clinicId'],
  })

  console.log(`📊 Distinct (userId, clinicId) pairs in appointments: ${appointmentPairs.length}`)

  let backfilled = 0
  for (const pair of appointmentPairs) {
    if (!pair.userId) continue
    try {
      const existing = await prisma.userClinic.findUnique({
        where: { userId_clinicId: { userId: pair.userId, clinicId: pair.clinicId } },
      })
      if (!existing) {
        await prisma.userClinic.create({
          data: { userId: pair.userId, clinicId: pair.clinicId, role: 'patient', isActive: true },
        })
        backfilled++
      }
    } catch (e: any) {
      console.error(`❌ Backfill error:`, e.message)
    }
  }

  console.log(`✅ Backfilled from appointments: ${backfilled}`)

  const total = await prisma.userClinic.count()
  console.log(`🎉 Migration complete! Total user_clinics rows: ${total}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
