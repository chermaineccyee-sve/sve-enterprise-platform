import * as migration_20261004_035715_initial from './20261004_035715_initial';

export const migrations = [
  {
    up: migration_20261004_035715_initial.up,
    down: migration_20261004_035715_initial.down,
    name: '20261004_035715_initial'
  },
];
