import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { creditFromRecharge } from "../services/simulation.service.js";

export const rechargeRouter = Router();

const createRechargeSchema = z.object({
  amount: z.number().min(50, "Recharge amount must be at least 50 BDT"),
  date: z.string().optional(),
  notes: z.string().optional(),
});

// POST /api/meters/:id/recharges - Add a new recharge event
rechargeRouter.post("/:id/recharges", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const userId = req.user!.userId;

    const meter = await prisma.meter.findUnique({
      where: { id },
      include: { history: { orderBy: { date: "desc" }, take: 1 } },
    });

    if (!meter) {
      res.status(404).json({ error: "Meter not found." });
      return;
    }

    if (meter.userId !== userId && !meter.isBenchmark) {
      res.status(403).json({ error: "You do not have permission to recharge this meter." });
      return;
    }

    const parseResult = createRechargeSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0]?.message || "Validation failed" });
      return;
    }

    const { amount, date, notes } = parseResult.data;
    const rechargeDate = date || new Date().toISOString().slice(0, 10);

    const tariff = {
      rate: meter.rate,
      meterRent: meter.meterRent,
      demandCharge: meter.demandCharge,
      vatRate: meter.vatRate,
    };

    const { credit, fees, vat } = creditFromRecharge(amount, tariff);
    const newBalance = Math.round((meter.currentBalance + credit) * 100) / 100;

    // Create recharge record & update meter balance in a transaction
    const [recharge, updatedMeter] = await prisma.$transaction([
      prisma.rechargeEvent.create({
        data: {
          meterId: id,
          date: rechargeDate,
          amount,
          fees,
          vat,
          credit,
          notes,
        },
      }),
      prisma.meter.update({
        where: { id },
        data: {
          currentBalance: newBalance,
        },
      }),
      prisma.dayPoint.create({
        data: {
          meterId: id,
          date: rechargeDate,
          balance: newBalance,
          units: meter.usualDailyUnits,
        },
      }),
    ]);

    res.status(201).json({
      message: "Recharge recorded successfully",
      recharge,
      currentBalance: updatedMeter.currentBalance,
    });
  } catch (error) {
    console.error("Record recharge error:", error);
    res.status(500).json({ error: "Failed to record recharge." });
  }
});

// GET /api/meters/:id/recharges - Get all recharges for a meter
rechargeRouter.get("/:id/recharges", async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const recharges = await prisma.rechargeEvent.findMany({
      where: { meterId: id },
      orderBy: { date: "desc" },
    });

    res.json({ recharges });
  } catch (error) {
    console.error("Get recharges error:", error);
    res.status(500).json({ error: "Failed to fetch recharges." });
  }
});

const readingSchema = z.object({
  units: z.number().min(0.1, "Units must be greater than 0"),
  date: z.string().optional(),
});

// POST /api/meters/:id/readings - Record daily consumption reading
rechargeRouter.post("/:id/readings", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const userId = req.user!.userId;

    const meter = await prisma.meter.findUnique({ where: { id } });
    if (!meter) {
      res.status(404).json({ error: "Meter not found." });
      return;
    }

    if (meter.userId !== userId && !meter.isBenchmark) {
      res.status(403).json({ error: "You do not have permission to record readings for this meter." });
      return;
    }

    const parseResult = readingSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0]?.message || "Validation failed" });
      return;
    }

    const { units, date } = parseResult.data;
    const readingDate = date || new Date().toISOString().slice(0, 10);
    const cost = units * meter.rate;
    const newBalance = Math.max(0, Math.round((meter.currentBalance - cost) * 100) / 100);

    const [dayPoint, updatedMeter] = await prisma.$transaction([
      prisma.dayPoint.create({
        data: {
          meterId: id,
          date: readingDate,
          balance: newBalance,
          units,
        },
      }),
      prisma.meter.update({
        where: { id },
        data: { currentBalance: newBalance },
      }),
    ]);

    res.status(201).json({
      message: "Daily consumption recorded successfully",
      reading: dayPoint,
      currentBalance: updatedMeter.currentBalance,
    });
  } catch (error) {
    console.error("Record reading error:", error);
    res.status(500).json({ error: "Failed to record reading." });
  }
});
