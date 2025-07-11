const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const {
  findUserByEmail,
  createUser,
  updatePassword,
  deactivateAccount,
  addTask,
  getTasks,
  updateTask,
} = require('../model/User');

require('dotenv').config();

const SECRET_KEY = process.env.SECRET_KEY;
const otpStore = {};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.email,
    pass: process.env.pass,
  },
});

router.post('/register-otp', async (req, res) => {
  const { email } = req.body;
  const user = await findUserByEmail(email);
  if (user) return res.send({ message: 'User already exists' });

  const otp = Math.floor(100000 + Math.random() * 900000);
  otpStore[email] = { otp, expirationTime: Date.now() + 5 * 60 * 1000 };

  try {
    await transporter.sendMail({
      from: process.env.email,
      to: email,
      subject: `ToDo Registration OTP - ${otp}`,
      text: `Your OTP is: '${otp}'. It is valid for 5 minutes.`,
    });
    res.send({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error(err);
    res.send({ error: 'Failed to send OTP' });
  }
});

router.post('/register', async (req, res) => {
  const { email, password, otp } = req.body;
  const stored = otpStore[email];
  if (!stored) return res.send({ error: 'OTP not found' });
  if (Date.now() > stored.expirationTime) return res.send({ error: 'OTP expired' });
  if (parseInt(otp) !== stored.otp) return res.send({ error: 'Invalid OTP' });

  try {
    const hashed = await bcrypt.hash(password, 10);
    await createUser(email, hashed);
    delete otpStore[email];
    res.send({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.send({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await findUserByEmail(email);
  if (!user) return res.send({ message: 'User not found' });
  if (!user.is_account_active) return res.send({ message: 'Account inactive' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.send({ message: 'Invalid password' });

  const token = jwt.sign({ username: email }, SECRET_KEY, { expiresIn: '168h' });
  res.send({ message: 'Login successful', token });
});

router.post('/change-password', async (req, res) => {
  const { email, oldPassword, newPassword } = req.body;
  const user = await findUserByEmail(email);
  if (!user || !(await bcrypt.compare(oldPassword, user.password)))
    return res.send({ message: 'Old password does not match' });

  if (oldPassword === newPassword)
    return res.send({ message: 'New password must differ from old password' });

  const hashed = await bcrypt.hash(newPassword, 10);
  await updatePassword(email, hashed);
  res.send({ message: 'Password changed successfully' });
});

router.post('/get-all-tasks', async (req, res) => {
  const { email } = req.body;
  const tasks = await getTasks(email);
  if (!tasks.length) return res.send({ message: 'No tasks found' });
  res.send({ message: 'Tasks fetched successfully', tasks });
});

router.post('/add-task', async (req, res) => {
  const { email, title, dueDate } = req.body;
  const tasks = await getTasks(email);
  const newTask = {
    ID: 'TASK' + (tasks.length + 1),
    title,
    dueDate,
    isCompleted: false,
    isDeleted: false,
  };
  const updatedTasks = await addTask(email, newTask);
  res.send({ message: 'Task added successfully', tasks: updatedTasks });
});

router.put('/updateTaskStatus', async (req, res) => {
  const { email, ID } = req.body;
  const updatedTasks = await updateTask(email, ID, 'isCompleted', true);
  res.send({ message: 'Task marked complete', tasks: updatedTasks });
});

router.put('/deleteTask', async (req, res) => {
  const { email, ID } = req.body;
  const updatedTasks = await updateTask(email, ID, 'isDeleted', true);
  res.send({ message: 'Task deleted', tasks: updatedTasks });
});

router.put('/delete-account', async (req, res) => {
  const { email, oldPassword } = req.body;
  const user = await findUserByEmail(email);
  if (!user || !(await bcrypt.compare(oldPassword, user.password)))
    return res.send({ message: 'Account deletion failed' });

  await deactivateAccount(email);
  res.send({ message: 'Account deleted successfully' });
});

router.put('/forgot-pass-otp', async (req, res) => {
  const { email } = req.body;
  const user = await findUserByEmail(email);
  if (!user) return res.send({ message: 'User is invalid' });

  const otp = Math.floor(100000 + Math.random() * 900000);
  otpStore[email] = { otp, expirationTime: Date.now() + 5 * 60 * 1000 };

  await transporter.sendMail({
    from: process.env.email,
    to: email,
    subject: `ToDo Forgot Password OTP - ${otp}`,
    text: `Your OTP for password reset: '${otp}'. Valid for 5 mins.`,
  });
  res.send({ message: 'OTP sent successfully' });
});

router.post('/confirm-otp', async (req, res) => {
  const { email, otp } = req.body;
  const stored = otpStore[email];
  if (!stored) return res.send({ error: 'OTP not found' });
  if (Date.now() > stored.expirationTime) return res.send({ error: 'OTP expired' });
  if (parseInt(otp) !== stored.otp) return res.send({ error: 'Invalid OTP' });

  delete otpStore[email];
  res.send({ message: 'OTP matched' });
});

router.post('/reset-password', async (req, res) => {
  const { email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  await updatePassword(email, hashed, true);
  res.send({ message: 'Password reset successful' });
});

module.exports = router;
