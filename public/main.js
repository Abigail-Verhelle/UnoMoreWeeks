const socket = io({autoConnect: false});
const canvas = document.getElementById('canvas');;
const ctx = canvas.getContext('2d');
​
const cdWidth = 240;
const cdHeight = 360;
const cards = new Image();
const back = new Image();
​
let room;
let hand = [];
let turn;
let playerName;

function setCookie(name, value, seconds) {
    let date = new Date();
    date.setTime(date.getTime() + (seconds * 1000));
    let expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
  }
  ​
  function getCookie(name) {
    name += "=";
    let cookies = document.cookie.split(';');
    for(let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i];
      while (cookie.charAt(0) == ' ') {
        cookie = cookie.substring(1);
      }
      if (cookie.indexOf(name) == 0) {
        return cookie.substring(name.length, cookie.length);
      }
    }
    return null;
  }

  function init() {
    ctx.font = "12px Arial";
    canvas.style.backgroundColor = '#10ac84';
    cards.src = 'images/deck.svg';
    back.src = 'images/uno.svg';
  ​
    document.addEventListener('touchstart', onMouseClick, false);
    document.addEventListener('click', onMouseClick, false);
  ​
    playerName = getCookie('playerName');
    if (playerName == null) {
      playerName = prompt('Enter your name: ', 'Guest');
      if (playerName == null || playerName == "") {
        playerName = 'Guest';
      }
      setCookie('playerName', playerName, 24 * 3600);
    }
  ​
    socket.connect();
  }

socket.on('connect', requestRoom);
​
function requestRoom() {
  socket.emit('requestRoom', playerName);
  room = 0;
  hand = [];
  turn = false;
  console.log('>> Room Request');
}

