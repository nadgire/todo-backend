const express = require('express');
const sql = require('./model/connectDB'); // renamed for clarity since it's now SQL
const userRoutes = require('./routes/users');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config(); // ensure environment variables are loaded early

const app = express();

// CORS Configuration
const allowedOrigins = ['http://localhost:5173', 'https://simplytodomanager.netlify.app'];
app.use(cors());

app.use(cookieParser());
app.use(express.json());

// Routes
app.use('/users', userRoutes);

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
