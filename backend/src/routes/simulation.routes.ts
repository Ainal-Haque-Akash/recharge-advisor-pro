import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import {
  calculateRunOut,
  calculateRequiredRecharge,
  simulateLowBalance,
  simulateMonthly,
  type TariffParams,
} from "../services/simulation.service.js";

export const simulationRouter = Router();

const tariffSchema = z.object({
  rate: z.number().min(0.1),
  meterRent: z.number().min(0),
  demandCharge: z.number().min(0),
  vatRate: z.number().min(0).max(1),
});

const runOutSchema = z.object({
  currentBalance: z.number().min(0),
  lastDate: z.string(),
  dailyUnits: z.number().min(0.1),
  tariff: tariffSchema,
});

// POST /api/simulations/run-out
simulationRouter.post("/run-out", (req, res): void => {
  const parseResult = runOutSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0]?.message || "Validation failed" });
    return;
  }

  const { currentBalance, lastDate, dailyUnits, tariff } = parseResult.data;
  const result = calculateRunOut(currentBalance, lastDate, dailyUnits, tariff);
  res.json(result);
});

const requiredRechargeSchema = z.object({
  currentBalance: z.number().min(0),
  lastDate: z.string(),
  dailyUnits: z.number().min(0.1),
  targetDate: z.string(),
  tariff: tariffSchema,
});

// POST /api/simulations/required-recharge
simulationRouter.post("/required-recharge", (req, res): void => {
  const parseResult = requiredRechargeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0]?.message || "Validation failed" });
    return;
  }

  const { currentBalance, lastDate, dailyUnits, targetDate, tariff } = parseResult.data;
  const result = calculateRequiredRecharge(currentBalance, lastDate, dailyUnits, targetDate, tariff);
  res.json(result);
});

const compareSchema = z.object({
  currentBalance: z.number().min(0),
  startDate: z.string(),
  dailyUnits: z.number().min(0.1),
  tariff: tariffSchema,
  horizonDays: z.number().default(90),
  threshold: z.number().min(50),
  lowAmount: z.number().min(100),
  monthlyAmount: z.number().min(100),
});

// POST /api/simulations/compare
simulationRouter.post("/compare", (req, res): void => {
  const parseResult = compareSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0]?.message || "Validation failed" });
    return;
  }

  const {
    currentBalance,
    startDate,
    dailyUnits,
    tariff,
    horizonDays,
    threshold,
    lowAmount,
    monthlyAmount,
  } = parseResult.data;

  const lowResult = simulateLowBalance(
    currentBalance,
    dailyUnits,
    tariff,
    horizonDays,
    threshold,
    lowAmount,
  );

  const monthlyResult = simulateMonthly(
    currentBalance,
    startDate,
    dailyUnits,
    tariff,
    horizonDays,
    monthlyAmount,
  );

  const difference = Math.abs(lowResult.total - monthlyResult.total);
  const cheaper =
    lowResult.total < monthlyResult.total
      ? "low"
      : lowResult.total > monthlyResult.total
        ? "monthly"
        : "equal";

  res.json({
    low: lowResult,
    monthly: monthlyResult,
    cheaper,
    savings: Math.round(difference * 100) / 100,
  });
});

const saveSimulationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  meterId: z.string().optional(),
  threshold: z.number(),
  lowAmount: z.number(),
  monthlyAmount: z.number(),
  targetDate: z.string().optional(),
  resultJson: z.string(),
});

// POST /api/simulations/save
simulationRouter.post("/save", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const parseResult = saveSimulationSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0]?.message || "Validation failed" });
      return;
    }

    const { name, meterId, threshold, lowAmount, monthlyAmount, targetDate, resultJson } =
      parseResult.data;
    const userId = req.user!.userId;

    const saved = await prisma.savedSimulation.create({
      data: {
        userId,
        meterId,
        name,
        threshold,
        lowAmount,
        monthlyAmount,
        targetDate,
        resultJson,
      },
    });

    res.status(201).json({ message: "Simulation saved successfully", simulation: saved });
  } catch (error) {
    console.error("Save simulation error:", error);
    res.status(500).json({ error: "Failed to save simulation." });
  }
});

// GET /api/simulations
simulationRouter.get("/", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const simulations = await prisma.savedSimulation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        meter: {
          select: {
            id: true,
            label: true,
            meterNumber: true,
          },
        },
      },
    });

    res.json({ simulations });
  } catch (error) {
    console.error("Get simulations error:", error);
    res.status(500).json({ error: "Failed to fetch saved simulations." });
  }
});