socket.on('responseRoom', function (name) {
    if (name != 'error') {
      room = name;
      console.log('<< Room Response: ' + name);
      ctx.fillText(name, 0, 10);
      ctx.drawImage(back, canvas.width-cdWidth/2-60, canvas.height/2-cdHeight/4, cdWidth/2, cdHeight/2);
      ctx.fillText(playerName, 100, 390);
    } else {
      socket.disconnect();
      alert('Rooms are full! Try again later');
    }
  });
  ​
  socket.on('countDown', function(countDown) {
    ctx.clearRect(0, 10, 15, 10);
    ctx.fillText(countDown, 0, 20);
  });

  socket.on('turnPlayer', function(data) {
    if (data == socket.id) {
      turn = true;
      console.log('<< Your turn');
    } else {
      turn = false;
      console.log('<< Not your turn');
    }
  });
  ​
  socket.on('haveCard', function(nums) {
    hand = nums;
    ctx.clearRect(0, 400, canvas.width, canvas.height);
    for (let i = 0; i < hand.length; i++) {
      ctx.drawImage(cards, 1+cdWidth*(hand[i]%14), 1+cdHeight*Math.floor(hand[i]/14), cdWidth, cdHeight, (hand.length/112)*(cdWidth/3)+(canvas.width/(2+(hand.length-1)))*(i+1)-(cdWidth/4), 400, cdWidth/2, cdHeight/2);
      console.log('<< Have card: ' + hand[i]);
    }
  });

  socket.on('playerDisconnect', function() {
    console.log('<< Player disconnected in ' + room);
  });

  socket.on('playerDisconnect', function() {
    console.log('<< Player disconnected in ' + room);
  });

  function onMouseClick(e) {
    let lastCard = canvas.offsetLeft + (hand.length/112)*(cdWidth/3)+(canvas.width/(2+(hand.length-1)))*(hand.length)-(cdWidth/4)+cdWidth/2;
    let initCard = canvas.offsetLeft + 2 + (hand.length/112)*(cdWidth/3)+(canvas.width/(2+(hand.length-1)))-(cdWidth/4);
  ​
    if (e.pageY >= 400 && e.pageY <= 580 && e.pageX >= initCard && e.pageX <= lastCard) {
      for (let i = 0, pos = initCard; i < hand.length; i++, pos += canvas.width/(2+(hand.length-1))) {
        if (e.pageX >= pos && e.pageX <= pos+canvas.width/(2+(hand.length-1))) {
          debugArea(pos, pos+canvas.width/(2+(hand.length-1)), 400, 580);
          socket.emit('playCard', [hand[i], room]);
          return;
        }
      }
    } else if (e.pageX >= canvas.width-cdWidth/2-60 &&  e.pageX <= canvas.width-60 &&
      e.pageY >= canvas.height/2-cdHeight/4 && e.pageY <= canvas.height/2+cdHeight/4) {
      socket.emit('drawCard', [1, room]);
    }
  }

  socket.on('drawCard', function(res) {
	let numPlayer = data[res[1]]['turn'];
	let idPlayer = data[res[1]]['players'][numPlayer]['id'];
	let namePlayer = data[res[1]]['players']['name'];
	let handPlayer = data[res[1]]['players'][numPlayer]['hand'];
	let deck = data[res[1]]['deck'];
​
	if (idPlayer == socket.id) {
		let card = parseInt(deck.shift());
		handPlayer.push(card);
      io.to(idPlayer).emit('haveCard', handPlayer);
      //deck.push(card);
      // TODO: Check playable card
      //Next turn
      numPlayer = Math.abs(numPlayer + (-1) ** data[res[1]]['reverse']) % data[res[1]]['people'];
      data[res[1]]['turn'] = numPlayer;
      io.to(res[1]).emit('turnPlayer', data[res[1]]['players'][numPlayer]['id']);
    }
  });

  socket.on('playCard', function(res) {
    let numPlayer = data[res[1]]['turn'];
    let idPlayer = data[res[1]]['players'][numPlayer]['id'];
    let namePlayer = data[res[1]]['players']['name'];
    let handPlayer = data[res[1]]['players'][numPlayer]['hand'];
    let deck = data[res[1]]['deck'];
​
    if (idPlayer == socket.id) {
      let playedColor = cardColor(res[0]);
      let playedNumber = res[0] % 14;
​
      let boardColor = cardColor(data[res[1]]['cardOnBoard']);
      let boardNumber = data[res[1]]['cardOnBoard'] % 14;
​
      if (playedColor == 'black' || playedColor == boardColor || playedNumber == boardNumber) {
        // Play card
        io.to(res[1]).emit('sendCard', res[0]);
        data[res[1]]['cardOnBoard'] = res[0];
        // Remove card
        let cardPos = handPlayer.indexOf(res[0]);
        if (cardPos > -1) {
          handPlayer.splice(cardPos, 1);
        }
        io.to(idPlayer).emit('haveCard', handPlayer);
​
        // Next turn
        let skip = 0;
        if (cardType(res[0]) == 'Skip') {
          skip += 1;
        } else if (cardType(res[0]) == 'Reverse') {
          data[res[1]]['reverse'] = (data[res[1]]['reverse'] + 1) % 2;
        } else if (cardType(res[0]) == 'Draw2') {
          skip += 1;
          //draw2
        } else if (cardType(res[0]) == 'Draw4') {
          skip += 1;
          //draw4
        }
        numPlayer = Math.abs(numPlayer + (-1) ** data[res[1]]['reverse'] * (1 + skip)) % data[res[1]]['people'];
        data[res[1]]['turn'] = numPlayer;
        io.to(res[1]).emit('turnPlayer', data[res[1]]['players'][numPlayer]['id']);
​
      }
    }
  });


  socket.on('haveCard', function(nums) {
    hand = nums;
    ctx.clearRect(0, 400, canvas.width, canvas.height);
    for (let i = 0; i < hand.length; i++) {
      ctx.drawImage(cards, 1+cdWidth*(hand[i]%14), 1+cdHeight*Math.floor(hand[i]/14), cdWidth, cdHeight, (hand.length/112)*(cdWidth/3)+(canvas.width/(2+(hand.length-1)))*(i+1)-(cdWidth/4), 400, cdWidth/2, cdHeight/2);
      console.log('<< Have card: ' + hand[i]);
    }
  });

  socket.on('sendCard', function(num) {
    ctx.drawImage(cards, 1+cdWidth*(num%14), 1+cdHeight*Math.floor(num/14), cdWidth, cdHeight, canvas.width/2-cdWidth/4, canvas.height/2-cdHeight/4, cdWidth/2, cdHeight/2);
  });
