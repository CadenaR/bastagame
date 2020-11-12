// Imports
const express = require("express");
const webRoutes = require("./routes/web");

// Session imports
let cookieParser = require("cookie-parser");
let session = require("express-session");
let flash = require("express-flash");
let passport = require("passport");

// Express app creation
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);

// Configurations
const appConfig = require("./configs/app");

// View engine configs
const exphbs = require("express-handlebars");
const hbshelpers = require("handlebars-helpers");
const { clearInterval } = require("timers");
const { finished } = require("stream");
const { max } = require("./database/connection");
const multihelpers = hbshelpers();
const extNameHbs = "hbs";
const hbs = exphbs.create({
  extname: extNameHbs,
  helpers: multihelpers,
});
app.engine(extNameHbs, hbs.engine);
app.set("view engine", extNameHbs);

// Session configurations
let sessionStore = new session.MemoryStore();
app.use(cookieParser());
app.use(
  session({
    cookie: { maxAge: 60000 },
    store: sessionStore,
    saveUninitialized: true,
    resave: "true",
    secret: appConfig.secret,
  })
);
app.use(flash());

// Passport configurations
require("./configs/passport");
app.use(passport.initialize());
app.use(passport.session());

// Receive parameters from the Form requests
app.use(express.urlencoded({ extended: true }));

// Route for static files
app.use("/", express.static(__dirname + "/public"));

// Routes
app.use("/", webRoutes);

/**
 * Websocket handling
 */
var timer;
var playerHistoryCount = 0;
var players = {};
var roomPlayers = {};
var letter = "";
var winner = [];
var basta = false;
var end = false;
var finishedPlayers = 0;
var maxScore = 0;

io.on("connection", (socket) => {
  console.log("Client " + socket.id + " connected...");

  playerHistoryCount++;
  players[socket.id] = {
    pName: playerHistoryCount,
    name: "",
    color: "",
    fruit: "",
    score: 0,
  };

  // Welcome player
  socket.emit("toast", { message: `Hi player ${players[socket.id].pName}` });
  //Notify all players that a new player has entered the game
  socket.broadcast.emit("toast", {
    message: `Player ${players[socket.id].pName} has joined`,
  });

  // Set player name
  socket.emit("init", {
    playerName: `Player ${players[socket.id].pName}`,
  });

  //Show start button
  if (Object.keys(roomPlayers).length == 0) {
    if (Object.keys(players).length > 1) {
      io.sockets.emit("start:button");
    }
  }

  // Start game
  socket.on("server:start:game", () => {
    io.sockets.emit("button:disable");

    // Wait 2 seconds to start
    setTimeout(function () {
      io.sockets.emit("start:game");
      roomPlayers = players;
      players = {};

      var i = 3;
      var timer = setInterval(() => {
        io.to("gameRoom").emit("timer", { time: i });
        i--;
        if (i == 0) clearInterval(timer);
      }, 1000);

      setTimeout(function () {
        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        var charsLength = chars.length;
        letter = chars.charAt(Math.floor(Math.random() * charsLength));

        io.to("gameRoom").emit("letter", { letter: letter });
      }, 4000);
    }, 2000);
  });

  socket.on("joinMe", () => {
    socket.join("gameRoom");
  });

  socket.on("kickMe", () => {
    socket.leave("gameRoom");
    players[socket.id] = {
      pName: roomPlayers[socket.id].pName,
      name: "",
      color: "",
      fruit: "",
      score: 0,
    };
    delete roomPlayers[socket.id];
    if (Object.keys(players).length > 1) {
      io.sockets.emit("start:button");
    }
  });

  socket.on("server:basta", (data) => {
    if (basta) {
      roomPlayers[socket.id].name = data.ans.name;
      roomPlayers[socket.id].color = data.ans.color;
      roomPlayers[socket.id].fruit = data.ans.fruit;

      finishedPlayers++;

      if (Object.keys(roomPlayers).length == finishedPlayers) {
        clearInterval(timer);
        end = true;
        calculateWinner();
      }
    } else {
      roomPlayers[socket.id].name = data.ans.name;
      roomPlayers[socket.id].color = data.ans.color;
      roomPlayers[socket.id].fruit = data.ans.fruit;

      finishedPlayers++;
      basta = true;
      io.to("gameRoom").emit("toast", { message: "BASTA!" });
      var i = 1;
      timer = setInterval(() => {
        io.to("gameRoom").emit("toast", { message: `BASTA ${i}` });
        i++;
        if (i == 11) clearInterval(timer);
      }, 1000);

      setTimeout(function () {
        if (!end) io.to("gameRoom").emit("game:stop");
      }, 11000);
    }
  });

  socket.on("server:game:stop", (data) => {
    roomPlayers[socket.id].name = data.ans.name;
    roomPlayers[socket.id].color = data.ans.color;
    roomPlayers[socket.id].fruit = data.ans.fruit;

    finishedPlayers++;

    if (Object.keys(roomPlayers).length == finishedPlayers) {
      calculateWinner();
    }
  });

  socket.on("server:exit", () => {
    setTimeout(function () {
      io.to("gameRoom").emit("finish");
      resetValues();
    }, 3000);
  });

  socket.on("disconnect", () => {
    if (socket.id in players) {
      socket.broadcast.emit("toast", {
        message: `Player ${players[socket.id].pName} has left`,
      });
      delete players[socket.id];
      if (Object.keys(players).length == 1) {
        io.sockets.emit("button:hide");
      }
    } else {
      socket.broadcast.emit("toast", {
        message: `Player ${roomPlayers[socket.id].pName} has left`,
      });
      delete roomPlayers[socket.id];
      if (Object.keys(roomPlayers).length == 1) {
        io.to("gameRoom").emit("toast", { message: "No players left" });
        io.to("gameRoom").emit("finish");
        resetValues();
      }
    }
  });
});

