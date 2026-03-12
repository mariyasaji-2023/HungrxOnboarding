require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Extend timeout for AI routes (Gemini can take 30-60s)
app.use((req, res, next) => {
  res.setTimeout(90000, () => {
    res.status(503).json({ success: false, message: "Request timed out — Gemini took too long. Please try again." });
  });
  next();
});

app.use("/api/users",       require("./routes/users"));
app.use("/api/cook",        require("./routes/cook"));
app.use("/api/logs",        require("./routes/logs"));
app.use("/api/restaurants", require("./routes/restaurants"));
app.use("/api/grab",        require("./routes/grab"));
app.use("/api/logparse",   require("./routes/parseLog"));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.listen(PORT, () => console.log(`HungrX backend running on port ${PORT}`));