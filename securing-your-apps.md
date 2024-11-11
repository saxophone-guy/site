+++
date = '2024-11-11T18:41:47+05:30'
title = 'Securing Your Apps'
+++

## An Introduction

Alright, let’s talk about something we developers can get a little messy with: security. See, a lot of you devs can really [screw up](https://www.bbc.com/news/business-41493494) sometimes when it comes to security, and sadly, it's not something that a library or anyone else can do for you. It's completely up to you.

Imagine building a house. You made it, it looks great, and it works. But what if the walls were made out of paper, there was no roof, and you couldn’t lock the doors? That’s basically what it’s like when you have an app without good security. You’re letting anyone, and I mean anyone, walk right in.

Let’s dive into the basics.

## The Naive Example

Here's a basic Express.js app for user registration and login, but it has some big security flaws.

```javascript
// Required dependencies
const express = require("express");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();
app.use(express.json());

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
  res.send("Welcome to the simple app!");
});

// Endpoints
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate request body
    if (!email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Create user
    await prisma.user.create({
      data: { email, password },
    });

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate request body
    if (!email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.password !== password) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    res.json({ message: "Login successful" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
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
```
````

### Vulnerabilities

Let’s break down the flaws in this code.

1. **Plaintext Passwords**: Storing passwords directly is bad. Anyone who gets access to the database can see every user's password.
2. **MITM (Man-in-the-Middle) Attacks**: This setup doesn’t use HTTPS, so it’s vulnerable to interception. A hacker could capture login details with `curl` like so:

```bash
# Simulating a MITM attack
curl -X POST http://localhost:3000/login -d '{"email":"test@example.com","password":"1234"}' -H "Content-Type: application/json"
```

To protect against this, let’s add encryption.

## Encryption

We’re going to hash passwords before storing them, which makes it way harder for anyone to steal real passwords.

Update the code to use a hashing library like `bcrypt`.

```javascript
const bcrypt = require("bcrypt");

// Register endpoint with hashing
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: { email, password: hashedPassword },
    });

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login endpoint with hashed password verification
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    res.json({ message: "Login successful" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

## Are We There Yet?

Here’s the final version of the code with hashed passwords and better security practices. While this is much improved, you could go further by adding HTTPS, rate limiting, and more.

```javascript
// Required dependencies
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const app = express();
const prisma = new PrismaClient();
app.use(express.json());

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
  res.send("Welcome to the secure app!");
});

// Endpoints
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: { email, password: hashedPassword },
    });

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    res.json({ message: "Login successful" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
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
```

By hashing passwords, we’ve made it a lot harder for someone to steal user data. This is just the beginning—security is a process that goes far beyond this, but it’s a great start!

## More Security Layers

Now that we’ve added password hashing, let’s talk about a few other security features that can help prevent common attacks.

### 1. Rate Limiting

Attackers often try "brute force" techniques to guess passwords. Rate limiting limits the number of requests a client can make in a short period. This can prevent these attacks by slowing down repeated login attempts from the same IP.

Using a library like `express-rate-limit` is an easy way to set up rate limiting.

```javascript
const rateLimit = require("express-rate-limit");

// Apply rate limiting to all requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

app.use(limiter);
// ...
```

### HTTPS

Plain HTTP sends data in clear text, so anyone intercepting it could read passwords and other sensitive information. Using HTTPS (SSL/TLS encryption) protects against this by encrypting the data between client and server.

To set up HTTPS, you need an SSL certificate, which can be obtained from providers like Let's Encrypt.

```javascript
// Example HTTPS setup
const https = require("https");
const fs = require("fs");

// Load SSL certificate and key
const options = {
  key: fs.readFileSync("/path/to/your/private.key"),
  cert: fs.readFileSync("/path/to/your/certificate.crt"),
};

// Start HTTPS server
https.createServer(options, app).listen(3000, () => {
  console.log("Secure server running on port 3000");
});
```

### Environment variables

Storing sensitive information like database passwords directly in your code is risky. Use environment variables to keep sensitive data out of your codebase. With a .env file, you can keep these variables safe and easily switch configurations.

Install dotenv:
