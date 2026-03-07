const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const DailyLog = require("../models/DailyLog");

const localToday = (tzOffset) => {
  const now = new Date();
  const offsetMs = (tzOffset !== undefined ? -tzOffset : now.getTimezoneOffset()) * 60000;
  const local = new Date(now.getTime() - offsetMs);
  return local.toISOString().split("T")[0];
};

const toObjectId = (id) => {
  try { return new mongoose.Types.ObjectId(id); } catch { return null; }
};

// ── GET /api/logs/:userId ─────────────────────────────────────
router.get("/:userId", async (req, res) => {
  try {
    const userId = toObjectId(req.params.userId);
    if (!userId) return res.status(400).json({ success: false, message: "Invalid userId" });

    const tzOffset = req.query.tz !== undefined ? parseInt(req.query.tz) : undefined;
    const date = req.query.date || localToday(tzOffset);

    let log = await DailyLog.findOne({ userId, date });
    if (!log) {
      return res.json({ success: true, data: { date, meals: [], totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 } });
    }
    res.json({ success: true, data: log });
  } catch (err) {
    console.error("GET log error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/logs/:userId/add ────────────────────────────────
router.post("/:userId/add", async (req, res) => {
  try {
    const userId = toObjectId(req.params.userId);
    if (!userId) return res.status(400).json({ success: false, message: "Invalid userId" });

    const { name, calories, protein, carbs, fat, source, tzOffset } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "name is required" });

    const date = req.body.date || localToday(tzOffset);

    let log = await DailyLog.findOne({ userId, date });
    if (!log) log = new DailyLog({ userId, date, meals: [] });

    log.meals.push({
      name,
      calories: Number(calories) || 0,
      protein:  Number(protein)  || 0,
      carbs:    Number(carbs)    || 0,
      fat:      Number(fat)      || 0,
      source:   source || "Unknown",
    });
    log.recalcTotals();
    await log.save();

    console.log(`✅ Saved "${name}" for ${userId} on ${date} | total: ${log.totalCalories} cal`);
    res.json({ success: true, data: log });
  } catch (err) {
    console.error("Add meal error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/logs/:userId/remove/:mealId ───────────────────
router.delete("/:userId/remove/:mealId", async (req, res) => {
  try {
    const userId = toObjectId(req.params.userId);
    if (!userId) return res.status(400).json({ success: false, message: "Invalid userId" });

    const { mealId } = req.params;
    const tzOffset = req.query.tz !== undefined ? parseInt(req.query.tz) : undefined;
    const date = req.query.date || localToday(tzOffset);

    const log = await DailyLog.findOne({ userId, date });
    if (!log) return res.status(404).json({ success: false, message: "Log not found" });

    log.meals = log.meals.filter((m) => m._id.toString() !== mealId);
    log.recalcTotals();
    await log.save();

    res.json({ success: true, data: log });
  } catch (err) {
    console.error("Remove meal error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;