// App init
server.listen(appConfig.expressPort, () => {
  console.log(
    `Server is listenning on ${appConfig.expressPort}! (http://localhost:${appConfig.expressPort})`
  );
});

function calculateWinner() {
  Object.keys(roomPlayers).forEach((key) => {
    var p = roomPlayers[key];
    if (p.name.length > 1 && p.name.charAt(0).toUpperCase() == letter) {
      repeated = false;
      Object.keys(roomPlayers).forEach((key2) => {
        if (key2 != key) {
          if (roomPlayers[key2].name == p.name) {
            repeated = true;
          }
        }
      });
      if (repeated) {
        roomPlayers[key].score += 50;
      } else {
        roomPlayers[key].score += 100;
      }
    }

    if (p.color.length > 1 && p.color.charAt(0).toUpperCase() == letter) {
      repeated = false;
      Object.keys(roomPlayers).forEach((key2) => {
        if (key2 != key) {
          if (roomPlayers[key2].color == p.color) {
            repeated = true;
          }
        }
      });
      if (repeated) {
        roomPlayers[key].score += 50;
      } else {
        roomPlayers[key].score += 100;
      }
    }

    if (p.fruit.length > 1 && p.fruit.charAt(0).toUpperCase() == letter) {
      repeated = false;
      Object.keys(roomPlayers).forEach((key2) => {
        if (key2 != key) {
          if (roomPlayers[key2].fruit == p.fruit) {
            repeated = true;
          }
        }
      });
      if (repeated) {
        roomPlayers[key].score += 50;
      } else {
        roomPlayers[key].score += 100;
      }
    }

    if (roomPlayers[key].score > maxScore) {
      maxScore = roomPlayers[key].score;
    }
  });

  Object.keys(roomPlayers).forEach((key) => {
    if (roomPlayers[key].score == maxScore) {
      winner.push(key);
    }
  });

  if (winner.length > 1) {
    sendWinner("Tie");
  } else {
    sendWinner(`The winner is Player ${roomPlayers[winner[0]].pName}`);
  }
}

function sendWinner(message) {
  io.to("gameRoom").emit("game:winner", { winner: message });
}

function resetValues() {
  basta = false;
  end = false;
  finishedPlayers = 0;
  maxScore = 0;
  winner = [];
}
