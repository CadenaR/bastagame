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

playerHistoryCount = 0;
players = {};
roomPlayers = {};
inGame = false;

io.on("connection", (socket) => {
  // Recibe la conexión del cliente
  console.log("Client " + socket.id + " connected...");

  playerHistoryCount++;
  players[socket.id] = {
    pName: playerHistoryCount,
    name: "",
    color: "",
    fruit: "",
    score: 0
  };

  socket.emit("toast", { message: `Hi player ${players[socket.id].pName}` });
  socket.broadcast.emit("toast", {
    message: `Player ${players[socket.id].pName} has joined`,
  });

  socket.emit("init", {
    playerName: `Player ${players[socket.id].pName}`,
  });

  if (Object.keys(roomPlayers).length == 0) {
    if (Object.keys(players).length > 1) {
      io.sockets.emit("start:button");
    }
  }

  socket.on("server:start:game", () => {
    io.sockets.emit("button:disable");

    let i = 3;
    var timer = setInterval(() => {
      io.sockets.emit("toast", { message: i });
      i--;
      if (i == 0) clearInterval(timer);
    }, 1000);

    setTimeout(function () {
      io.sockets.emit("start:game");
      roomPlayers = players;
      players = {};
    }, 4000);
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
      score: 0
    };
    delete roomPlayers[socket.id];
  });

  // Recibe un mensaje
  socket.on("messageToServer", (data) => {
    console.log("messageReceivedFromClient: ", data.text);
  });

  socket.on("disconnect", () => {
    if (socket.id in players) {
      socket.broadcast.emit("toast", {
        message: `Player ${players[socket.id]["pName"]} has left`,
      });
      delete players[socket.id];
      if (Object.keys(players).length == 1) {
        io.sockets.emit("button:hide")
      }
    } else {
      socket.broadcast.emit("toast", {
        message: `Player ${roomPlayers[socket.id]["pName"]} has left`,
      });
      delete roomPlayers[socket.id];
      if (Object.keys(roomPlayers).length == 1) {
        io.to("gameRoom").emit("toast", { message: 'No players left' });
        io.to("gameRoom").emit("finish");
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
