/*
*   Game Engine
*/
require(['canvasPainter', 'playersManager', '../../sharedConstants'], function (canvasPainter, PlayersManager, Const) {

  var enumState = {
    Login: 0,
    WaitingRoom: 1,
    OnGame: 2,
    Ranking: 3
  };

  var enumPanels = {
    Login: 'gs-login',
    Ranking: 'gs-ranking',
    Error: 'gs-error'
  };

  var _gameState = enumState.Login,
      _playerManager,
      _pipeList,
      _isCurrentPlayerReady = false,
      _userID = null,
      _lastTime = null,
      _rankingTimer,
      _ranking_time,
      socket = io.connect((Const.SOCKET_ADDR + ':' + Const.SOCKET_PORT), { reconnect: false });

  function draw (currentTime, ellapsedTime) {
    canvasPainter.draw(currentTime, ellapsedTime, _playerManager.getPlayers(), _pipeList);
  }

  requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;


  function gameLoop() {
    var now = new Date().getTime(),
        ellapsedTime = 0;

    // Call for next anim frame
    if (_gameState == enumState.OnGame)
      requestAnimationFrame(gameLoop);

    // Get time difference between the last call and now
    if (_lastTime) {
      ellapsedTime = now - _lastTime;
    }
    _lastTime = now;

    // Call draw with the ellapsed time between the last frame and the current one
    draw(now, ellapsedTime);
  }

  function startClient () {

    _playerManager = new PlayersManager();

    socket.on('connect', function() {
      
      console.log('Connection established :)');
      
      // Bind disconnect event
      socket.on('disconnect', function() {
        document.getElementById('gs-error-message').innerHtml = 'Connection with the server lost';
        showHideMenu(enumPanels.Error, true);
        console.log('Connection with the server lost :( ');
      });
      
      // Draw bg and bind button click
      draw(0, 0);
      showHideMenu(enumPanels.Login, true);
      document.getElementById('player-connection').onclick = loadGameRoom;
  
    });

    socket.on('connect_failed', function() {
      document.getElementById('gs-error-message').innerHtml = 'Fail to connect the websocket';
      showHideMenu(enumPanels.Error, true);
      console.log('Cannot connect the websocket ');
    });
    
  }

  function loadGameRoom () {
    var nick = document.getElementById('player-name').value;

    if (nick == '')
      return (false);

    // Bind new events
    socket.on('player_list', function (playersList) {
      var nb = playersList.length,
          i;

      for (i = 0; i <nb; i++) {
        _playerManager.addPlayer(playersList[i], _userID);
      };

      draw(0, 0);

    });
    socket.on('player_disconnect', function (player) {
        _playerManager.removePlayer(player);
      draw(0, 0);
    });
    socket.on('new_player', function (player) {
      _playerManager.addPlayer(player);
      draw(0, 0);
    });
    socket.on('player_ready_state', function (playerInfos) {
      _playerManager.getPlayerFromId(playerInfos.id).updateFromServer(playerInfos);
    });
    socket.on('update_game_state', function (gameState) {
      changeGameState(gameState);
    });
    socket.on('game_loop_update', function (serverDatasUpdated) {
      _playerManager.updatePlayerListFromServer(serverDatasUpdated.players);
      _pipeList = serverDatasUpdated.pipes;
    });
    socket.on('ranking', function (podium, playerScore) {
      console.log(podium);
      console.log(playerScore);
      displayRanking(podium, playerScore);
    });

    // Send nickname to the server
    console.log('Send nickname ' + nick);
    socket.emit('say_hi', nick, function (serverState, uuid) {
      _userID = uuid;
      changeGameState(serverState);
    });

    // Get keyboard input
    document.addEventListener('keydown', function (event) {
        if (event.keyCode == 32) {
            inputsManager();
        }
    });

    // Hide login screen
    showHideMenu(enumPanels.Login, false);
    return (false);
  }

  function displayRanking () {
    showHideMenu(enumPanels.Ranking, true);
    

  }

  function changeGameState (gameState) {
    var strLog = 'Server just change state to ';

    _gameState = gameState;

    switch (_gameState) {
      // If we 
      case enumState.WaitingRoom:
        strLog += 'waiting in lobby';
        _isCurrentPlayerReady = false;
        // _playerManager.getCurrentPlayer().updateReadyState(_isCurrentPlayerReady);
        draw(0, 0);
        break;

      case enumState.OnGame:
        strLog += 'on game !';
        gameLoop();
        break;

      case enumState.Ranking:
        strLog += 'display ranking';
        // Start timer for next game
        _ranking_time = Const.TIME_BETWEEN_GAMES / 1000;
        _rankingTimer = window.setInterval(function() {
            // Set seconds left
            document.getElementById('gs-ranking-timer').innerHtml = _ranking_time--;
            // Stop timer if time is running up
            window.clearInterval(_rankingTimer);
          },
          1000
        );
        break;
      
      default:
        console.log('Unknew game state [' + _gameState + ']');
        strLog += 'undefined state';
        break;
    }

    console.log(strLog);
  }

  function inputsManager () {
    switch (_gameState) {
      case enumState.WaitingRoom:
        _isCurrentPlayerReady = !_isCurrentPlayerReady;
        socket.emit('change_ready_state', _isCurrentPlayerReady);
        _playerManager.getCurrentPlayer().updateReadyState(_isCurrentPlayerReady);
        break;
      case enumState.OnGame:
        socket.emit('player_jump');
        break;
      case enumState.Ranking:

        break;
      default:
        break;
    }
  }

  function showHideMenu (panelName, isShow) {
    var panel = document.getElementById(panelName),
        currentOverlayPanel = document.querySelector('.overlay');

    if (isShow) {
      if (currentOverlayPanel)
        currentOverlayPanel.remove('overlay');
      panel.classList.add('overlay');
    }
    else {
      if (currentOverlayPanel)
        currentOverlayPanel.remove('overlay');
    }
  }

  // Load ressources and Start the client !
  canvasPainter.loadRessources(function () {
    startClient();
  });

});