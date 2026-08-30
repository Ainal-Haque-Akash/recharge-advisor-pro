import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth, optionalAuth, type AuthRequest } from "../middleware/auth.js";

export const meterRouter = Router();

// Helper to format meter into the format expected by frontend & charts
function formatMeter(m: any, currentUserId?: string) {
  return {
    id: m.id,
    label: m.label,
    area: m.area,
    meterNumber: m.meterNumber,
    meterType: m.meterType as "Residential" | "Commercial" | "Mixed",
    openingBalance: m.openingBalance,
    currentBalance: m.currentBalance,
    usualDailyUnits: m.usualDailyUnits,
    isBenchmark: m.isBenchmark,
    isOwner: Boolean(currentUserId && m.userId === currentUserId),
    tariff: {
      rate: m.rate,
      meterRent: m.meterRent,
      demandCharge: m.demandCharge,
      vatRate: m.vatRate,
    },
    history: m.history ? m.history.map((h: any) => ({
      date: h.date,
      balance: h.balance,
      units: h.units,
    })) : [],
    recharges: m.recharges ? m.recharges.map((r: any) => ({
      id: r.id,
      date: r.date,
      amount: r.amount,
      fees: r.fees,
      vat: r.vat,
      credit: r.credit,
      notes: r.notes,
    })) : [],
  };
}

// GET /api/meters - List all benchmark cases and user's meters
meterRouter.get("/", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const userId = req.user?.userId;

    const meters = await prisma.meter.findMany({
      where: {
        OR: [
          { isBenchmark: true },
          ...(userId ? [{ userId }] : []),
        ],
      },
      orderBy: [
        { isBenchmark: "asc" }, // User's meters first
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        label: true,
        area: true,
        meterNumber: true,
        meterType: true,
        openingBalance: true,
        currentBalance: true,
        usualDailyUnits: true,
        rate: true,
        meterRent: true,
        demandCharge: true,
        vatRate: true,
        isBenchmark: true,
        userId: true,
      },
    });

    const formatted = meters.map((m) => ({
      id: m.id,
      label: m.label,
      area: m.area,
      meterNumber: m.meterNumber,
      meterType: m.meterType,
      openingBalance: m.openingBalance,
      currentBalance: m.currentBalance,
      usualDailyUnits: m.usualDailyUnits,
      isBenchmark: m.isBenchmark,
      isOwner: Boolean(userId && m.userId === userId),
      tariff: {
        rate: m.rate,
        meterRent: m.meterRent,
        demandCharge: m.demandCharge,
        vatRate: m.vatRate,
      },
    }));

    res.json({ meters: formatted });
  } catch (error) {
    console.error("List meters error:", error);
    res.status(500).json({ error: "Failed to fetch meters." });
  }
});

// GET /api/meters/:id - Get full meter details with history and recharges
meterRouter.get("/:id", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const userId = req.user?.userId;

    const meter = await prisma.meter.findUnique({
      where: { id },
      include: {
        history: {
          orderBy: { date: "asc" },
        },
        recharges: {
          orderBy: { date: "asc" },
        },
      },
    });

    if (!meter) {
      res.status(404).json({ error: "Meter not found." });
      return;
    }

    // Check permission: benchmark meters are public, custom meters only for owner
    if (!meter.isBenchmark && meter.userId && meter.userId !== userId) {
      res.status(403).json({ error: "You do not have access to this meter." });
      return;
    }

    res.json({ meter: formatMeter(meter, userId) });
  } catch (error) {
    console.error("Get meter error:", error);
    res.status(500).json({ error: "Failed to fetch meter details." });
  }
});

const createMeterSchema = z.object({
  label: z.string().min(2, "Label is required"),
  meterNumber: z.string().optional(),
  area: z.string().min(2, "Area is required"),
  meterType: z.enum(["Residential", "Commercial", "Mixed"]).default("Residential"),
  openingBalance: z.number().min(0, "Opening balance must be positive"),
  usualDailyUnits: z.number().min(0.1, "Daily units must be at least 0.1"),
  rate: z.number().min(1, "Rate must be at least 1 BDT"),
  meterRent: z.number().min(0).default(40),
  demandCharge: z.number().min(0).default(35),
  vatRate: z.number().min(0).max(1).default(0.05),
});

// POST /api/meters - Create a new custom meter (requires Auth)
meterRouter.post("/", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const parseResult = createMeterSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0]?.message || "Validation failed" });
      return;
    }

    const data = parseResult.data;
    const userId = req.user!.userId;
    const todayISO = new Date().toISOString().slice(0, 10);

    const meter = await prisma.meter.create({
      data: {
        userId,
        label: data.label,
        meterNumber: data.meterNumber || `MTR-${Math.floor(1000000 + Math.random() * 9000000)}`,
        area: data.area,
        meterType: data.meterType,
        openingBalance: data.openingBalance,
        currentBalance: data.openingBalance,
        usualDailyUnits: data.usualDailyUnits,
        rate: data.rate,
        meterRent: data.meterRent,
        demandCharge: data.demandCharge,
        vatRate: data.vatRate,
        isBenchmark: false,
        history: {
          create: [
            {
              date: todayISO,
              balance: data.openingBalance,
              units: data.usualDailyUnits,
            },
          ],
        },
      },
      include: {
        history: true,
        recharges: true,
      },
    });

    res.status(201).json({
      message: "Meter created successfully",
      meter: formatMeter(meter, userId),
    });
  } catch (error) {
    console.error("Create meter error:", error);
    res.status(500).json({ error: "Failed to create meter." });
  }
});

const updateMeterSchema = z.object({
  label: z.string().min(2).optional(),
  meterNumber: z.string().optional(),
  area: z.string().min(2).optional(),
  meterType: z.enum(["Residential", "Commercial", "Mixed"]).optional(),
  usualDailyUnits: z.number().min(0.1).optional(),
  rate: z.number().min(1).optional(),
  meterRent: z.number().min(0).optional(),
  demandCharge: z.number().min(0).optional(),
  vatRate: z.number().min(0).max(1).optional(),
});

// PUT /api/meters/:id - Update custom meter settings (requires Auth)
meterRouter.put("/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const userId = req.user!.userId;

    const existing = await prisma.meter.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Meter not found." });
      return;
    }

    if (existing.isBenchmark || existing.userId !== userId) {
      res.status(403).json({ error: "You can only update your own custom meters." });
      return;
    }

    const parseResult = updateMeterSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0]?.message || "Validation failed" });
      return;
    }

    const updated = await prisma.meter.update({
      where: { id },
      data: parseResult.data,
      include: {
        history: { orderBy: { date: "asc" } },
        recharges: { orderBy: { date: "asc" } },
      },
    });

    res.json({
      message: "Meter updated successfully",
      meter: formatMeter(updated, userId),
    });
  } catch (error) {
    console.error("Update meter error:", error);
    res.status(500).json({ error: "Failed to update meter." });
  }
});

// DELETE /api/meters/:id - Delete a custom meter (requires Auth)
meterRouter.delete("/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const userId = req.user!.userId;

    const existing = await prisma.meter.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Meter not found." });
      return;
    }

    if (existing.isBenchmark || existing.userId !== userId) {
      res.status(403).json({ error: "You can only delete your own custom meters." });
      return;
    }

    await prisma.meter.delete({ where: { id } });
    res.json({ message: "Meter deleted successfully." });
  } catch (error) {
    console.error("Delete meter error:", error);
    res.status(500).json({ error: "Failed to delete meter." });
  }
});
