const express = require('express');
const connectDB = require('./model/connectDB');
const userRoutes = require('./routes/users');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const allowedOrigins = ['http://localhost:5173', 'https://simplymanagetask.netlify.app'];


const app = express();
connectDB();

app.use(cookieParser());
app.use(express.json());
app.use(cors({
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
    credentials: true
}));
app.use(cookieParser())

app.use('/users', userRoutes);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
