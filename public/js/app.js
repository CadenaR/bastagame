let waitingRoom = $("#waitingRoom");
let playerName = $("#playerName");
let startBtn = $("#startBtn");
let gameRoom = $("#gameRoom");
let letter = $("#letter");
let name = $("#name");
let color = $("#color");
let fruit = $("#fruit");
let bastaBtn = $("#bastaBtn");
let podium = $("#podium");
let podiumName = $("#podiumPlayerName")
let winner = $("#winner");
let delivered = false;

function makeToastMessage(message) {
  $.toast({
    text: message,
    position: "top-center",
  });
}

window.socket = null;
function connectToSocketIo() {
  let server = window.location.protocol + "//" + window.location.host;
  window.socket = io.connect(server);
  // Recibe un mensaje de tipo toast
  window.socket.on("toast", function (data) {
    // Muestra el mensaje
    makeToastMessage(data.message);
  });

  window.socket.on("init", function (data) {
    setName(data.playerName);
  });

  window.socket.on("start:button", function () {
    activateStartButton();
  });

  window.socket.on("button:disable", function () {
    disable();
  });

  window.socket.on("button:hide", function () {
    hideStartBtn();
  });

  window.socket.on("start:game", function () {
    switchToGame();
  });

  window.socket.on("timer", function (data) {
    startGameTimer(data.time);
  });

  window.socket.on("letter", function (data) {
    changeLetter(data.letter);
  });

  window.socket.on("game:stop", function () {
    stopGame();
  });

  window.socket.on("game:winner", function (data) {
    setWinner(data.winner);
  });

  window.socket.on("finish", function () {
    exitRoom();
  });
}

function setName(pName) {
  playerName.text(pName);
  podiumName.text(pName);
}

function activateStartButton() {
  startBtn.show();
}

function hideStartBtn() {
  startBtn.hide();
}

function startGame() {
  startBtn.prop("disabled", true);
  window.socket.emit("server:start:game");
}

function disable() {
  startBtn.prop("disabled", true);
}

function switchToGame() {
  window.socket.emit("joinMe");
  startBtn.prop("disabled", false);
  startBtn.hide();
  waitingRoom.hide();
  bastaBtn.hide();
  gameRoom.show();
  name.val("");
  color.val("");
  fruit.val("");
}

function startGameTimer(t) {
  letter.text(t);
}

function changeLetter(chr) {
  letter.text(chr);
  bastaBtn.show();
}

function submitAnswers() {
  if (name.val() && color.val() && fruit.val()) {
    let ans = { name: name.val(), color: color.val(), fruit: fruit.val() };
    delivered = true;
    window.socket.emit("server:basta", { ans: ans });
    bastaBtn.hide();
  } else {
    makeToastMessage("Fill all the fields");
  }
}

function stopGame() {
  if (!delivered) {
    bastaBtn.hide();
    let ans = { name: name.val(), color: color.val(), fruit: fruit.val() };

    window.socket.emit("server:game:stop", { ans: ans });
  }
}

function setWinner(gameWinner) {
  winner.text(gameWinner);
  podium.show();
  letter.text("Ready?");
  gameRoom.hide();
}

function endGame() {
  window.socket.emit("server:exit");
}

function exitRoom() {
  window.socket.emit("kickMe");
  waitingRoom.show();
  gameRoom.hide();
  podium.hide();
  delivered = false;
}

$(function () {
  connectToSocketIo();
  gameRoom.hide();
  podium.hide();
});
