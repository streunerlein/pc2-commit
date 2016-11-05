
module.exports = {
  supervisor: {
    host: 'localhost',
    port: 9000
  },
  coordinator: {
    id: 'coordinator',
    host: 'localhost',
    debug: {
      port: 8001
    }
  },
  nodes: {
    'node0': {
      id: 'node0',
      host: 'localhost',
      debug: {
        port: 8010
      }
    },
    'node1': {
      id: 'node1',
      host: 'localhost',
      debug: {
        port: 8011
      }
    }
  }
};