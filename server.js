const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');
const Winner = require('./models/Winner');
const RouletteRound = require('./models/RouletteRoundSchema');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const Image = require('./models/Image');
const rateLimit = require("express-rate-limit");
const { createProxyMiddleware } = require('http-proxy-middleware');
const Joi = require('@hapi/joi');
const ChatMessage = require('./models/ChatMessage');
const session = require('express-session');
const MongoStore = require('connect-mongo');



const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: ['http://31.129.111.149'],
        methods: ["GET", "POST"]
    }
});

const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = ['http://31.129.111.149:3000', 'https://31.129.111.149:3000'];
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
};

app.use(cors(corsOptions));


app.use(express.json());

const MONGODB_URI = 'mongodb+srv://ssdfsdfs:YIC7CDPL7Wz0KZ5s@cluster0.ljx8jhx.mongodb.net/?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    bufferCommands: false
})

    .then(() => {
        console.log('Connected to MongoDB Atlas');
    })
    .catch(err => {
        console.error('Failed to connect to MongoDB Atlas', err);
    });

    mongoose.connection.on('error', err => {
        console.error('Error with MongoDB connection:', err);
    });
    
app.use(session({
    secret: '121212',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        collectionName: 'sessions',
        touchAfter: 24 * 3600 
    })
}));



const saveWinnerToDB = (winner) => {
    const winnerInstance = new Winner({
        name: winner.weapon_name,
        amount: winner.betAmount,
        chance: winner.user.winChance,
        imageUrl: winner.user.user_avatar
    });

    winnerInstance.save(err => {
        if (err) console.error("Ошибка при сохранении победителя в базе данных:", err);
        else console.log("Победитель успешно сохранен!");
    });
}

