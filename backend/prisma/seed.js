import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
const TODAY = "2026-08-30";
const AREAS = [
    "North Ward",
    "Riverside",
    "Old Town",
    "Mirpur",
    "Uttara",
    "Dhanmondi",
    "Banani",
    "Gulshan",
    "Motijheel",
    "Bashundhara",
    "Savar",
    "Tongi",
    "Narayanganj",
    "Keraniganj",
    "Jatrabari",
    "Mohammadpur",
    "Badda",
    "Rampura",
    "Shyamoli",
    "Khilgaon",
    "Cantonment",
    "Wari",
    "Lalbagh",
    "Kamrangirchar",
    "Demra",
];
const TYPES = ["Residential", "Commercial", "Mixed"];
function rng(seed) {
    return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function addDaysISO(iso, days) {
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
const HISTORY_DAYS = 180;
async function main() {
    console.log("🌱 Starting database seeding...");
    // Clean existing data
    await prisma.savedSimulation.deleteMany({});
    await prisma.rechargeEvent.deleteMany({});
    await prisma.dayPoint.deleteMany({});
    await prisma.meter.deleteMany({});
    await prisma.user.deleteMany({});
    // 1. Create Demo User
    const passwordHash = await bcrypt.hash("password123", 10);
    const demoUser = await prisma.user.create({
        data: {
            name: "Demo User",
            email: "demo@rechargeadvisor.pro",
            passwordHash,
            role: "USER",
        },
    });
    console.log(`✅ Created demo user: ${demoUser.email} / password123`);
    // 2. Seed 25 Benchmark cases
    console.log("⚡ Seeding 25 Benchmark Meter Cases...");
    for (let i = 0; i < 25; i++) {
        const r = rng(1000 + i * 77);
        const meterType = TYPES[i % 3];
        const commercialBoost = meterType === "Commercial" ? 2.1 : meterType === "Mixed" ? 1.4 : 1;
        const usualDailyUnits = Math.round((6 + r() * 14) * commercialBoost * 10) / 10;
        const rate = Math.round((6.4 + r() * 4.6) * 100) / 100;
        const meterRent = [40, 45, 60, 85][Math.floor(r() * 4)];
        const demandCharge = Math.round((25 + r() * 60) / 5) * 5;
        const vatRate = 0.05;
        const start = addDaysISO(TODAY, -(HISTORY_DAYS - 1));
        const openingBalance = Math.round((600 + r() * 2600) / 10) * 10;
        const historyData = [];
        const rechargeData = [];
        let balance = openingBalance;
        const threshold = Math.round((120 + r() * 300) / 10) * 10;
        const topUp = Math.round((800 + r() * 3000) / 100) * 100;
        for (let d = 0; d < HISTORY_DAYS; d++) {
            const date = addDaysISO(start, d);
            if (balance < threshold) {
                const amount = Math.round((topUp * (0.8 + r() * 0.5)) / 50) * 50;
                const fees = meterRent + demandCharge;
                const vat = (amount - fees) * vatRate;
                const credit = amount - fees - vat;
                balance += credit;
                rechargeData.push({ date, amount, fees, vat, credit });
            }
            const weekday = new Date(date + "T00:00:00Z").getUTCDay();
            const weekendFactor = weekday === 5 || weekday === 6 ? 1.12 : 1;
            const units = Math.max(0.5, Math.round(usualDailyUnits * weekendFactor * (0.78 + r() * 0.44) * 10) / 10);
            balance = Math.max(0, Math.round((balance - units * rate) * 100) / 100);
            historyData.push({ date, balance: Math.round(balance * 100) / 100, units });
        }
        const n = String(i + 1).padStart(3, "0");
        const caseId = `CASE-${n}`;
        await prisma.meter.create({
            data: {
                id: caseId,
                label: `CASE-${n} · ${AREAS[i]}`,
                area: AREAS[i],
                meterType,
                openingBalance,
                currentBalance: balance,
                usualDailyUnits,
                rate,
                meterRent,
                demandCharge,
                vatRate,
                isBenchmark: true,
                history: {
                    create: historyData,
                },
                recharges: {
                    create: rechargeData,
                },
            },
        });
    }
    // 3. Create a custom meter for Demo User
    const myCustomMeter = await prisma.meter.create({
        data: {
            userId: demoUser.id,
            label: "My Dhanmondi Residence",
            meterNumber: "MTR-8829104",
            area: "Dhanmondi",
            meterType: "Residential",
            openingBalance: 1500,
            currentBalance: 820.5,
            usualDailyUnits: 8.5,
            rate: 7.2,
            meterRent: 40,
            demandCharge: 35,
            vatRate: 0.05,
            isBenchmark: false,
            history: {
                create: [
                    { date: addDaysISO(TODAY, -5), balance: 1120.5, units: 8.2 },
                    { date: addDaysISO(TODAY, -4), balance: 1061.4, units: 8.2 },
                    { date: addDaysISO(TODAY, -3), balance: 998.0, units: 8.8 },
                    { date: addDaysISO(TODAY, -2), balance: 938.9, units: 8.2 },
                    { date: addDaysISO(TODAY, -1), balance: 878.0, units: 8.5 },
                    { date: TODAY, balance: 820.5, units: 8.0 },
                ],
            },
            recharges: {
                create: [
                    {
                        date: addDaysISO(TODAY, -30),
                        amount: 1500,
                        fees: 75,
                        vat: 71.25,
                        credit: 1353.75,
                        notes: "Monthly topup",
                    },
                ],
            },
        },
    });
    console.log(`✅ Created demo user custom meter: ${myCustomMeter.label} (ID: ${myCustomMeter.id})`);
    console.log("🎉 Database seeding completed successfully!");
}
main()
    .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
