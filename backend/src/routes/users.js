const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { validateOnboarding, handleValidationErrors } = require("../middleware/validate");

// ────────────────────────────────────────────────────────────────
// POST /api/users/onboarding
// Save all onboarding data from HungrXOnboarding screen
// ────────────────────────────────────────────────────────────────
router.post(
  "/onboarding",
  validateOnboarding,
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        name, age, gender, height, weight,
        primaryGoal, specificTarget, secondaryGoals,
        activityLevel, eatingPattern, restrictions,
        dislikes, favorites, budget, cookingSkill,
        cookingTime, healthConditions, sleepEnergy, obstacles,
      } = req.body;

      // Create new user document
      const user = new User({
        name,
        age: Number(age),
        gender,
        height: Number(height),
        weight: Number(weight),
        primaryGoal,
        specificTarget,
        secondaryGoals,
        activityLevel,
        eatingPattern,
        restrictions,
        dislikes,
        favorites,
        budget,
        cookingSkill,
        cookingTime,
        healthConditions,
        sleepEnergy,
        obstacles,
      });

      // BMI, BMR, TDEE, calorie target are auto-calculated in pre-save hook
      await user.save();

      res.status(201).json({
        success: true,
        message: `Welcome, ${user.name}! Onboarding complete.`,
        data: {
          userId: user._id,
          name: user.name,
          bmi: user.bmi,
          bmr: user.bmr,
          tdee: user.tdee,
          dailyCalorieTarget: user.dailyCalorieTarget,
          macroTargets: user.getMacroTargets(),
          onboardingCompletedAt: user.onboardingCompletedAt,
        },
      });
    } catch (error) {
      console.error("Onboarding error:", error);

      // Mongoose duplicate key or validation error
      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map((e) => ({
          field: e.path,
          message: e.message,
        }));
        return res.status(400).json({ success: false, message: "Validation failed", errors });
      }

      res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
  }
);

// ────────────────────────────────────────────────────────────────
// GET /api/users/:id
// Fetch a user's profile by ID
// ────────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        ...user.toObject(),
        macroTargets: user.getMacroTargets(),
      },
    });
  } catch (error) {
    // Invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid user ID format" });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// ── PATCH /api/users/:userId/location ────────────────────────
// Called on dashboard mount (first time) and on out() click (if changed)
router.patch("/:userId/location", async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: "lat and lng required" });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const prevLat = user.location?.lat;
    const prevLng = user.location?.lng;

    // Check if location actually changed (within ~100m threshold)
    const changed = !prevLat || !prevLng ||
      Math.abs(prevLat - lat) > 0.001 ||
      Math.abs(prevLng - lng) > 0.001;

    if (changed) {
      user.location = { lat, lng, updatedAt: new Date() };
      await user.save();
      console.log(`📍 Location updated for ${user.name}: ${lat}, ${lng}`);
      return res.json({ success: true, updated: true, data: { lat, lng } });
    }

    // Not changed — no DB write needed
    res.json({ success: true, updated: false, data: { lat, lng } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;