app.post('/register', async (req, res) => {
    const schema = Joi.object({
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required()
    });

    const { error } = schema.validate(req.body);

    if (error) {
        return res.status(400).send(error.details[0].message);
    }
    try {
        const user = new User({
            name: req.body.name,
            email: req.body.email,
            password: req.body.password
        });
        await user.save();
        const token = jwt.sign({ id: user._id }, '121212', { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        console.error("Error during registration:", err.message);
        res.status(500).send("Ошибка при регистрации: " + err.message);
    }
});



app.post('/login', async (req, res) => {
    console.log('Login attempt:', req.body);

    if (!req.body.email || req.body.email.trim() === '') {
        console.error("Empty email field during login attempt");
        return res.status(400).send('Email field cannot be empty');
    }

    try {
        const user = await User.findOne({ email: req.body.email });

        if (!user) {
            console.error("User not found for email:", req.body.email);
            return res.status(400).send('Cannot find user');
        }

        if (req.body.password === user.password) {
            const token = jwt.sign({ id: user._id }, '121212', { expiresIn: '1h' });
            res.json({ token });
        } else {
            console.error("Incorrect password for email:", req.body.email);
            res.status(400).send('Not Allowed');
        }
    } catch (err) {
        console.error("Error during login:", err);
        res.status(500).send('Server error: ' + err.message);
    }
});


app.get('/getUserData', async (req, res) => {
    try {
        const token = req.headers.authorization.split(" ")[1] || req.headers.Authorization.split(" ")[1];

        if (!token) {
            console.error("Error in /getUserData: Token not provided");
            return res.status(401).json({ error: "Token required" });
        }

        const decoded = jwt.verify(token, '121212');

        if (!decoded || !decoded.id) {
            console.error("Error in /getUserData: Token decoding failed");
            return res.status(401).json({ error: "Invalid token" });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            console.error("Error in /getUserData: User not found for decoded token ID");
            return res.status(404).send('User not found');
        }

        const image = await Image.findOne({ userId: decoded.id });
        const imageUrl = image ? `${req.protocol}://${req.get('host')}/getImage/${image._id}`.toString() : null;

        res.json({
            _id: user._id,
            name: user.name,
            bio: user.bio,
            registrationDate: user.registrationDate,
            email: user.email,
            steamAccount: user.steamAccount,
            imageUrl: imageUrl
        });
    } catch (err) {
        console.error("Error in /getUserData:", err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});




app.post('/uploadImage', upload.single('userImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send("No image uploaded");
        }

        const token = req.headers.authorization || req.headers.Authorization;
        if (!token) {
            return res.status(401).json({ error: "Token required" });
        }

        const decoded = jwt.verify(token, '121212');
        if (!decoded) {
            return res.status(401).send("Invalid token");
        }

        const newImage = new Image({
            data: req.file.buffer,
            contentType: req.file.mimetype,
            userId: decoded.id
        });

        const savedImage = await newImage.save();

        const imageUrl = `/getImage/${savedImage._id}`;

        const user = await User.findById(decoded.id);
        if (user) {
            user.imageUrl = imageUrl;
            await user.save();
        }

        res.json({ imageUrl: imageUrl });
    } catch (error) {
        console.error("Error uploading image:", error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/getImage/:id', async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image) {
            return res.status(404).send("Image not found");
        }

        res.set('Content-Type', image.contentType);
        res.send(image.data);
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
});


app.post('/updateBio', async (req, res) => {
    try {
        const token = req.headers.authorization || req.headers.Authorization;
        if (!token) {
            return res.status(401).json({ error: "Token required" });
        }

        const decoded = jwt.verify(token, '121212');
        if (!decoded) {
            return res.status(401).send("Invalid token");
        }

        const user = await User.findById(decoded.id);
        if (user) {
            user.bio = req.body.bio;
            await user.save();
            res.status(200).send({ message: 'Bio updated successfully' });
        } else {
            res.status(404).send('User not found');
        }
    } catch (error) {
        console.error("Error updating bio:", error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/recordWin', async (req, res) => {
    try {
        const { winner, amount, chance } = req.body;

        if (!winner || !amount || !chance) {
            return res.status(400).send("Winner name, amount and chance are required.");
        }

        const newWinner = new Winner({
            name: winner,
            amount: amount,
            chance: chance
        });

        await newWinner.save();
        res.status(201).send({ message: "Winner recorded successfully." });
    } catch (error) {
        console.error("Error recording winner:", error);
        res.status(500).send('Internal Server Error');
    }
});




app.get('/getBalance', async (req, res) => {
    try {
        const token = req.headers.authorization || req.headers.Authorization;
        if (!token) {
            return res.status(401).json({ error: "Token required" });
        }

        const decoded = jwt.verify(token, '121212');
        if (!decoded) {
            return res.status(401).send("Invalid token");
        }

        const user = await User.findById(decoded.id);
        if (user) {
            res.json({ balance: user.balance });
        } else {
            res.status(404).send('User not found');
        }
    } catch (error) {
        console.error("Error getting balance:", error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/updateBalance', async (req, res) => {
    try {
        const token = req.headers.authorization || req.headers.Authorization;
        if (!token) {
            return res.status(401).json({ error: "Token required" });
        }

        const decoded = jwt.verify(token, '121212');
        if (!decoded) {
            return res.status(401).send("Invalid token");
        }

        const user = await User.findById(decoded.id);
        if (user) {
            const amountToAdd = Number(req.body.amount);
            user.balance += amountToAdd;
            await user.save();
            res.status(200).send('Balance updated successfully');
        } else {
            res.status(404).send('User not found');
        }
    } catch (error) {
        console.error("Error updating balance:", error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/placeBet', async (req, res) => {
    try {
        const { betAmount } = req.body;
        const token = req.headers.authorization || req.headers.Authorization;

        if (!token) {
            return res.status(401).json({ error: "Token required" });
        }

        const decoded = jwt.verify(token, '121212');
        const currentUser = await User.findById(decoded.id);

        if (!currentUser) {
            return res.status(404).send('User not found');
        }

        if (currentUser.balance < betAmount) {
            return res.status(400).send('Insufficient balance');
        }

        currentUser.balance -= betAmount;
        await currentUser.save();

        let round = await RouletteRound.findOne({ status: 'waiting' });
        if (!round) {
            round = new RouletteRound();
        }

        const image = await Image.findOne({ userId: currentUser._id });
        const imageUrl = image ? `${req.protocol}://${req.get('host')}/getImage/${image._id}`.toString() : null;

        let participant = round.participants.find(p => p.userId.toString() === currentUser._id.toString());
        if (participant) {
            participant.betAmount += betAmount;
            participant.avatarUrl = imageUrl;
        } else {
            participant = {
                userId: currentUser._id,
                betAmount,
                avatarUrl: imageUrl
            };
            round.participants.push(participant);
        }

        const totalBetAmount = round.participants.reduce((sum, participant) => sum + participant.betAmount, 0);
        round.participants.forEach(participant => {
            participant.winChance = (participant.betAmount / totalBetAmount) * 100;
        });

        const sortedParticipants = [...round.participants].sort((a, b) => b.winChance - a.winChance);
        io.emit('participants updated', sortedParticipants);
        await round.save();

        res.status(200).json({ message: 'Bet placed successfully' });
    } catch (error) {
        console.error("Error in /placeBet:", error);
        res.status(500).json({ error: 'Error placing bet' });
    }
});





app.get('/getWinners', async (req, res) => {
    try {
        const winners = await Winner.find()
            .sort({ date: -1 })
            .limit(12);

        res.json(winners);
    } catch (error) {
        console.error("Error getting winners:", error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/getLastWinner', async (req, res) => {
    try {
        const lastRound = await RouletteRound.findOne({ status: 'completed' })
            .populate('winner', 'name')
            .sort({ _id: -1 })
            .limit(1);

        if (!lastRound) {
            return res.status(404).send("No winners found");
        }

        res.json({
            name: lastRound.winner.name,
            gameBank: lastRound.gameBank
        });

    } catch (error) {
        console.error("Error getting last winner:", error);
        res.status(500).send('Internal Server Error');
    }
});



app.post('/endRound', async (req, res) => {
    try {
        let round = await RouletteRound.findOne({ status: 'waiting' });

        if (!round) {
            return res.status(400).json({ message: "No active round found" });
        }

        if (round.status === 'completed') {
            return res.status(400).json({ message: "Round already ended" });
        }

        const randomNumber = Math.random() * 100;

        let accumulatedChance = 0;
        let winner = null;
        for (let participant of round.participants) {
            accumulatedChance += participant.winChance;
            if (randomNumber <= accumulatedChance) {
                winner = participant;
                break;
            }
        }

        if (!winner) {
            return res.status(500).json({ message: "Error determining the winner" });
        }

        saveWinnerToDB(winner);

        round.status = 'completed';
        round.winner = winner.userId;
        round.gameBank = round.participants.reduce((sum, participant) => sum + participant.betAmount, 0);
        await round.save();

        const userWinner = await User.findById(winner.userId);
        const newWinner = new Winner({
            name: userWinner.name,
            amount: round.gameBank,
            chance: winner.winChance
        });
        await newWinner.save();

        res.status(200).json({ message: 'Round ended successfully', winner: winner.userId });

    } catch (error) {
        res.status(500).json({ error: 'Error ending the round' });
    }
});




io.on('connection', (socket) => {
    console.log('A user connected with id:', socket.id);

    ChatMessage.find().sort('-timestamp').limit(50).exec()
        .then(messages => {
            socket.emit('load previous messages', messages.reverse());
        })
        .catch(err => {
            console.error('Error retrieving messages:', err);
        });


    socket.on('send message', async (data) => {
        const newMessage = new ChatMessage({
            authorId: data.authorId,
            content: data.content
        });

        try {
            const savedMessage = await newMessage.save();
            io.emit('new message', savedMessage);
        } catch (err) {
            console.error('Error saving message:', err);
        }
    });


    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

