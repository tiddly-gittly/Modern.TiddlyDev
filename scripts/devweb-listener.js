'use strict';
(function () {
  // Export name and synchronous status
  exports.name = 'devweb-listner';
  exports.platforms = ['browser'];
  exports.after = ['load-modules'];
  exports.synchronous = true;
  exports.startup = function () {
    const ws =
      // eslint-disable-next-line no-nested-ternary
      typeof globalThis === 'undefined'
        ? typeof window === 'undefined'
          ? undefined
          : // eslint-disable-next-line no-undef
            window.WebSocket
        : globalThis.WebSocket;
    if (ws === undefined) {
      console.error(
        '[Modern.TiddlyDev]',
        'Unsupported broswer, need WebSocket support',
      );
    }
    // eslint-disable-next-line no-undef
    const port = $$$$port$$$$;
    // eslint-disable-next-line no-undef
    const host = document.location.hostname;
    // eslint-disable-next-line no-undef
    const socket = new WebSocket(`ws://${host}:${port}`);
    /*
     * Note: socket.send('pong') will not work,
     *       and onmessage will not handle ping message.
     *       Since broswer can handle ping/pong automatically.
     *       You should just focus ping/pong check on server side,
     *       See: https://javascript.info/websocket  */
    socket.onopen = () => {
      // eslint-disable-next-line no-console
      console.debug(
        '[Modern.TiddlyDev]',
        'Dev WebSocket connected, this web page can refresh automatically.',
      );
    };
    socket.onmessage = event => {
      switch (event.data) {
        case 'bye': {
          socket.close();
          break;
        }
        case 'refresh': {
          socket.close();
          // eslint-disable-next-line no-undef
          document.location.reload();
          break;
        }
        default: {
          break;
        }
      }
    };
    socket.onclose = () => {
      console.error(
        '[Modern.TiddlyDev]',
        'The development server has disconnected. Refresh the page if necessary.',
      );
    };
  };
})();
