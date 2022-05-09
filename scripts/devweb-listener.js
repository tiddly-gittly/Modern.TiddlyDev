(function () {
  /*jslint node: true, browser: true */
  /*global $tw: false */
  'use strict';

  // Export name and synchronous status
  exports.name = 'devweb-listner';
  exports.platforms = ['browser'];
  exports.after = ['load-modules'];
  exports.synchronous = true;
  exports.startup = function () {
    if (!window.WebSocket) return;
    var port = $tw.wiki.getTiddlerText('$:/Modern.TiddlyDev/devWebsocket/port');
    var host = document.location.hostname;
    var socket = new WebSocket('ws://' + host + ':' + port);
    /*
     * Note: socket.send('pong') will not work,
     *       and onmessage will not handle ping message.
     *       Since broswer can handle ping/pong automatically.
     *       You should just focus ping/pong check on server side,
     *       See: https://javascript.info/websocket  */
    socket.onopen = function () {
      console.debug('[Modern.TiddlyDev]', 'Dev WebSocket connected, this web page can refresh automatically.');
    };
    socket.onmessage = function (event) {
      switch (event.data) {
        case 'bye': {
          socket.close();
          break;
        }
        case 'refresh': {
          socket.close();
          document.location.reload();
          break;
        }
      }
    };
    socket.onclose = function () {
      console.error('[Modern.TiddlyDev]', 'Dev WebSocket closed, this web page will no longer refresh automatically.');
    };
  };
})();
