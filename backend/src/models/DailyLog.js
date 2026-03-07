const mongoose = require("mongoose");

const mealEntrySchema = new mongoose.Schema({
  name:      { type: String, required: true },
  calories:  { type: Number, default: 0 },
  protein:   { type: Number, default: 0 },
  carbs:     { type: Number, default: 0 },
  fat:       { type: Number, default: 0 },
  source:    { type: String, default: "Unknown" },
  loggedAt:  { type: Date, default: Date.now },
});

const dailyLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  date: {
    type: String, // "YYYY-MM-DD" — one doc per user per day
    required: true,
  },
  meals: [mealEntrySchema],

  // Running totals (updated on every add/remove)
  totalCalories: { type: Number, default: 0 },
  totalProtein:  { type: Number, default: 0 },
  totalCarbs:    { type: Number, default: 0 },
  totalFat:      { type: Number, default: 0 },
}, { timestamps: true });

// One log per user per day
dailyLogSchema.index({ userId: 1, date: 1 }, { unique: true });

// Recalculate totals from meals array
dailyLogSchema.methods.recalcTotals = function () {
  this.totalCalories = this.meals.reduce((s, m) => s + (m.calories || 0), 0);
  this.totalProtein  = this.meals.reduce((s, m) => s + (m.protein  || 0), 0);
  this.totalCarbs    = this.meals.reduce((s, m) => s + (m.carbs    || 0), 0);
  this.totalFat      = this.meals.reduce((s, m) => s + (m.fat      || 0), 0);
};

module.exports = mongoose.models.DailyLog || mongoose.model("DailyLog", dailyLogSchema);