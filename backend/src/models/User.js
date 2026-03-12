const mongoose = require("mongoose");

// Mirrors every field collected in HungrXOnboarding component
const userSchema = new mongoose.Schema(
  {
    // ── Auth fields ───────────────────────────────────────────
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
    },
    password: {
      type: String,
    },

    // ── Personal Info ──────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    age: {
      type: Number,
      min: [1, "Age must be at least 1"],
      max: [150, "Age must be under 150"],
    },
    gender: {
      type: String,
      enum: {
        values: ["Male", "Female", "Other"],
        message: "{VALUE} is not a valid gender option",
      },
    },
    height: {
      type: Number, // in cm
      min: [50, "Height must be at least 50 cm"],
      max: [300, "Height must be under 300 cm"],
    },
    weight: {
      type: Number, // in kg
      min: [10, "Weight must be at least 10 kg"],
      max: [500, "Weight must be under 500 kg"],
    },

    // ── Goals ──────────────────────────────────────────────────
    primaryGoal: {
      type: String,
      enum: {
        values: ["Lose Weight", "Gain Weight", "Maintain Weight"],
        message: "{VALUE} is not a valid primary goal",
      },
    },
    specificTarget: {
      type: String,
      trim: true,
      maxlength: [500, "Specific target cannot exceed 500 characters"],
    },
    secondaryGoals: {
      type: String,
      trim: true,
      maxlength: [500, "Secondary goals cannot exceed 500 characters"],
    },

    // ── Lifestyle ──────────────────────────────────────────────
    activityLevel: {
      type: String,
      enum: {
        values: [
          "Sedentary",
          "Lightly Active",
          "Moderately Active",
          "Very Active",
          "Extremely Active",
        ],
        message: "{VALUE} is not a valid activity level",
      },
    },
    eatingPattern: {
      type: String,
      trim: true,
      maxlength: [500, "Eating pattern cannot exceed 500 characters"],
    },

    // ── Food Preferences ───────────────────────────────────────
    restrictions: {
      type: String,
      trim: true,
      maxlength: [500, "Dietary restrictions cannot exceed 500 characters"],
    },
    dislikes: {
      type: String,
      trim: true,
      maxlength: [500, "Food dislikes cannot exceed 500 characters"],
    },
    favorites: {
      type: String,
      trim: true,
      maxlength: [500, "Favorite foods cannot exceed 500 characters"],
    },
    budget: {
      type: String,
      trim: true,
      maxlength: [200, "Budget cannot exceed 200 characters"],
    },

    // ── Cooking ────────────────────────────────────────────────
    cookingSkill: {
      type: String,
      enum: {
        values: [
          "Beginner - Don't enjoy",
          "Beginner - Enjoy learning",
          "Intermediate",
          "Advanced - Love cooking",
        ],
        message: "{VALUE} is not a valid cooking skill level",
      },
    },
    cookingTime: {
      type: String,
      trim: true,
      maxlength: [300, "Cooking time cannot exceed 300 characters"],
    },

    // ── Health ─────────────────────────────────────────────────
    healthConditions: {
      type: String,
      trim: true,
      maxlength: [1000, "Health conditions cannot exceed 1000 characters"],
    },
    sleepEnergy: {
      type: String,
      trim: true,
      maxlength: [500, "Sleep/energy info cannot exceed 500 characters"],
    },
    obstacles: {
      type: String,
      trim: true,
      maxlength: [500, "Obstacles cannot exceed 500 characters"],
    },

    // ── Computed Fields (auto-calculated on save) ──────────────
    bmi: {
      type: Number,
    },
    tdee: {
      type: Number, // Total Daily Energy Expenditure
    },
    bmr: {
      type: Number, // Basal Metabolic Rate
    },
    dailyCalorieTarget: {
      type: Number,
    },

    // ── Meta ───────────────────────────────────────────────────
    onboardingCompletedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

// ── Pre-save: Calculate BMI, BMR, TDEE, Calorie Target ────────
userSchema.pre("save", function (next) {
  const { height, weight, age, gender, activityLevel, primaryGoal } = this;

  if (height && weight) {
    const heightInM = height / 100;
    this.bmi = parseFloat((weight / (heightInM * heightInM)).toFixed(1));
  }

  // Mifflin-St Jeor BMR
  if (height && weight && age && gender) {
    if (gender === "Male") {
      this.bmr = Math.round(10 * weight + 6.25 * height - 5 * age + 5);
    } else {
      this.bmr = Math.round(10 * weight + 6.25 * height - 5 * age - 161);
    }
  }

  // TDEE based on activity level
  const activityMultipliers = {
    Sedentary: 1.2,
    "Lightly Active": 1.375,
    "Moderately Active": 1.55,
    "Very Active": 1.725,
    "Extremely Active": 1.9,
  };
  if (this.bmr && activityLevel) {
    this.tdee = Math.round(this.bmr * (activityMultipliers[activityLevel] || 1.55));
  }

  // Calorie target based on goal
  if (this.tdee && primaryGoal) {
    const goalAdjustments = {
      "Lose Weight": -500,
      "Gain Weight": +500,
      "Maintain Weight": 0,
    };
    this.dailyCalorieTarget = this.tdee + (goalAdjustments[primaryGoal] || 0);
  }

  next();
});

// ── Instance method: Get macro targets ────────────────────────
userSchema.methods.getMacroTargets = function () {
  const cal = this.dailyCalorieTarget || this.tdee;
  if (!cal) return null;
  return {
    protein: Math.round((cal * 0.3) / 4),   // 30% protein
    carbs:   Math.round((cal * 0.4) / 4),   // 40% carbs
    fat:     Math.round((cal * 0.3) / 9),   // 30% fat
  };
};

const User = mongoose.models.User || mongoose.model("User", userSchema);
module.exports = User;