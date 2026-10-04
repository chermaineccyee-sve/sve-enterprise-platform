import * as migration_20261004_035715_initial from './20261004_035715_initial';
import * as migration_20261004_102225_b1a_editorial from './20261004_102225_b1a_editorial';
import * as migration_20261004_102349_legacy_import_hash from './20261004_102349_legacy_import_hash';
import * as migration_20261004_102625_market_state_markets_table from './20261004_102625_market_state_markets_table';

export const migrations = [
  {
    up: migration_20261004_035715_initial.up,
    down: migration_20261004_035715_initial.down,
    name: '20261004_035715_initial',
  },
  {
    up: migration_20261004_102225_b1a_editorial.up,
    down: migration_20261004_102225_b1a_editorial.down,
    name: '20261004_102225_b1a_editorial',
  },
  {
    up: migration_20261004_102349_legacy_import_hash.up,
    down: migration_20261004_102349_legacy_import_hash.down,
    name: '20261004_102349_legacy_import_hash',
  },
  {
    up: migration_20261004_102625_market_state_markets_table.up,
    down: migration_20261004_102625_market_state_markets_table.down,
    name: '20261004_102625_market_state_markets_table'
  },
];
