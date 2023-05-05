import http from 'http';
import { Server } from "socket.io";

const voicePassword = "myVoiceServerPassword";
const port = 3000;

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

var connectedUserCount = 0;
var mutedPlayers = [];
var mutedRooms = [];

io.on('connection', (socket) => {
  let currentRoom = "none";
  let currentName = "none";
  let currentUserId = "none";

  connectedUserCount++;

  socket.on('disconnect', () => {
    connectedUserCount--;
    console.log(`[${currentUserId}] ${currentName} has disconnected from room: ${currentRoom}. User Count: ${connectedUserCount}`);
  });

  socket.on('pU', (data) => {
    if (currentRoom == "none") {
      return;
    }

    socket.broadcast.to(currentRoom).emit('pU', data);
  });

  socket.on("upload", async (uploadData) => {

    if (uploadData == null || uploadData.audioFile == null || uploadData.audioFile.length <= 0 || currentRoom == "none" || mutedPlayers.includes(currentUserId) || mutedRooms.includes(currentRoom)) {
      return;
    }

    const sendData = { userId: currentUserId, pName: currentName, voicePacket: uploadData.audioFile, isInit: uploadData.init };
    socket.broadcast.to(currentRoom).emit('voice-data', sendData);
  });

  socket.on("room", (roomInfo) => {
    currentRoom = roomInfo.room;
    currentName = roomInfo.playerName;
    currentUserId = roomInfo.playerId;

    if (!roomInfo.voicePassword || roomInfo.voicePassword != voicePassword) {
      console.log(`[${currentUserId}] ${currentName} attempted to join {${currentRoom}} with an incorrect password!`);
      socket.disconnect();
      currentRoom = "none";
      return;
    }

    socket.join(currentRoom);

    console.log(`[${currentUserId}] ${currentName} has connected to room: ${currentRoom}. User Count: ${connectedUserCount}`);
  });

  socket.on("vMute", (playfabId) => {
    if (currentRoom == "none") {
      return;
    }

    if (playfabId == "all") {
      if (!mutedRooms.includes(currentRoom)) {
        mutedRooms.push(currentRoom);
      }
    }
    else if (!mutedPlayers.includes(playfabId)) {
      mutedPlayers.push(playfabId);
    }
  });

  socket.on("vUnmute", (playfabId) => {
    if (currentRoom == "none") {
      return;
    }

    if (playfabId == "all") {
      if (mutedRooms.includes(currentRoom)) {
        mutedRooms = mutedRooms.filter(function(e) { return e !== currentRoom });
      }
    }
    else if (mutedPlayers.includes(playfabId)) {
      mutedPlayers = mutedPlayers.filter(function(e) { return e !== playfabId });
    }
  });
});

server.listen(port, () => {
  console.log('Mord Voice Server listening on port ' + port);
});