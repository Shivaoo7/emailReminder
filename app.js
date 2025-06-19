require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const expressLayouts = require("express-ejs-layouts");
const Reminder = require("./models/reminder");
const { log } = require("console");
const { title } = require("process");

//Express instance
const app  = express();

//Middlewares
app.use(express.urlencoded({ extended: true}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(expressLayouts);
app.set("view engine","ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout","layout");

//Connnect to dataBase
mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log("Connected to mongodb...");
}).catch((error) => {
    console.log(`Error: connecting to mongodb: ${error.message}`)
})

//Email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth:{
        user:process.env.EMAIL_USER,
        pass:process.env.EMAIL_PASS,
    },
});

//Routes
//!Home page
app.get("/", (req, res) => {
    res.render("index", {
        title: "Email Reminder App",
        currentPage: "home",
    });
});

//!About page
app.get("/about", (req, res) => {
    res.render("about", {
        title: "About - Email Reminder App",
        currentPage: "about",
    });
});

//!schedule the page
app.get("/schedule", (req, res) => {
    res.render("schedule", {
        title: "Schedule Reminder",
        currentPage: "schedule",
    });
});

//Actual logic of reminders
app.post("/schedule",async (req, res) => {
    try{
        const {email, message, dateTime} = req.body;
        const reminder = new Reminder({
            email,
            message,
            scheduledTime: new Date(dateTime),
        });
        await reminder.save();
        console.log(reminder);

        res.redirect("/schedule?success=true");
    } catch (error) {
        res.redirect("/schedule?error=true");
    }
});

//Getting reminders
app.get("/reminders", async (req, res) => {
    try {
        const reminders = await Reminder.find().sort({scheduledTime: 1});
        res.render("reminders", {
            reminders,
            title: "",
            currentPage: "reminders",
        });
    } catch (error) {
        res.status(500).send("Error retrieving reminders");
    }
})

//Cron job to schedule
cron.schedule("* * * * *", async() => {
    try {
        const now = new Date();
        const reminders = await Reminder.find({
            scheduledTime: { $lte: now },
            sent: false,
        });
        for(const reminder of reminders){
            await transporter.sendMail({
                from:process.env.EMAIL_USER,
                to:reminder.email,
                text: reminder.message,
                subject: "Reminder App",
            });
            reminder.sent = true;
            await reminder.save();
        }
    } catch (error) {
        console.log("Error sending reminders", error);
    }
});

//Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, console.log(`Server is running on port ${PORT}`))