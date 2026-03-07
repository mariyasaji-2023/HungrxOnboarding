const { body, validationResult } = require("express-validator");

// ── Validation rules for onboarding data ──────────────────────
const validateOnboarding = [
  body("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength({ max: 100 }).withMessage("Name too long"),

  body("age")
    .notEmpty().withMessage("Age is required")
    .isInt({ min: 1, max: 150 }).withMessage("Age must be between 1 and 150"),

  body("gender")
    .notEmpty().withMessage("Gender is required")
    .isIn(["Male", "Female", "Other"]).withMessage("Invalid gender value"),

  body("height")
    .notEmpty().withMessage("Height is required")
    .isFloat({ min: 50, max: 300 }).withMessage("Height must be between 50 and 300 cm"),

  body("weight")
    .notEmpty().withMessage("Weight is required")
    .isFloat({ min: 10, max: 500 }).withMessage("Weight must be between 10 and 500 kg"),

  body("primaryGoal")
    .notEmpty().withMessage("Primary goal is required")
    .isIn(["Lose Weight", "Gain Weight", "Maintain Weight"]).withMessage("Invalid primary goal"),

  body("activityLevel")
    .notEmpty().withMessage("Activity level is required")
    .isIn([
      "Sedentary",
      "Lightly Active",
      "Moderately Active",
      "Very Active",
      "Extremely Active",
    ]).withMessage("Invalid activity level"),

  body("cookingSkill")
    .optional()
    .isIn([
      "Beginner - Don't enjoy",
      "Beginner - Enjoy learning",
      "Intermediate",
      "Advanced - Love cooking",
    ]).withMessage("Invalid cooking skill"),
];

// ── Middleware to handle validation errors ─────────────────────
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

module.exports = { validateOnboarding, handleValidationErrors };