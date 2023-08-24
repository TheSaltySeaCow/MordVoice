import https from 'https';
import { Server as SocketIO } from 'socket.io';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const port = process.env.PORT;
const voicePassword = process.env.VOICE_PASSWORD;
const users = new Map();
const codes = new Map();
var connectedUserCount = 0;

const app = express();

const options = {
    key: fs.readFileSync(process.env.PRIVATE_KEY),
    cert: fs.readFileSync(process.env.CERT)
}

app.use(cors({
    origin: '*',
    methods: ['GET','POST']
}));

app.use(express.json());

const server = https.createServer(options, app).listen(port, () => {
    console.log('Mord Voice Server listening on port ' + port);
});

const io = new SocketIO(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    let myPlayfabId = null;
    let myCode = null;
    let authenticated = false;
    let currentRoom = null;

    connectedUserCount++;

    socket.on('disconnect', () => {
        connectedUserCount--;
        console.log(`${myPlayfabId} has disconnected from room: ${currentRoom}. User Count: ${connectedUserCount}`);

        if (myPlayfabId != null && users.has(myPlayfabId) && authenticated) {
            if (users.get(myPlayfabId) == socket)
                users.delete(myPlayfabId);
        }
    });

    socket.on('login', (data) => {
        myPlayfabId = data.id;
        myCode = data.code;
        currentRoom = data.room;
        if (myPlayfabId == null || myPlayfabId == 'null' || !myCode || !codes.has(myPlayfabId) || codes.get(myPlayfabId) !== myCode) {
            socket.emit('on-login', false);
            return;
        }
        if (users.has(myPlayfabId)) {
            users.get(myPlayfabId).emit('kicked');
            users.delete(myPlayfabId);
        }
        authenticated = true;
        users.set(myPlayfabId, socket);
        socket.join(currentRoom);
        socket.emit('on-login', true);
        console.log(`${myPlayfabId} has connected to room: ${currentRoom}. User Count: ${connectedUserCount}`);
    });

    socket.on('audio', (data) => {
        if (!authenticated) return;
        socket.broadcast.to(currentRoom).emit('voice-data', data);
    });
});

app.post('/talk', (req, res) => {
    const id = req.header('playfab');
    const talk = req.header('talk');
    const pass = req.header('pass');

    if (pass !== voicePassword) {
        res.status(200).json({ talk: talk });
        return;
    }
  
    if (users.has(id)) {
        users.get(id).emit('talk', talk);
    }
  
    res.status(200).json({ talk: talk });
});

app.post('/players', (req, res) => {
    const playerList = JSON.parse(req.header('list')).players;
    const pass = req.header('pass');
    const room = req.header('room');

    if (pass !== voicePassword) {
        res.status(200).json({ players: "false" });
        return;
    }
  
    io.in(room).emit('list', playerList);
  
    res.status(200).json({ players: "true" });
});

app.post('/already-connected', (req, res) => {
    const playfabId = req.header('playfab');
    const code = req.header('code');
    const pass = req.header('pass');

    if (pass !== voicePassword) {
        res.status(200).json({ connected: "notconnected" });
        return;
    }
  
    codes.set(playfabId, code);

    if (users.has(playfabId)) {
        res.status(200).json({ connected: "isconnected" });
        users.get(playfabId).emit('new-code', code);
    }
    else {
        res.status(200).json({ connected: "notconnected" });
    }
});

app.post('/end-play', (req, res) => {
    const reason = req.header('reason');
    const pass = req.header('pass');
    const room = req.header('room');

    if (pass !== voicePassword) {
        res.status(200).json({ endplay: "fail" });
        return;
    }

    io.in(room).emit('talk', 'false');

    res.status(200).json({ endplay: "success" });
});

app.post('/local-mute', (req, res) => {
    const ownerPlayfabId = req.header('ownerPlayfab');
    const targetPlayfabId = req.header('targetPlayfab');
    const mute = req.header('mute');
    const pass = req.header('pass');

    if (pass !== voicePassword) {
        res.status(200).json({ localmute: "fail" });
        return;
    }

    if (users.has(ownerPlayfabId)) {
        users.get(ownerPlayfabId).emit('local-mute', { target: targetPlayfabId, mute: mute });
    }

    res.status(200).json({ localmute: "success" });
});