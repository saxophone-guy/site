// Required dependencies
const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const bcrypt = require("bcrypt");

const app = express();
const prisma = new PrismaClient();
app.use(express.json());

// Generate RSA key pair
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 4096,
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
  },
});

// Utility functions
const validateTurnstileToken = async (token) => {
  try {
    const response = await axios.post(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
      },
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    return response.data.success;
  } catch (error) {
    console.error("Turnstile validation error:", error);
    return false;
  }
};

const decryptPassword = (encryptedPassword) => {
  try {
    const buffer = Buffer.from(encryptedPassword, "base64");
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_OAEP_PADDING,
        oaepHash: "sha256",
      },
      buffer,
    );
    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Password decryption error:", error);
    throw new Error("Invalid encrypted password");
  }
};

// Database initialization
async function initializeDatabase() {
  try {
    await prisma.$connect();
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection error:", error);
    process.exit(1);
  }
}

// Main page
app.get("/", (req, res) => {
  res.sendFile(require("path").join(__dirname, "index.html"));
});

// Endpoints
app.get("/public-key", (req, res) => {
  res.json({ publicKey });
});

app.post("/register", async (req, res) => {
  try {
    const { email, encryptedPassword, turnstileToken } = req.body;

    // Validate request body
    if (!email || !encryptedPassword || !turnstileToken) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate turnstile token
    const isTokenValid = await validateTurnstileToken(turnstileToken);
    if (!isTokenValid) {
      return res.status(400).json({ error: "Invalid turnstile token" });
    }

    // Decrypt password
    let password;
    try {
      password = decryptPassword(encryptedPassword);
    } catch (error) {
      return res.status(400).json({ error: "Invalid encrypted password" });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        salt,
      },
    });

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, encryptedPassword, turnstileToken } = req.body;

    // Validate request body
    if (!email || !encryptedPassword || !turnstileToken) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate turnstile token
    const isTokenValid = await validateTurnstileToken(turnstileToken);
    if (!isTokenValid) {
      return res.status(400).json({ error: "Invalid turnstile token" });
    }

    // Decrypt password
    let password;
    try {
      password = decryptPassword(encryptedPassword);
    } catch (error) {
      return res.status(400).json({ error: "Invalid encrypted password" });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET ||
        "super duper secret code haha im gonna keep typing so that this is very secure and stuff (im very smort for typing this out and setting it as the default jwt secret). also uhh..... https://www.youtube.com/watch?v=E4WlUXrJgy4",
      { expiresIn: "1h" },
    );

    // Convert token to base64
    const base64Token = Buffer.from(token).toString("base64");
    res.json({ token: base64Token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/protected", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const base64Token = authHeader.split(" ")[1];
    const token = Buffer.from(base64Token, "base64").toString("utf8");

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET ||
          "super duper secret code haha im gonna keep typing so that this is very secure and stuff (im very smort for doing this and setting it as the default jwt secret)",
      );
      res.status(200).json({
        message: "Protected route accessed successfully! (i would put some sort of secret here but i do NOT care enough lmfao)",
        user: {
          id: decoded.userId,
          email: decoded.email,
        },
      });
    } catch (error) {
      res.status(401).json({ error: "Invalid token" });
    }
  } catch (error) {
    console.error("Protected route error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something broke!" });
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log("RSA key pair generated successfully");
  });
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log(
    "SIGTERM received. Closing HTTP server and database connection...",
  );
  await prisma.$disconnect();
  process.exit(0);
});
