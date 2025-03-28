const express = require('express');
const User = require('../model/User');
const jwt = require('jsonwebtoken');
const router = express.Router();
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

require('dotenv').config();

const otpStore = {};
const SECRET_KEY = process.env.SECRET_KEY;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.email,
        pass: process.env.pass,
    },
});

router.post('/register', async (req, res) => {
    const obj = req.body;
    if (!otpStore[obj.email]) {
        return res.send({ error: 'OTP not found for this email' });
    }
    const storedOtp = otpStore[obj.email];
    if (Date.now() > storedOtp.expirationTime) {
        delete otpStore[obj.email];
        return res.send({ error: 'OTP has expired. Please reset.' });
    }
    if (storedOtp.otp !== parseInt(obj.otp)) {
        return res.send({ error: 'Invalid OTP' });
    }
    delete otpStore[obj.email];

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(obj.password, salt);

        const newUser = new User({
            email: obj.email,
            password: hashedPassword,
            tasks: [],
            isAccountActive: true,
        });

        await newUser.save();
        return res.send({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error during registration:', error);
        return res.send({ error: 'Internal server error' });
    }

});

router.post('/login', async (req, res) => {
    const obj = req.body;

    const existingUser = await User.findOne({ email: req.body.email });

    if (existingUser == null) {
        return res.send({ message: "User not found" })
    }

    if (existingUser.isAccountActive == false){
        return res.send({ message: "Account is not active. Follow 'Forgot Password' to activate the account" })
    }

    if (await bcrypt.compare(obj.password, existingUser.password)) {
        const payload = { username: obj.email };
        const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '168h' });
        return res.send({ message: "Login successful", token })
    }
    else {
        return res.send({ message: "Invalid password" })
    }

});

router.post('/change-password', async (req, res) => {
    const obj = req.body;
    const existingUser = await User.findOne({ email: obj.email });
    if (await bcrypt.compare(obj.oldPassword, existingUser.password)) {
        if (obj.oldPassword == obj.newPassword) {
            return res.send({ message: "New password cannot be same as old password" })
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(obj.newPassword, salt);
        const user = await User.updateOne({ email: obj.email }, { $set: { 'password': hashedPassword } });
        return res.send({ message: "Password changed successfully" })
    }
    else {
        return res.send({ message: "Old password does not match" })
    }
});

router.post('/get-all-tasks', async (req, res) => {
    const obj = req.body;
    const user = await User.findOne({ email: obj.email });
    if (user.tasks.length == 0) {
        return res.send({ message: "No tasks found" })
    }
    return res.send({ message: "Tasks fetched succssfully", tasks: user.tasks })
});

router.post('/add-task', async (req, res) => {
    const obj = req.body;

    try {
        const user = await User.findOne({ email: obj.email });

        if (!user) {
            return res.status(400).send({ message: "User not found" });
        }

        const newTaskObj = {
            ID: "TASK" + (user.tasks.length + 1),
            title: obj.title,
            dueDate: obj.dueDate,
            isCompleted: false,
            isDeleted: false
        };

        const updatedUser = await User.findOneAndUpdate(
            { email: obj.email },
            { $push: { tasks: newTaskObj } },
            { new: true }
        );

        return res.send({
            message: "Task added successfully",
            tasks: updatedUser.tasks
        });

    } catch (error) {
        console.error("Error adding task:", error);
        return res.status(500).send({ message: "Something went wrong. Task was not added." });
    }
});

router.put('/updateTaskStatus', async (req, res) => {
    const obj = req.body;
    const user = await User.findOneAndUpdate({ email: obj.email, 'tasks.ID': obj.ID }, { $set: { 'tasks.$.isCompleted': true } }, { new: true });
    if (user.tasks.length > 0) {
        return res.send({ message: "Task status changed to completed", tasks: user.tasks });
    }
    else {
        return res.send({ message: "Task status updation failed" });
    }
});

router.put('/deleteTask', async (req, res) => {
    const obj = req.body;
    const user = await User.findOneAndUpdate({ email: obj.email, 'tasks.ID': obj.ID }, { $set: { 'tasks.$.isDeleted': true } }, { new: true });
    if (user.tasks.length > 0) {
        return res.send({ message: "Task deleted successfully", tasks: user.tasks });
    }
    else {
        return res.send({ message: "Task deletion failed" });
    }
});

router.post('/register-otp', async (req, res) => {
    const obj = req.body;

    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
        return res.send({ message: 'User already exists' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    const expirationTime = Date.now() + 5 * 60 * 1000;
    otpStore[obj.email] = { otp, expirationTime };

    const mailOptions = {
        from: process.env.email,
        to: obj.email,
        subject: `ToDo Registration OTP - ${otp}`,
        text: `Your OTP for registration on ToDo Manager is: '${otp}'. OTP is valid for next 5 mins.`,
    };

    try {
        await transporter.sendMail(mailOptions);
        return res.send({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        return res.send({ error: 'Failed to send OTP' });
    }


});

router.put('/delete-account', async (req, res) => {
    const obj = req.body;
    console.log(obj)
    const existingUser = await User.findOne({ email: obj.email });
    if (await bcrypt.compare(obj.oldPassword, existingUser.password)) {
        const user = await User.findOneAndUpdate({ email: obj.email }, { $set: { 'isAccountActive': false } });
        return res.send({ message: "Account deleted successfully" });

    }
    else {
        return res.send({ message: "Account deletion failed" });
    }
});

router.put('/forgot-pass-otp', async (req, res) => {
    const obj = req.body;
    console.log(obj)

    const existingUser = await User.findOne({ email: obj.email });

    if (existingUser == null || existingUser == undefined) {
        return res.send({ message: 'User is invalid' });

    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    const expirationTime = Date.now() + 5 * 60 * 1000;
    otpStore[obj.email] = { otp, expirationTime };

    const mailOptions = {
        from: process.env.email,
        to: obj.email,
        subject: `ToDo Forgot Password OTP - ${otp}`,
        text: `Your OTP for resetting the forgotten password on ToDo Manager is: '${otp}'. OTP is valid for next 5 mins.`,
    };

    try {
        await transporter.sendMail(mailOptions);
        return res.send({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        return res.send({ error: 'Failed to send OTP' });
    }
});

router.post('/confirm-otp', async (req, res) => {
    const obj = req.body;
    console.log(obj);

    if (!otpStore[obj.email]) {
        return res.send({ error: 'OTP not found for this email' });
    }
    const storedOtp = otpStore[obj.email];
    if (Date.now() > storedOtp.expirationTime) {
        delete otpStore[obj.email];
        return res.send({ error: 'OTP has expired. Please reset.' });
    }
    if (storedOtp.otp !== parseInt(obj.otp)) {
        return res.send({ error: 'Invalid OTP' });
    }
    delete otpStore[obj.email];

    return res.send({ message: 'OTP matched' });
});


router.post('/reset-password', async (req, res) => {
    const obj = req.body;
    console.log(obj);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(obj.password, salt);
    const user = await User.updateOne({ email: obj.email }, { $set: { 'password': hashedPassword, 'isAccountActive': true } });
    console.log(user);
    return res.send({ message: "Password reset successful" })
});

module.exports = router;
