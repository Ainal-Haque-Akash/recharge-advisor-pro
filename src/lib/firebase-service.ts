import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import { CASES, type MeterCase as BenchmarkCase } from "@/data/cases";
import { creditFromRecharge, dailyEnergyCost } from "@/lib/meter";
import type { MeterCase, CreateMeterPayload } from "./api";

const METERS_COLLECTION = "meters";
const SIMULATIONS_COLLECTION = "simulations";
const USERS_COLLECTION = "users";

export const firebaseService = {
  // Sync benchmark cases to Firestore if needed
  async syncBenchmarkCases(): Promise<void> {
    try {
      const snap = await getDocs(query(collection(db, METERS_COLLECTION), where("isBenchmark", "==", true)));
      if (snap.empty) {
        console.log("⚡ Populating benchmark cases into Firestore...");
        for (const c of CASES.slice(0, 10)) {
          await setDoc(doc(db, METERS_COLLECTION, c.id), {
            ...c,
            isBenchmark: true,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      console.warn("Could not sync benchmark cases to Firestore (offline/rules):", err);
    }
  },

  // Fetch all meters accessible (benchmark cases + user's meters)
  async getMeters(userId?: string): Promise<MeterCase[]> {
    const results: MeterCase[] = [];

    // 1. First include benchmark cases
    for (const c of CASES) {
      results.push({
        ...c,
        isBenchmark: true,
        isOwner: false,
      });
    }

    // 2. If user is logged in, fetch their custom meters from Firestore
    if (userId) {
      try {
        const q = query(
          collection(db, METERS_COLLECTION),
          where("userId", "==", userId)
        );
        const querySnapshot = await getDocs(q);
        const userMeters: MeterCase[] = [];
        querySnapshot.forEach((d) => {
          const data = d.data() as any;
          userMeters.push({
            id: d.id,
            label: data.label,
            area: data.area,
            meterNumber: data.meterNumber,
            meterType: data.meterType,
            openingBalance: data.openingBalance,
            currentBalance: data.currentBalance,
            usualDailyUnits: data.usualDailyUnits,
            isBenchmark: false,
            isOwner: true,
            tariff: data.tariff,
            history: data.history || [],
            recharges: data.recharges || [],
          });
        });

        // Prepend user meters so they appear at the top
        return [...userMeters, ...results];
      } catch (err) {
        console.warn("Error fetching user meters from Firestore:", err);
      }
    }

    return results;
  },

  // Fetch single meter by ID
  async getMeter(id: string, userId?: string): Promise<MeterCase> {
    // Check if it's in Firestore first
    try {
      const docRef = doc(db, METERS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id,
          label: data.label,
          area: data.area,
          meterNumber: data.meterNumber,
          meterType: data.meterType,
          openingBalance: data.openingBalance,
          currentBalance: data.currentBalance,
          usualDailyUnits: data.usualDailyUnits,
          isBenchmark: Boolean(data.isBenchmark),
          isOwner: Boolean(userId && data.userId === userId),
          tariff: data.tariff,
          history: data.history || [],
          recharges: data.recharges || [],
        };
      }
    } catch (err) {
      console.warn("Firestore getMeter lookup error:", err);
    }

    // Fallback to static CASES
    const found = CASES.find((c) => c.id === id);
    if (found) {
      return {
        ...found,
        isBenchmark: true,
        isOwner: false,
      };
    }

    return {
      ...CASES[0]!,
      isBenchmark: true,
      isOwner: false,
    };
  },

  // Create a new custom meter in Firestore
  async createMeter(userId: string, data: CreateMeterPayload): Promise<MeterCase> {
    const todayISO = new Date().toISOString().slice(0, 10);
    const tariff = {
      rate: data.rate,
      meterRent: data.meterRent ?? 40,
      demandCharge: data.demandCharge ?? 35,
      vatRate: data.vatRate ?? 0.05,
    };

    const initialHistory = [
      {
        date: todayISO,
        balance: data.openingBalance,
        units: data.usualDailyUnits,
      },
    ];

    const meterData = {
      userId,
      label: data.label,
      meterNumber: data.meterNumber || `MTR-${Math.floor(1000000 + Math.random() * 9000000)}`,
      area: data.area,
      meterType: data.meterType,
      openingBalance: data.openingBalance,
      currentBalance: data.openingBalance,
      usualDailyUnits: data.usualDailyUnits,
      tariff,
      history: initialHistory,
      recharges: [],
      isBenchmark: false,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, METERS_COLLECTION), meterData);

    return {
      id: docRef.id,
      ...meterData,
      isOwner: true,
    };
  },

  // Update custom meter settings in Firestore
  async updateMeter(meterId: string, data: Partial<CreateMeterPayload>): Promise<void> {
    const docRef = doc(db, METERS_COLLECTION, meterId);
    const updatePayload: Record<string, any> = {};

    if (data.label) updatePayload.label = data.label;
    if (data.meterNumber !== undefined) updatePayload.meterNumber = data.meterNumber;
    if (data.area) updatePayload.area = data.area;
    if (data.meterType) updatePayload.meterType = data.meterType;
    if (data.usualDailyUnits !== undefined) updatePayload.usualDailyUnits = data.usualDailyUnits;
    if (data.rate !== undefined || data.meterRent !== undefined || data.demandCharge !== undefined || data.vatRate !== undefined) {
      const snap = await getDoc(docRef);
      const current = snap.data()?.tariff || {};
      updatePayload.tariff = {
        rate: data.rate ?? current.rate,
        meterRent: data.meterRent ?? current.meterRent,
        demandCharge: data.demandCharge ?? current.demandCharge,
        vatRate: data.vatRate ?? current.vatRate,
      };
    }

    await updateDoc(docRef, updatePayload);
  },

  // Delete custom meter from Firestore
  async deleteMeter(meterId: string): Promise<void> {
    const docRef = doc(db, METERS_COLLECTION, meterId);
    await deleteDoc(docRef);
  },

  // Record a recharge event on a meter
  async recordRecharge(
    meterId: string,
    rechargeData: { amount: number; date?: string; notes?: string; receiptUrl?: string },
    currentUserId?: string
  ): Promise<{ credit: number; newBalance: number }> {
    const docRef = doc(db, METERS_COLLECTION, meterId);
    const snap = await getDoc(docRef);

    let meter: any;
    if (snap.exists()) {
      meter = snap.data();
    } else {
      // If benchmark case
      meter = CASES.find((c) => c.id === meterId) || CASES[0]!;
    }

    const rechargeDate = rechargeData.date || new Date().toISOString().slice(0, 10);
    const tariff = meter.tariff || { rate: 7.2, meterRent: 40, demandCharge: 35, vatRate: 0.05 };
    const { credit, fees, vat } = creditFromRecharge(rechargeData.amount, tariff);

    const prevBalance = meter.currentBalance ?? meter.history?.[meter.history.length - 1]?.balance ?? meter.openingBalance ?? 0;
    const newBalance = Math.round((prevBalance + credit) * 100) / 100;

    const newRecharge = {
      id: `rcg-${Date.now()}`,
      date: rechargeDate,
      amount: rechargeData.amount,
      fees,
      vat,
      credit,
      notes: rechargeData.notes || "",
      receiptUrl: rechargeData.receiptUrl || null,
      createdAt: new Date().toISOString(),
    };

    const newDayPoint = {
      date: rechargeDate,
      balance: newBalance,
      units: meter.usualDailyUnits || 8,
    };

    const updatedRecharges = [...(meter.recharges || []), newRecharge];
    const updatedHistory = [...(meter.history || []), newDayPoint];

    if (snap.exists()) {
      await updateDoc(docRef, {
        currentBalance: newBalance,
        recharges: updatedRecharges,
        history: updatedHistory,
      });
    } else {
      // If user is recharging a benchmark meter, save a personalized copy for the user
      if (currentUserId) {
        await setDoc(docRef, {
          ...meter,
          userId: currentUserId,
          isBenchmark: false,
          currentBalance: newBalance,
          recharges: updatedRecharges,
          history: updatedHistory,
        });
      }
    }

    return { credit, newBalance };
  },

  // Record daily consumption reading
  async recordReading(
    meterId: string,
    readingData: { units: number; date?: string }
  ): Promise<{ newBalance: number }> {
    const docRef = doc(db, METERS_COLLECTION, meterId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return { newBalance: 0 };

    const meter = snap.data();
    const readingDate = readingData.date || new Date().toISOString().slice(0, 10);
    const rate = meter.tariff?.rate || 7.2;
    const cost = readingData.units * rate;
    const prevBalance = meter.currentBalance ?? meter.openingBalance ?? 0;
    const newBalance = Math.max(0, Math.round((prevBalance - cost) * 100) / 100);

    const newDayPoint = {
      date: readingDate,
      balance: newBalance,
      units: readingData.units,
    };

    await updateDoc(docRef, {
      currentBalance: newBalance,
      history: [...(meter.history || []), newDayPoint],
    });

    return { newBalance };
  },

  // Cloud Storage: Upload bill receipt image or meter photo
  async uploadAttachment(file: File, path: string): Promise<string> {
    const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  },

  // Save simulation preset
  async saveSimulation(userId: string, data: any): Promise<string> {
    const docRef = await addDoc(collection(db, SIMULATIONS_COLLECTION), {
      userId,
      ...data,
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  },

  // Get saved simulations
  async getSavedSimulations(userId: string): Promise<any[]> {
    const q = query(
      collection(db, SIMULATIONS_COLLECTION),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);
    const sims: any[] = [];
    querySnapshot.forEach((d) => {
      sims.push({ id: d.id, ...d.data() });
    });
    return sims;
  },
};
