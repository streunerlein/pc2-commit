
module.exports = {
  supervisor: {
    host: '46.101.241.144',
    port: 9000,
    geo: 'Frankfurt'
  },
  coordinator: {
    id: 'coordinator',
    host: '46.101.241.144',
    debug: {
      port: 8001
    },
    geo: 'Frankfurt'
  },
  nodes: {
    'node0': {
      id: 'node0',
      host: '45.55.65.163',
      debug: {
        port: 8010
      },
      geo: 'New York City'
    },
    'node1': {
      id: 'node1',
      host: '128.199.162.96',
      debug: {
        port: 8011
      },
      geo: 'Singapur'
    }
  }
};