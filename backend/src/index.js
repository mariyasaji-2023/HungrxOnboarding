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

app.use("/api/users",       require("./routes/users"));
app.use("/api/cook",        require("./routes/cook"));
app.use("/api/logs",        require("./routes/logs"));
app.use("/api/restaurants", require("./routes/restaurants"));
app.use("/api/grab",        require("./routes/grab"));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.listen(PORT, () => console.log(`HungrX backend running on port ${PORT}`));