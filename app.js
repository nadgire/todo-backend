const express = require('express');
const connectDB = require('./model/connectDB');
const userRoutes = require('./routes/users');  
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');


const app = express();
connectDB();

app.use(cookieParser());
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
    credentials: true
}));
app.use(cookieParser())

app.use('/users', userRoutes);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
