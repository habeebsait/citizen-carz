require('dotenv').config();

const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const cors = require('cors');
const multer = require('multer');



const app = express();
const PORT = 3000;

// Define the public uploads directory
const uploadsDir = path.join(__dirname, 'public', 'uploads');

// Ensure the uploads directory exists
fs.mkdir(uploadsDir, { recursive: true })
  .then(() => console.log('Uploads directory created'))
  .catch(err => console.error('Error creating uploads directory:', err));

// Multer setup (for handling file uploads)
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        const numberPlate = req.body.numberPlate.replace(/\s+/g, '_'); // Replace spaces with underscores
        const numberPlateDir = path.join(__dirname, 'public', numberPlate);
``
        try {
            await fs.mkdir(numberPlateDir, { recursive: true });
            cb(null, numberPlateDir);
        } catch (err) {
            console.error('Error creating number plate directory:', err);
            cb(err, numberPlateDir);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueSuffix);
    }
});

const upload = multer({ storage: storage });

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname))); // Serves files from the root directory
app.use('/uploads', express.static(uploadsDir)); // Make uploads folder servable

const DATA_PATH = path.join(__dirname, 'cars.json');

// Async/await readData function
async function readData() {
    try {
        const data = await fs.readFile(DATA_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return []; // Return empty array if file doesn't exist
        }
        console.error("Error reading or parsing file:", error);
        throw error;
    }
}

// Async function to write data
async function writeData(cars) {
    try {
        await fs.writeFile(DATA_PATH, JSON.stringify(cars, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing file:', error);
        throw error; 
    }
}

// Route to get all cars
app.get('/cars', async (req, res) => {
    try {
        const cars = await readData();
        res.json(cars);
    } catch (error) {
        console.error("Error getting cars:", error);
        res.status(500).json({ error: 'Failed to fetch cars' });
    }
});

// Route to add or update cars
app.put('/cars', async (req, res) => {
    try {
        const cars = req.body;

        // Validate input data
        if (!Array.isArray(cars)) {
            return res.status(400).json({ error: "Invalid data format. Expected an array." });
        }

        await writeData(cars);
        res.json({ message: 'Cars updated successfully!' });
    } catch (error) {
        console.error("Error updating cars:", error);
        res.status(500).json({ error: 'Failed to update cars' });
    }
});

// Route to delete a car
// Route to delete a car
app.delete('/cars/:index', async (req, res) => {
    try {
        const index = parseInt(req.params.index, 10);
        const cars = await readData();

        if (isNaN(index) || index < 0 || index >= cars.length) {
            return res.status(400).json({ error: 'Invalid index' });
        }

        // Get the images to delete
        const imagesToDelete = cars[index].images; // Assuming each car object has an 'images' array

        // Delete images from the filesystem
        await Promise.all(imagesToDelete.map(async (imagePath) => {
            try {
                await fs.unlink(path.join(__dirname, imagePath));
            } catch (err) {
                console.error(`Error deleting image ${imagePath}:`, err);
            }
        }));

        // Remove the car from the array
        cars.splice(index, 1);
        await writeData(cars);
        res.json({ message: 'Car deleted successfully!' });
    } catch (error) {
        console.error("Error deleting car:", error);
        res.status(500).json({ error: 'Failed to delete car' });
    }
});


// Image upload route (handles multiple images)
app.post('/upload', upload.array('imageUpload', 15), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No image files provided' });
        }

        // Map all uploaded image paths
        const imagePaths = req.files.map(file => `/uploads/${req.body.numberPlate.replace(/\s+/g, '_')}/${file.filename}`);
        res.json({ imagePaths: imagePaths });
    } catch (error) {
        console.error("Error uploading images:", error);
        res.status(500).json({ error: error.message });
    }
});


// Route to add a new car (POST request)
app.post('/cars', async (req, res) => {
    try {
        const newCar = req.body; // This includes the new car data and image path

        // Read the existing cars
        const cars = await readData();

        // Add the new car to the array
        cars.push(newCar);

        // Write the updated cars array to the file
        await writeData(cars);

        res.json({ message: 'Car added successfully!' });
    } catch (error) {
        console.error("Error adding car:", error);
        res.status(500).json({ error: 'Failed to add car' });
    }
});



// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
});




const nodemailer = require('nodemailer');

const bodyParser = require('body-parser');



app.use(bodyParser.json());

app.post('/send-email', (req, res) => {
    const { name, email, message } = req.body;

    const transporter = nodemailer.createTransport({
        service: 'Gmail', // or another email service
        auth: {
            user: process.env.EMAIL_USER, // your email from .env
            pass: process.env.EMAIL_PASS // your email password
        }
    });

    const mailOptions = {
        from: email,
        to: 'habeebsait24@gmail.com', // destination email
        subject: `CITIZEN CARS CUSTOMER ${name}`,
        text: `Name: ${name}\nEMAIL: ${email}\nMessage: ${message}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
            return res.status(500).send('Error sending email');
        }
        res.status(200).send('Email sent successfully');
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
