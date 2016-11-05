
module.exports = {
  commDelay: 0,
  supervisor: {
    host: 'localhost',
    port: 9000,
    geo: 'Your computer'
  },
  coordinator: {
    id: 'coordinator',
    host: 'localhost',
    debug: {
      port: 8001
    },
    geo: 'Your computer'
  },
  nodes: {
    'node0': {
      id: 'node0',
      host: 'localhost',
      debug: {
        port: 8010
      },
      geo: 'Your computer'
    },
    'node1': {
      id: 'node1',
      host: 'localhost',
      debug: {
        port: 8011
      },
      geo: 'Your computer'
    }
  }
};