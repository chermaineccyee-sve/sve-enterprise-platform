import * as migration_20261004_035715_initial from './20261004_035715_initial';
import * as migration_20261004_102225_b1a_editorial from './20261004_102225_b1a_editorial';
import * as migration_20261004_102349_legacy_import_hash from './20261004_102349_legacy_import_hash';
import * as migration_20261004_102625_market_state_markets_table from './20261004_102625_market_state_markets_table';
import * as migration_20261004_162930_structured_insight_blocks from './20261004_162930_structured_insight_blocks';
import * as migration_20261004_171724_media_public_delivery from './20261004_171724_media_public_delivery';
import * as migration_20261004_172404_media_storage_fields from './20261004_172404_media_storage_fields';
import * as migration_20261005_063521_insight_cover_visual from './20261005_063521_insight_cover_visual';

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
    name: '20261004_102625_market_state_markets_table',
  },
  {
    up: migration_20261004_162930_structured_insight_blocks.up,
    down: migration_20261004_162930_structured_insight_blocks.down,
    name: '20261004_162930_structured_insight_blocks',
  },
  {
    up: migration_20261004_171724_media_public_delivery.up,
    down: migration_20261004_171724_media_public_delivery.down,
    name: '20261004_171724_media_public_delivery',
  },
  {
    up: migration_20261004_172404_media_storage_fields.up,
    down: migration_20261004_172404_media_storage_fields.down,
    name: '20261004_172404_media_storage_fields',
  },
  {
    up: migration_20261005_063521_insight_cover_visual.up,
    down: migration_20261005_063521_insight_cover_visual.down,
    name: '20261005_063521_insight_cover_visual'
  },
];
