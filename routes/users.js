const express = require('express');
const User = require('../model/User');
const jwt = require('jsonwebtoken');
const router = express.Router();
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
let otpStore = {}; // In-memory store for OTPs and timestamps
require('dotenv').config();

async function sendOtpEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',  // Using Gmail for this example, you can use other email services
            auth: {
                user: process.env.email,  // Replace with your email
                pass: process.env.pass,   // Replace with your email password or app password
            },
        });

        const mailOptions = {
            from: process.env.email,  // Replace with your email
            to: email,
            subject: 'Your OTP Code for ToDo App',
            text: `Your OTP to reset the password for ToDo App is: ${otp} and is valid for 5 minutes!`,
        };

        await transporter.sendMail(mailOptions);  // Send the email
        return 'OTP email sent';
    } catch (error) {
        console.error('Error sending OTP email:', error);
        throw new Error('Failed to send OTP email');
    }
}

router.post('/signup', async (req, res) => {
    try {
        const obj = req.body;
        const check = await User.find({ email: obj.email });
        console.log(check);
        if (check.length > 0) {
            res.send({ message: "User exists." })
        }
        const salt = await bcrypt.genSalt(10);
        obj.password = await bcrypt.hash(obj.password, salt);

        const newUser = new User(obj);
        var response = await newUser.save();
        res.send({ message: "Registration successful", data: response });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/login', async (req, res) => {

    try {
        const obj = req.body;
        const users = await User.find({ email: req.body.email });

        if (users.length > 0) {
            const user = users[0];
            const isMatch = await bcrypt.compare(obj.password, user.password);

            if (isMatch) {
                res.cookie('myaddress', obj.email, {
                    maxAge: 36000 * 10000, httpOnly: false,
                    sameSite: 'None',
                });
                console.log(user.accountStatus);

                if (user.accountStatus == "verification pending") {
                    console.log("Hi")
                    res.send({ message: "Vefication pending", object: user });
                }
                if (user.accountStatus == "deleted") {
                    res.send({ message: "Accound is deleted", object: user });
                }
                if (user.accountStatus == "verified") {
                    res.send({ message: "Login Successful", object: user });
                }
            } else {
                res.status(400).send({ message: "Invalid credentials" });
            }
        } else {
            res.status(400).send({ message: "User not found" });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/tasks', async (req, res) => {
    try {
        const obj = req.body;
        const users = await User.find({ email: req.body.email });
        res.send({ message: "Tasks fetched successfully", allTasks: users[0].tasks });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/newTasks', async (req, res) => {
    try {
        console.log(req.body.email);
        const users = await User.find({ email: req.body.email });
        const obj = { taskID: "Task", title: req.body.title, dueDate: req.body.dueDate, status: req.body.status, isDeleted: false };
        console.log(obj);
        if (users.length > 0) {
            const tasks = await User.updateOne({ email: req.body.email }, { $push: { tasks: obj } });
            res.send({ message: "Task created successfully", data: users[0].tasks });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/updateTaskStatus', async (req, res) => {
    const obj = req.body;
    try {
        const task = await User.updateOne
            (
                { email: obj.email, "tasks.taskID": obj.taskID },
                { $set: { "tasks.$.status": obj.status } }
            );

        if (!task) {
            return res.status(404).send({ message: "Task not found" });
        }

        res.status(200).send({ message: 'Task status updated successfully', task });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Server error, failed to update task status' });
    }
});

router.put('/deleteTask', async (req, res) => {
    const obj = req.body;
    try {
        const task = await User.updateOne
            (
                { email: obj.email, "tasks.taskID": obj.taskID },
                { $set: { "tasks.$.isDeleted": obj.isDeleted } }
            );

        if (!task) {
            return res.status(404).send({ message: "Task not found" });
        }

        res.status(200).send({ message: 'Task deleted successfully', task });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Server error, failed to update task status' });
    }
});

router.post('/request-otp', async (req, res) => {
    try {
        const users = await User.find({ email: req.body.email });
        if (users.length > 0) {
            const otp = Math.floor(1000 + Math.random() * 9000);  // Generate OTP
            const timestamp = Date.now();
            otpStore[req.body.email] = { otp, timestamp };
            // Send the OTP to the user's email
            const response = await sendOtpEmail(req.body.email, otp);
            res.send({ message: 'OTP sent successfully' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/verify-otp', (req, res) => {
    try {
        const { email, otp } = req.body;

        // Check if OTP exists for the email
        const storedData = otpStore[email];

        if (!storedData) {
            return res.status(400).json({ error: 'OTP not found for this email' });
        }

        // Check if OTP is correct
        if (storedData.otp !== parseInt(otp)) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        // Check if OTP is within the 5-minute window
        const timeDifference = Date.now() - storedData.timestamp;
        const fiveMinutesInMillis = 5 * 60 * 1000; // 5 minutes in milliseconds

        if (timeDifference > fiveMinutesInMillis) {
            return res.status(400).json({ error: 'OTP has expired' });
        }

        // OTP is valid and within the time window
        res.status(200).json({ message: 'OTP verified successfully' });

        // Optionally, remove OTP from store after verification
        delete otpStore[email];

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/reset-password', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);  // Generate salt
        const hashedPassword = await bcrypt.hash(password, salt);  // Hash password with the salt

        // Update the password in the database
        user.password = hashedPassword;  // Save the hashed password
        user.accountStatus = "verified";

        // Save the updated user
        const response = await user.save();
        // Respond with a success message
        res.send({ message: 'Password reset successful' });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/send-otp', (req, res) => {
    const obj = req.body;  // Use 'obj' for the incoming request

    // Validate email
    if (!obj.email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    const email = obj.email;  // Use 'obj.email' here

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP

    // Store OTP in memory with an expiration time (15 minutes)
    otpStore[email] = {
        otp: otp,
        expiresAt: Date.now() + 15 * 60 * 1000,  // 15 minutes expiration
    };

    // Log OTP store for debugging
    console.log("OTP store after sending OTP:", otpStore);

    // Send OTP via email using nodemailer
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.email,  // Replace with your email
            pass: process.env.pass,     // Replace with your email password or app password
        },
    });

    const mailOptions = {
        from: process.env.email,
        to: obj.email,
        subject: 'Your OTP Code',
        text: `Your OTP code is: ${otp}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return res.status(500).json({ message: 'Error sending OTP' });
        }
        res.status(200).json({ message: 'OTP sent successfully' });
    });
});

// Route to verify OTP
router.post('/verifyotp', (req, res) => {
    const obj = req.body;  // Use 'obj' for the incoming request

    // Log the request body for debugging
    console.log("Received verification request:", obj);

    // Validate email and OTP
    if (!obj.email || !obj.otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const email = obj.email;  // Use 'obj.email' here
    const otp = obj.otp;  // Use 'obj.otp' here

    // Access OTP from the in-memory store
    const otpRecord = otpStore[email];

    // Log OTP record to check if it's retrieved correctly
    console.log("OTP record from store:", otpRecord);

    if (!otpRecord) {
        return res.status(400).json({ message: 'OTP not found for the provided email' });
    }

    // Check if OTP has expired
    if (otpRecord.expiresAt < Date.now()) {
        delete otpStore[email]; // Remove expired OTP from memory
        return res.status(400).json({ message: 'OTP has expired' });
    }

    // Check if the OTP matches
    if (otpRecord.otp !== otp) {
        return res.status(400).json({ message: 'Invalid OTP' });
    }

    // OTP is valid, clear the OTP from memory after successful verification
    delete otpStore[email];

    // Respond with success message
    res.status(200).json({ message: 'OTP verified successfully' });
});

// 4. Complete Signup Route
router.post('/complete-signup', async (req, res) => {
    const obj = req.body;
    var email = obj.email
    console.log(obj)
    try {
        // Find user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        // Update the user's accountStatus to 'verified'
        user.accountStatus = 'verified';

        // Save the updated user record
        const response = await User.updateOne({ email: email }, { $set: { accountStatus: "verified" } });
        console.log(response)
        // Generate JWT token for the user
        // const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.send({
            message: 'Signup successful, account verified',
            // Send back JWT token
        });
    } catch (err) {
        console.error('Error during signup completion:', err);
        res.status(500).json({ message: 'Server error, please try again' });
    }
});


module.exports = router;
