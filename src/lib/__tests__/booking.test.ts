import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Prisma mock ──────────────────────────────────────────────────────────────
const mockTx = {
  appointment: {
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  slot: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    service: { findFirst: vi.fn() },
    $transaction: vi.fn((fn) => fn(mockTx)),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { processBooking } from "../services/booking.service";
import { prisma } from "@/lib/prisma";

const BASE_INPUT = {
  clinicId: "clinic1",
  serviceId: "svc1",
  date: new Date(Date.now() + 86400000).toISOString().split("T")[0], // ertaga
  patientName: "Test Bemor",
  patientPhone: "+998901234567",
};

const DOCTOR_QUEUE_SERVICE = {
  id: "svc1",
  type: "doctor_queue",
  dailyLimit: 3,
  requiresSlot: false,
  requiresAddress: false,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTx.appointment.count.mockResolvedValue(0);
  mockTx.appointment.findFirst.mockResolvedValue(null);
  mockTx.appointment.create.mockResolvedValue({
    id: "appt1",
    queueNumber: 1,
    service: { name: "Test", type: "doctor_queue", price: 50000 },
    doctor: null,
    slot: null,
  });
});

// ─── TEST 1: Doctor queue limit ───────────────────────────────────────────────
describe("Doctor Queue — daily limit", () => {
  it("limitga yetganda LIMIT_REACHED qaytaradi", async () => {
    (prisma.service.findFirst as any).mockResolvedValue(DOCTOR_QUEUE_SERVICE);
    mockTx.appointment.count.mockResolvedValue(3); // limit = 3, count = 3

    const result = await processBooking(BASE_INPUT);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("LIMIT_REACHED");
      expect(result.status).toBe(409);
    }
  });

  it("limit oshilmagan bo'lsa bron muvaffaqiyatli", async () => {
    (prisma.service.findFirst as any).mockResolvedValue(DOCTOR_QUEUE_SERVICE);
    mockTx.appointment.count.mockResolvedValue(2); // limit = 3, count = 2

    const result = await processBooking(BASE_INPUT);

    expect(result.success).toBe(true);
  });
});

// ─── TEST 2: Duplicate booking ────────────────────────────────────────────────
describe("Doctor Queue — duplicate prevention", () => {
  it("bir xil telefon bir xil kun — DUPLICATE_BOOKING", async () => {
    (prisma.service.findFirst as any).mockResolvedValue(DOCTOR_QUEUE_SERVICE);
    mockTx.appointment.count.mockResolvedValue(1);
    mockTx.appointment.findFirst.mockResolvedValue({ id: "existing" }); // duplicate topildi

    const result = await processBooking(BASE_INPUT);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("DUPLICATE_BOOKING");
      expect(result.status).toBe(409);
    }
  });
});

// ─── TEST 3: Slot overlap (diagnostic) ───────────────────────────────────────
describe("Diagnostic — slot overlap", () => {
  it("to'lgan slotga bron — SLOT_FULL", async () => {
    (prisma.service.findFirst as any).mockResolvedValue({
      ...DOCTOR_QUEUE_SERVICE,
      type: "diagnostic",
      requiresSlot: true,
    });
    mockTx.slot.findUnique.mockResolvedValue({ id: "slot1", isActive: true, capacity: 2 });
    mockTx.appointment.count.mockImplementation((args: any) => {
      if (args?.where?.slotId) return Promise.resolve(2); // slot to'lgan
      return Promise.resolve(0);
    });

    const result = await processBooking({ ...BASE_INPUT, slotId: "slot1" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("SLOT_FULL");
      expect(result.status).toBe(409);
    }
  });

  it("bo'sh slotga bron muvaffaqiyatli", async () => {
    (prisma.service.findFirst as any).mockResolvedValue({
      ...DOCTOR_QUEUE_SERVICE,
      type: "diagnostic",
      requiresSlot: true,
    });
    mockTx.slot.findUnique.mockResolvedValue({ id: "slot1", isActive: true, capacity: 5 });
    mockTx.appointment.count.mockImplementation((args: any) => {
      if (args?.where?.slotId) return Promise.resolve(1); // 1/5 band
      return Promise.resolve(0);
    });

    const result = await processBooking({ ...BASE_INPUT, slotId: "slot1" });

    expect(result.success).toBe(true);
  });
});

// ─── TEST 4: Home service address ─────────────────────────────────────────────
describe("Home Service — address validation", () => {
  it("manziLsiz bron — ADDRESS_REQUIRED", async () => {
    (prisma.service.findFirst as any).mockResolvedValue({
      ...DOCTOR_QUEUE_SERVICE,
      type: "home_service",
    });

    const result = await processBooking(BASE_INPUT); // address yo'q

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("ADDRESS_REQUIRED");
      expect(result.status).toBe(400);
    }
  });

  it("manzil bilan bron muvaffaqiyatli", async () => {
    (prisma.service.findFirst as any).mockResolvedValue({
      ...DOCTOR_QUEUE_SERVICE,
      type: "home_service",
    });
    mockTx.appointment.create.mockResolvedValue({
      id: "appt2",
      queueNumber: null,
      service: { name: "Uy xizmati", type: "home_service", price: 100000 },
      doctor: null,
      slot: null,
    });

    const result = await processBooking({ ...BASE_INPUT, address: "Toshkent, Chilonzor" });

    expect(result.success).toBe(true);
  });
});
