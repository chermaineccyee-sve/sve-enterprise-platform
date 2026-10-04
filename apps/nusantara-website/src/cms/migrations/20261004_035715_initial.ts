import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."markets" AS ENUM('klci', 'sti', 'jci', 'nikkei', 'hsi', 'spx', 'nasdaq', 'usdmyr', 'usdsgd', 'usdidr', 'sgdmyr', 'eurusd', 'usdcnh', 'usdjpy', 'us10y', 'us2y', 'mgs10y', 'jgb10y', 'sgs10y', 'gold', 'silver', 'brent', 'cpo', 'copper');
  CREATE TYPE "public"."enum_insights_blocks_layer_layer" AS ENUM('data', 'interpretation', 'implication');
  CREATE TYPE "public"."enum_insights_blocks_table_layer" AS ENUM('data', 'interpretation', 'implication');
  CREATE TYPE "public"."enum_insights_blocks_chart_kind" AS ENUM('line', 'bar');
  CREATE TYPE "public"."enum_insights_markets" AS ENUM('klci', 'sti', 'jci', 'nikkei', 'hsi', 'spx', 'nasdaq', 'usdmyr', 'usdsgd', 'usdidr', 'sgdmyr', 'eurusd', 'usdcnh', 'usdjpy', 'us10y', 'us2y', 'mgs10y', 'jgb10y', 'sgs10y', 'gold', 'silver', 'brent', 'cpo', 'copper');
  CREATE TYPE "public"."enum_insights_asset_classes" AS ENUM('Equities', 'Fixed income', 'Currencies', 'Commodities', 'Private credit', 'Private markets', 'Real assets', 'Alternatives', 'Multi-asset');
  CREATE TYPE "public"."enum_insights_market_state_dimensions" AS ENUM('growth', 'rates', 'liquidity', 'risk', 'currencies', 'commodities');
  CREATE TYPE "public"."enum_insights_indicators" AS ENUM('am-assets', 'am-alt-share', 'pm-fundraising', 'pm-undeployed', 'pm-credit', 'alt-real-assets', 'alt-precious', 'cf-portfolio', 'cf-direct', 'pw-pool', 'pw-advised', 'fo-formation', 'inst-alts', 'macro-growth', 'macro-inflation', 'macro-policy');
  CREATE TYPE "public"."enum_insights_category" AS ENUM('Market Outlook', 'Investment Perspectives', 'Macro & Markets', 'Alternative Investments', 'Private Markets', 'Governance & Allocation', 'Research Notes');
  CREATE TYPE "public"."enum_insights_hero_motif" AS ENUM('arcs', 'lines', 'grid', 'bars', 'rings');
  CREATE TYPE "public"."enum_insights_workflow_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum_insights_content_class" AS ENUM('illustrative', 'management_review', 'approved_corporate');
  CREATE TYPE "public"."enum_insights_legacy_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum_insights_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__insights_v_blocks_layer_layer" AS ENUM('data', 'interpretation', 'implication');
  CREATE TYPE "public"."enum__insights_v_blocks_table_layer" AS ENUM('data', 'interpretation', 'implication');
  CREATE TYPE "public"."enum__insights_v_blocks_chart_kind" AS ENUM('line', 'bar');
  CREATE TYPE "public"."enum__insights_v_version_markets" AS ENUM('klci', 'sti', 'jci', 'nikkei', 'hsi', 'spx', 'nasdaq', 'usdmyr', 'usdsgd', 'usdidr', 'sgdmyr', 'eurusd', 'usdcnh', 'usdjpy', 'us10y', 'us2y', 'mgs10y', 'jgb10y', 'sgs10y', 'gold', 'silver', 'brent', 'cpo', 'copper');
  CREATE TYPE "public"."enum__insights_v_version_asset_classes" AS ENUM('Equities', 'Fixed income', 'Currencies', 'Commodities', 'Private credit', 'Private markets', 'Real assets', 'Alternatives', 'Multi-asset');
  CREATE TYPE "public"."enum__insights_v_version_market_state_dimensions" AS ENUM('growth', 'rates', 'liquidity', 'risk', 'currencies', 'commodities');
  CREATE TYPE "public"."enum__insights_v_version_indicators" AS ENUM('am-assets', 'am-alt-share', 'pm-fundraising', 'pm-undeployed', 'pm-credit', 'alt-real-assets', 'alt-precious', 'cf-portfolio', 'cf-direct', 'pw-pool', 'pw-advised', 'fo-formation', 'inst-alts', 'macro-growth', 'macro-inflation', 'macro-policy');
  CREATE TYPE "public"."enum__insights_v_version_category" AS ENUM('Market Outlook', 'Investment Perspectives', 'Macro & Markets', 'Alternative Investments', 'Private Markets', 'Governance & Allocation', 'Research Notes');
  CREATE TYPE "public"."enum__insights_v_version_hero_motif" AS ENUM('arcs', 'lines', 'grid', 'bars', 'rings');
  CREATE TYPE "public"."enum__insights_v_version_workflow_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum__insights_v_version_content_class" AS ENUM('illustrative', 'management_review', 'approved_corporate');
  CREATE TYPE "public"."enum__insights_v_version_legacy_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum__insights_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_nusantara_views_related_markets" AS ENUM('klci', 'sti', 'jci', 'nikkei', 'hsi', 'spx', 'nasdaq', 'usdmyr', 'usdsgd', 'usdidr', 'sgdmyr', 'eurusd', 'usdcnh', 'usdjpy', 'us10y', 'us2y', 'mgs10y', 'jgb10y', 'sgs10y', 'gold', 'silver', 'brent', 'cpo', 'copper');
  CREATE TYPE "public"."enum_nusantara_views_market_state_dimensions" AS ENUM('growth', 'rates', 'liquidity', 'risk', 'currencies', 'commodities');
  CREATE TYPE "public"."enum_nusantara_views_subject_kind" AS ENUM('instrument', 'assetClass', 'indicator');
  CREATE TYPE "public"."enum_nusantara_views_subject_instrument" AS ENUM('klci', 'sti', 'jci', 'nikkei', 'hsi', 'spx', 'nasdaq', 'usdmyr', 'usdsgd', 'usdidr', 'sgdmyr', 'eurusd', 'usdcnh', 'usdjpy', 'us10y', 'us2y', 'mgs10y', 'jgb10y', 'sgs10y', 'gold', 'silver', 'brent', 'cpo', 'copper');
  CREATE TYPE "public"."enum_nusantara_views_subject_asset_class" AS ENUM('equities', 'fx', 'rates', 'commodities');
  CREATE TYPE "public"."enum_nusantara_views_subject_indicator" AS ENUM('am-assets', 'am-alt-share', 'pm-fundraising', 'pm-undeployed', 'pm-credit', 'alt-real-assets', 'alt-precious', 'cf-portfolio', 'cf-direct', 'pw-pool', 'pw-advised', 'fo-formation', 'inst-alts', 'macro-growth', 'macro-inflation', 'macro-policy');
  CREATE TYPE "public"."enum_nusantara_views_workflow_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum_nusantara_views_content_class" AS ENUM('illustrative', 'management_review', 'approved_corporate');
  CREATE TYPE "public"."enum_nusantara_views_legacy_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum_nusantara_views_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__nusantara_views_v_version_related_markets" AS ENUM('klci', 'sti', 'jci', 'nikkei', 'hsi', 'spx', 'nasdaq', 'usdmyr', 'usdsgd', 'usdidr', 'sgdmyr', 'eurusd', 'usdcnh', 'usdjpy', 'us10y', 'us2y', 'mgs10y', 'jgb10y', 'sgs10y', 'gold', 'silver', 'brent', 'cpo', 'copper');
  CREATE TYPE "public"."enum__nusantara_views_v_version_market_state_dimensions" AS ENUM('growth', 'rates', 'liquidity', 'risk', 'currencies', 'commodities');
  CREATE TYPE "public"."enum__nusantara_views_v_version_subject_kind" AS ENUM('instrument', 'assetClass', 'indicator');
  CREATE TYPE "public"."enum__nusantara_views_v_version_subject_instrument" AS ENUM('klci', 'sti', 'jci', 'nikkei', 'hsi', 'spx', 'nasdaq', 'usdmyr', 'usdsgd', 'usdidr', 'sgdmyr', 'eurusd', 'usdcnh', 'usdjpy', 'us10y', 'us2y', 'mgs10y', 'jgb10y', 'sgs10y', 'gold', 'silver', 'brent', 'cpo', 'copper');
  CREATE TYPE "public"."enum__nusantara_views_v_version_subject_asset_class" AS ENUM('equities', 'fx', 'rates', 'commodities');
  CREATE TYPE "public"."enum__nusantara_views_v_version_subject_indicator" AS ENUM('am-assets', 'am-alt-share', 'pm-fundraising', 'pm-undeployed', 'pm-credit', 'alt-real-assets', 'alt-precious', 'cf-portfolio', 'cf-direct', 'pw-pool', 'pw-advised', 'fo-formation', 'inst-alts', 'macro-growth', 'macro-inflation', 'macro-policy');
  CREATE TYPE "public"."enum__nusantara_views_v_version_workflow_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum__nusantara_views_v_version_content_class" AS ENUM('illustrative', 'management_review', 'approved_corporate');
  CREATE TYPE "public"."enum__nusantara_views_v_version_legacy_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum__nusantara_views_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_market_state_dimensions_dimension" AS ENUM('growth', 'rates', 'liquidity', 'risk', 'currencies', 'commodities');
  CREATE TYPE "public"."enum_market_state_dimensions_dimension_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum_market_state_workflow_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum_market_state_content_class" AS ENUM('illustrative', 'management_review', 'approved_corporate');
  CREATE TYPE "public"."enum_market_state_legacy_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum_market_state_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__market_state_v_version_dimensions_dimension" AS ENUM('growth', 'rates', 'liquidity', 'risk', 'currencies', 'commodities');
  CREATE TYPE "public"."enum__market_state_v_version_dimensions_dimension_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum__market_state_v_version_workflow_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum__market_state_v_version_content_class" AS ENUM('illustrative', 'management_review', 'approved_corporate');
  CREATE TYPE "public"."enum__market_state_v_version_legacy_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum__market_state_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_signals_instrument" AS ENUM('klci', 'sti', 'jci', 'nikkei', 'hsi', 'spx', 'nasdaq', 'usdmyr', 'usdsgd', 'usdidr', 'sgdmyr', 'eurusd', 'usdcnh', 'usdjpy', 'us10y', 'us2y', 'mgs10y', 'jgb10y', 'sgs10y', 'gold', 'silver', 'brent', 'cpo', 'copper');
  CREATE TYPE "public"."enum_signals_workflow_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum_signals_content_class" AS ENUM('illustrative', 'management_review', 'approved_corporate');
  CREATE TYPE "public"."enum_signals_legacy_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum_signals_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__signals_v_version_instrument" AS ENUM('klci', 'sti', 'jci', 'nikkei', 'hsi', 'spx', 'nasdaq', 'usdmyr', 'usdsgd', 'usdidr', 'sgdmyr', 'eurusd', 'usdcnh', 'usdjpy', 'us10y', 'us2y', 'mgs10y', 'jgb10y', 'sgs10y', 'gold', 'silver', 'brent', 'cpo', 'copper');
  CREATE TYPE "public"."enum__signals_v_version_workflow_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum__signals_v_version_content_class" AS ENUM('illustrative', 'management_review', 'approved_corporate');
  CREATE TYPE "public"."enum__signals_v_version_legacy_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum__signals_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_themes_instruments" AS ENUM('klci', 'sti', 'jci', 'nikkei', 'hsi', 'spx', 'nasdaq', 'usdmyr', 'usdsgd', 'usdidr', 'sgdmyr', 'eurusd', 'usdcnh', 'usdjpy', 'us10y', 'us2y', 'mgs10y', 'jgb10y', 'sgs10y', 'gold', 'silver', 'brent', 'cpo', 'copper');
  CREATE TYPE "public"."enum_themes_indicators" AS ENUM('am-assets', 'am-alt-share', 'pm-fundraising', 'pm-undeployed', 'pm-credit', 'alt-real-assets', 'alt-precious', 'cf-portfolio', 'cf-direct', 'pw-pool', 'pw-advised', 'fo-formation', 'inst-alts', 'macro-growth', 'macro-inflation', 'macro-policy');
  CREATE TYPE "public"."enum_themes_workflow_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum_themes_content_class" AS ENUM('illustrative', 'management_review', 'approved_corporate');
  CREATE TYPE "public"."enum_themes_legacy_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum_themes_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__themes_v_version_instruments" AS ENUM('klci', 'sti', 'jci', 'nikkei', 'hsi', 'spx', 'nasdaq', 'usdmyr', 'usdsgd', 'usdidr', 'sgdmyr', 'eurusd', 'usdcnh', 'usdjpy', 'us10y', 'us2y', 'mgs10y', 'jgb10y', 'sgs10y', 'gold', 'silver', 'brent', 'cpo', 'copper');
  CREATE TYPE "public"."enum__themes_v_version_indicators" AS ENUM('am-assets', 'am-alt-share', 'pm-fundraising', 'pm-undeployed', 'pm-credit', 'alt-real-assets', 'alt-precious', 'cf-portfolio', 'cf-direct', 'pw-pool', 'pw-advised', 'fo-formation', 'inst-alts', 'macro-growth', 'macro-inflation', 'macro-policy');
  CREATE TYPE "public"."enum__themes_v_version_workflow_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum__themes_v_version_content_class" AS ENUM('illustrative', 'management_review', 'approved_corporate');
  CREATE TYPE "public"."enum__themes_v_version_legacy_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum__themes_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_capabilities_markets" AS ENUM('klci', 'sti', 'jci', 'nikkei', 'hsi', 'spx', 'nasdaq', 'usdmyr', 'usdsgd', 'usdidr', 'sgdmyr', 'eurusd', 'usdcnh', 'usdjpy', 'us10y', 'us2y', 'mgs10y', 'jgb10y', 'sgs10y', 'gold', 'silver', 'brent', 'cpo', 'copper');
  CREATE TYPE "public"."enum_capabilities_indicators" AS ENUM('am-assets', 'am-alt-share', 'pm-fundraising', 'pm-undeployed', 'pm-credit', 'alt-real-assets', 'alt-precious', 'cf-portfolio', 'cf-direct', 'pw-pool', 'pw-advised', 'fo-formation', 'inst-alts', 'macro-growth', 'macro-inflation', 'macro-policy');
  CREATE TYPE "public"."enum_capabilities_capability_status" AS ENUM('internal', 'review', 'public-capability', 'active-product', 'archived');
  CREATE TYPE "public"."enum_capabilities_stage" AS ENUM('capability', 'under-review', 'strategy', 'active', 'future-development');
  CREATE TYPE "public"."enum_capabilities_profile_liquidity" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum_capabilities_profile_income" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum_capabilities_profile_complexity" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum_capabilities_profile_valuation_frequency" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum_capabilities_workflow_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum_capabilities_content_class" AS ENUM('illustrative', 'management_review', 'approved_corporate');
  CREATE TYPE "public"."enum_capabilities_legacy_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum_capabilities_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__capabilities_v_version_markets" AS ENUM('klci', 'sti', 'jci', 'nikkei', 'hsi', 'spx', 'nasdaq', 'usdmyr', 'usdsgd', 'usdidr', 'sgdmyr', 'eurusd', 'usdcnh', 'usdjpy', 'us10y', 'us2y', 'mgs10y', 'jgb10y', 'sgs10y', 'gold', 'silver', 'brent', 'cpo', 'copper');
  CREATE TYPE "public"."enum__capabilities_v_version_indicators" AS ENUM('am-assets', 'am-alt-share', 'pm-fundraising', 'pm-undeployed', 'pm-credit', 'alt-real-assets', 'alt-precious', 'cf-portfolio', 'cf-direct', 'pw-pool', 'pw-advised', 'fo-formation', 'inst-alts', 'macro-growth', 'macro-inflation', 'macro-policy');
  CREATE TYPE "public"."enum__capabilities_v_version_capability_status" AS ENUM('internal', 'review', 'public-capability', 'active-product', 'archived');
  CREATE TYPE "public"."enum__capabilities_v_version_stage" AS ENUM('capability', 'under-review', 'strategy', 'active', 'future-development');
  CREATE TYPE "public"."enum__capabilities_v_version_profile_liquidity" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum__capabilities_v_version_profile_income" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum__capabilities_v_version_profile_complexity" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum__capabilities_v_version_profile_valuation_frequency" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum__capabilities_v_version_workflow_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum__capabilities_v_version_content_class" AS ENUM('illustrative', 'management_review', 'approved_corporate');
  CREATE TYPE "public"."enum__capabilities_v_version_legacy_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum__capabilities_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_legal_pages_slug" AS ENUM('important-information', 'disclaimer', 'privacy', 'terms');
  CREATE TYPE "public"."enum_legal_pages_workflow_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum_legal_pages_content_class" AS ENUM('illustrative', 'management_review', 'approved_corporate');
  CREATE TYPE "public"."enum_legal_pages_legacy_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum_legal_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__legal_pages_v_version_slug" AS ENUM('important-information', 'disclaimer', 'privacy', 'terms');
  CREATE TYPE "public"."enum__legal_pages_v_version_workflow_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum__legal_pages_v_version_content_class" AS ENUM('illustrative', 'management_review', 'approved_corporate');
  CREATE TYPE "public"."enum__legal_pages_v_version_legacy_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum__legal_pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_users_role" AS ENUM('editor', 'reviewer', 'admin');
  CREATE TYPE "public"."enum_audit_log_action" AS ENUM('create', 'edit', 'submit', 'approve', 'publish', 'archive', 'classify', 'delete', 'user');
  CREATE TYPE "public"."enum_site_settings_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__site_settings_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "insights_executive_summary" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "insights_key_takeaways" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "insights_blocks_heading" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"anchor" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "insights_blocks_paragraph" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "insights_blocks_list_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "insights_blocks_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"ordered" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "insights_blocks_pullquote" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "insights_blocks_layer_body" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "insights_blocks_layer" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"layer" "enum_insights_blocks_layer_layer",
  	"title" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "insights_blocks_table" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"caption" varchar,
  	"columns" jsonb,
  	"rows" jsonb,
  	"note" varchar,
  	"layer" "enum_insights_blocks_table_layer",
  	"block_name" varchar
  );
  
  CREATE TABLE "insights_blocks_comparison" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"caption" varchar,
  	"left" varchar,
  	"right" varchar,
  	"rows" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "insights_blocks_chart" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"caption" varchar,
  	"kind" "enum_insights_blocks_chart_kind",
  	"x_labels" jsonb,
  	"series" jsonb,
  	"unit" varchar,
  	"decimals" numeric,
  	"source" varchar,
  	"illustrative" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "insights_blocks_scenario" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"scenario" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "insights_blocks_callout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"text" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "insights_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"detail" varchar,
  	"url" varchar,
  	"provider" varchar,
  	"published_at" timestamp(3) with time zone,
  	"retrieved_at" timestamp(3) with time zone,
  	"licensing_note" varchar,
  	"methodology" varchar
  );
  
  CREATE TABLE "insights_markets" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_insights_markets",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "insights_asset_classes" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_insights_asset_classes",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "insights_market_state_dimensions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_insights_market_state_dimensions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "insights_indicators" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_insights_indicators",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "insights" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"title" varchar,
  	"subtitle" varchar,
  	"category" "enum_insights_category",
  	"date" timestamp(3) with time zone,
  	"summary" varchar,
  	"methodology" varchar,
  	"featured" boolean,
  	"hero_motif" "enum_insights_hero_motif" DEFAULT 'arcs',
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"workflow_status" "enum_insights_workflow_status" DEFAULT 'draft',
  	"content_class" "enum_insights_content_class" DEFAULT 'illustrative',
  	"classification_confirmed_by_id" integer,
  	"classification_confirmed_at" timestamp(3) with time zone,
  	"author" varchar,
  	"review_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"last_edited_by_id" integer,
  	"submitted_by_id" integer,
  	"submitted_at" timestamp(3) with time zone,
  	"approved_by_user_id" integer,
  	"approved_by" varchar,
  	"approved_at" timestamp(3) with time zone,
  	"approved_content_hash" varchar,
  	"published_at" timestamp(3) with time zone,
  	"legacy_key" varchar,
  	"legacy_status" "enum_insights_legacy_status",
  	"legacy_sample" boolean,
  	"legacy_updated_at" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_insights_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "insights_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "insights_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"insights_id" integer,
  	"themes_id" integer,
  	"capabilities_id" integer
  );
  
  CREATE TABLE "_insights_v_version_executive_summary" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_insights_v_version_key_takeaways" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_insights_v_blocks_heading" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"anchor" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_insights_v_blocks_paragraph" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_insights_v_blocks_list_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_insights_v_blocks_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"ordered" boolean,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_insights_v_blocks_pullquote" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_insights_v_blocks_layer_body" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_insights_v_blocks_layer" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"layer" "enum__insights_v_blocks_layer_layer",
  	"title" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_insights_v_blocks_table" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"caption" varchar,
  	"columns" jsonb,
  	"rows" jsonb,
  	"note" varchar,
  	"layer" "enum__insights_v_blocks_table_layer",
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_insights_v_blocks_comparison" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"caption" varchar,
  	"left" varchar,
  	"right" varchar,
  	"rows" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_insights_v_blocks_chart" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"caption" varchar,
  	"kind" "enum__insights_v_blocks_chart_kind",
  	"x_labels" jsonb,
  	"series" jsonb,
  	"unit" varchar,
  	"decimals" numeric,
  	"source" varchar,
  	"illustrative" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_insights_v_blocks_scenario" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"scenario" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_insights_v_blocks_callout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"text" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_insights_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"detail" varchar,
  	"url" varchar,
  	"provider" varchar,
  	"published_at" timestamp(3) with time zone,
  	"retrieved_at" timestamp(3) with time zone,
  	"licensing_note" varchar,
  	"methodology" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_insights_v_version_markets" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__insights_v_version_markets",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_insights_v_version_asset_classes" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__insights_v_version_asset_classes",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_insights_v_version_market_state_dimensions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__insights_v_version_market_state_dimensions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_insights_v_version_indicators" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__insights_v_version_indicators",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_insights_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_title" varchar,
  	"version_subtitle" varchar,
  	"version_category" "enum__insights_v_version_category",
  	"version_date" timestamp(3) with time zone,
  	"version_summary" varchar,
  	"version_methodology" varchar,
  	"version_featured" boolean,
  	"version_hero_motif" "enum__insights_v_version_hero_motif" DEFAULT 'arcs',
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_workflow_status" "enum__insights_v_version_workflow_status" DEFAULT 'draft',
  	"version_content_class" "enum__insights_v_version_content_class" DEFAULT 'illustrative',
  	"version_classification_confirmed_by_id" integer,
  	"version_classification_confirmed_at" timestamp(3) with time zone,
  	"version_author" varchar,
  	"version_review_at" timestamp(3) with time zone,
  	"version_created_by_id" integer,
  	"version_last_edited_by_id" integer,
  	"version_submitted_by_id" integer,
  	"version_submitted_at" timestamp(3) with time zone,
  	"version_approved_by_user_id" integer,
  	"version_approved_by" varchar,
  	"version_approved_at" timestamp(3) with time zone,
  	"version_approved_content_hash" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_legacy_key" varchar,
  	"version_legacy_status" "enum__insights_v_version_legacy_status",
  	"version_legacy_sample" boolean,
  	"version_legacy_updated_at" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__insights_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_insights_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_insights_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"insights_id" integer,
  	"themes_id" integer,
  	"capabilities_id" integer
  );
  
  CREATE TABLE "nusantara_views_stance_scale" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "nusantara_views_what_we_are_watching" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "nusantara_views_related_markets" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_nusantara_views_related_markets",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "nusantara_views_market_state_dimensions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_nusantara_views_market_state_dimensions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "nusantara_views" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"subject_kind" "enum_nusantara_views_subject_kind",
  	"subject_instrument" "enum_nusantara_views_subject_instrument",
  	"subject_asset_class" "enum_nusantara_views_subject_asset_class",
  	"subject_indicator" "enum_nusantara_views_subject_indicator",
  	"signal" varchar,
  	"stance_position" numeric,
  	"summary" varchar,
  	"context" varchar,
  	"key_risk" varchar,
  	"what_would_change_our_view" varchar,
  	"related_insight_id" integer,
  	"theme_id" integer,
  	"workflow_status" "enum_nusantara_views_workflow_status" DEFAULT 'draft',
  	"content_class" "enum_nusantara_views_content_class" DEFAULT 'illustrative',
  	"classification_confirmed_by_id" integer,
  	"classification_confirmed_at" timestamp(3) with time zone,
  	"author" varchar,
  	"review_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"last_edited_by_id" integer,
  	"submitted_by_id" integer,
  	"submitted_at" timestamp(3) with time zone,
  	"approved_by_user_id" integer,
  	"approved_by" varchar,
  	"approved_at" timestamp(3) with time zone,
  	"approved_content_hash" varchar,
  	"published_at" timestamp(3) with time zone,
  	"legacy_key" varchar,
  	"legacy_status" "enum_nusantara_views_legacy_status",
  	"legacy_sample" boolean,
  	"legacy_updated_at" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_nusantara_views_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_nusantara_views_v_version_stance_scale" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_nusantara_views_v_version_what_we_are_watching" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_nusantara_views_v_version_related_markets" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__nusantara_views_v_version_related_markets",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_nusantara_views_v_version_market_state_dimensions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__nusantara_views_v_version_market_state_dimensions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_nusantara_views_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_key" varchar,
  	"version_subject_kind" "enum__nusantara_views_v_version_subject_kind",
  	"version_subject_instrument" "enum__nusantara_views_v_version_subject_instrument",
  	"version_subject_asset_class" "enum__nusantara_views_v_version_subject_asset_class",
  	"version_subject_indicator" "enum__nusantara_views_v_version_subject_indicator",
  	"version_signal" varchar,
  	"version_stance_position" numeric,
  	"version_summary" varchar,
  	"version_context" varchar,
  	"version_key_risk" varchar,
  	"version_what_would_change_our_view" varchar,
  	"version_related_insight_id" integer,
  	"version_theme_id" integer,
  	"version_workflow_status" "enum__nusantara_views_v_version_workflow_status" DEFAULT 'draft',
  	"version_content_class" "enum__nusantara_views_v_version_content_class" DEFAULT 'illustrative',
  	"version_classification_confirmed_by_id" integer,
  	"version_classification_confirmed_at" timestamp(3) with time zone,
  	"version_author" varchar,
  	"version_review_at" timestamp(3) with time zone,
  	"version_created_by_id" integer,
  	"version_last_edited_by_id" integer,
  	"version_submitted_by_id" integer,
  	"version_submitted_at" timestamp(3) with time zone,
  	"version_approved_by_user_id" integer,
  	"version_approved_by" varchar,
  	"version_approved_at" timestamp(3) with time zone,
  	"version_approved_content_hash" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_legacy_key" varchar,
  	"version_legacy_status" "enum__nusantara_views_v_version_legacy_status",
  	"version_legacy_sample" boolean,
  	"version_legacy_updated_at" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__nusantara_views_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "market_state_dimensions_stance_scale" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "market_state_dimensions_watch_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "market_state_dimensions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"dimension" "enum_market_state_dimensions_dimension",
  	"label" varchar,
  	"state" varchar,
  	"stance_position" numeric,
  	"summary" varchar,
  	"change_conditions" varchar,
  	"related_insight_id" integer,
  	"dimension_updated_at" timestamp(3) with time zone,
  	"dimension_status" "enum_market_state_dimensions_dimension_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "market_state" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"edition" varchar,
  	"framing_title" varchar,
  	"framing_note" varchar,
  	"workflow_status" "enum_market_state_workflow_status" DEFAULT 'draft',
  	"content_class" "enum_market_state_content_class" DEFAULT 'illustrative',
  	"classification_confirmed_by_id" integer,
  	"classification_confirmed_at" timestamp(3) with time zone,
  	"author" varchar,
  	"review_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"last_edited_by_id" integer,
  	"submitted_by_id" integer,
  	"submitted_at" timestamp(3) with time zone,
  	"approved_by_user_id" integer,
  	"approved_by" varchar,
  	"approved_at" timestamp(3) with time zone,
  	"approved_content_hash" varchar,
  	"published_at" timestamp(3) with time zone,
  	"legacy_key" varchar,
  	"legacy_status" "enum_market_state_legacy_status",
  	"legacy_sample" boolean,
  	"legacy_updated_at" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_market_state_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_market_state_v_version_dimensions_stance_scale" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_market_state_v_version_dimensions_watch_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_markets_v" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "markets",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_market_state_v_version_dimensions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"dimension" "enum__market_state_v_version_dimensions_dimension",
  	"label" varchar,
  	"state" varchar,
  	"stance_position" numeric,
  	"summary" varchar,
  	"change_conditions" varchar,
  	"related_insight_id" integer,
  	"dimension_updated_at" timestamp(3) with time zone,
  	"dimension_status" "enum__market_state_v_version_dimensions_dimension_status" DEFAULT 'draft',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_market_state_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_key" varchar,
  	"version_edition" varchar,
  	"version_framing_title" varchar,
  	"version_framing_note" varchar,
  	"version_workflow_status" "enum__market_state_v_version_workflow_status" DEFAULT 'draft',
  	"version_content_class" "enum__market_state_v_version_content_class" DEFAULT 'illustrative',
  	"version_classification_confirmed_by_id" integer,
  	"version_classification_confirmed_at" timestamp(3) with time zone,
  	"version_author" varchar,
  	"version_review_at" timestamp(3) with time zone,
  	"version_created_by_id" integer,
  	"version_last_edited_by_id" integer,
  	"version_submitted_by_id" integer,
  	"version_submitted_at" timestamp(3) with time zone,
  	"version_approved_by_user_id" integer,
  	"version_approved_by" varchar,
  	"version_approved_at" timestamp(3) with time zone,
  	"version_approved_content_hash" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_legacy_key" varchar,
  	"version_legacy_status" "enum__market_state_v_version_legacy_status",
  	"version_legacy_sample" boolean,
  	"version_legacy_updated_at" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__market_state_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "signals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"date" timestamp(3) with time zone,
  	"theme" varchar,
  	"headline" varchar,
  	"reading" varchar,
  	"instrument" "enum_signals_instrument",
  	"insight_id" integer,
  	"workflow_status" "enum_signals_workflow_status" DEFAULT 'draft',
  	"content_class" "enum_signals_content_class" DEFAULT 'illustrative',
  	"classification_confirmed_by_id" integer,
  	"classification_confirmed_at" timestamp(3) with time zone,
  	"author" varchar,
  	"review_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"last_edited_by_id" integer,
  	"submitted_by_id" integer,
  	"submitted_at" timestamp(3) with time zone,
  	"approved_by_user_id" integer,
  	"approved_by" varchar,
  	"approved_at" timestamp(3) with time zone,
  	"approved_content_hash" varchar,
  	"published_at" timestamp(3) with time zone,
  	"legacy_key" varchar,
  	"legacy_status" "enum_signals_legacy_status",
  	"legacy_sample" boolean,
  	"legacy_updated_at" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_signals_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_signals_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_key" varchar,
  	"version_date" timestamp(3) with time zone,
  	"version_theme" varchar,
  	"version_headline" varchar,
  	"version_reading" varchar,
  	"version_instrument" "enum__signals_v_version_instrument",
  	"version_insight_id" integer,
  	"version_workflow_status" "enum__signals_v_version_workflow_status" DEFAULT 'draft',
  	"version_content_class" "enum__signals_v_version_content_class" DEFAULT 'illustrative',
  	"version_classification_confirmed_by_id" integer,
  	"version_classification_confirmed_at" timestamp(3) with time zone,
  	"version_author" varchar,
  	"version_review_at" timestamp(3) with time zone,
  	"version_created_by_id" integer,
  	"version_last_edited_by_id" integer,
  	"version_submitted_by_id" integer,
  	"version_submitted_at" timestamp(3) with time zone,
  	"version_approved_by_user_id" integer,
  	"version_approved_by" varchar,
  	"version_approved_at" timestamp(3) with time zone,
  	"version_approved_content_hash" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_legacy_key" varchar,
  	"version_legacy_status" "enum__signals_v_version_legacy_status",
  	"version_legacy_sample" boolean,
  	"version_legacy_updated_at" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__signals_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "themes_instruments" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_themes_instruments",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "themes_indicators" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_themes_indicators",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "themes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"title" varchar,
  	"statement" varchar,
  	"workflow_status" "enum_themes_workflow_status" DEFAULT 'draft',
  	"content_class" "enum_themes_content_class" DEFAULT 'illustrative',
  	"classification_confirmed_by_id" integer,
  	"classification_confirmed_at" timestamp(3) with time zone,
  	"author" varchar,
  	"review_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"last_edited_by_id" integer,
  	"submitted_by_id" integer,
  	"submitted_at" timestamp(3) with time zone,
  	"approved_by_user_id" integer,
  	"approved_by" varchar,
  	"approved_at" timestamp(3) with time zone,
  	"approved_content_hash" varchar,
  	"published_at" timestamp(3) with time zone,
  	"legacy_key" varchar,
  	"legacy_status" "enum_themes_legacy_status",
  	"legacy_sample" boolean,
  	"legacy_updated_at" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_themes_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "themes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"insights_id" integer
  );
  
  CREATE TABLE "_themes_v_version_instruments" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__themes_v_version_instruments",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_themes_v_version_indicators" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__themes_v_version_indicators",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_themes_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_key" varchar,
  	"version_title" varchar,
  	"version_statement" varchar,
  	"version_workflow_status" "enum__themes_v_version_workflow_status" DEFAULT 'draft',
  	"version_content_class" "enum__themes_v_version_content_class" DEFAULT 'illustrative',
  	"version_classification_confirmed_by_id" integer,
  	"version_classification_confirmed_at" timestamp(3) with time zone,
  	"version_author" varchar,
  	"version_review_at" timestamp(3) with time zone,
  	"version_created_by_id" integer,
  	"version_last_edited_by_id" integer,
  	"version_submitted_by_id" integer,
  	"version_submitted_at" timestamp(3) with time zone,
  	"version_approved_by_user_id" integer,
  	"version_approved_by" varchar,
  	"version_approved_at" timestamp(3) with time zone,
  	"version_approved_content_hash" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_legacy_key" varchar,
  	"version_legacy_status" "enum__themes_v_version_legacy_status",
  	"version_legacy_sample" boolean,
  	"version_legacy_updated_at" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__themes_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_themes_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"insights_id" integer
  );
  
  CREATE TABLE "capabilities_opportunity_set" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "capabilities_risk_considerations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "capabilities_characteristics" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "capabilities_markets" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_capabilities_markets",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "capabilities_indicators" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_capabilities_indicators",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "capabilities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"name" varchar,
  	"capability_status" "enum_capabilities_capability_status" DEFAULT 'internal',
  	"stage" "enum_capabilities_stage",
  	"summary" varchar,
  	"overview" varchar,
  	"approach" varchar,
  	"time_horizon" varchar,
  	"role" varchar,
  	"profile_liquidity" "enum_capabilities_profile_liquidity",
  	"profile_income" "enum_capabilities_profile_income",
  	"profile_complexity" "enum_capabilities_profile_complexity",
  	"profile_valuation_frequency" "enum_capabilities_profile_valuation_frequency",
  	"workflow_status" "enum_capabilities_workflow_status" DEFAULT 'draft',
  	"content_class" "enum_capabilities_content_class" DEFAULT 'illustrative',
  	"classification_confirmed_by_id" integer,
  	"classification_confirmed_at" timestamp(3) with time zone,
  	"author" varchar,
  	"review_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"last_edited_by_id" integer,
  	"submitted_by_id" integer,
  	"submitted_at" timestamp(3) with time zone,
  	"approved_by_user_id" integer,
  	"approved_by" varchar,
  	"approved_at" timestamp(3) with time zone,
  	"approved_content_hash" varchar,
  	"published_at" timestamp(3) with time zone,
  	"legacy_key" varchar,
  	"legacy_status" "enum_capabilities_legacy_status",
  	"legacy_sample" boolean,
  	"legacy_updated_at" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_capabilities_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "capabilities_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"insights_id" integer
  );
  
  CREATE TABLE "_capabilities_v_version_opportunity_set" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_capabilities_v_version_risk_considerations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_capabilities_v_version_characteristics" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_capabilities_v_version_markets" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__capabilities_v_version_markets",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_capabilities_v_version_indicators" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__capabilities_v_version_indicators",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_capabilities_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_name" varchar,
  	"version_capability_status" "enum__capabilities_v_version_capability_status" DEFAULT 'internal',
  	"version_stage" "enum__capabilities_v_version_stage",
  	"version_summary" varchar,
  	"version_overview" varchar,
  	"version_approach" varchar,
  	"version_time_horizon" varchar,
  	"version_role" varchar,
  	"version_profile_liquidity" "enum__capabilities_v_version_profile_liquidity",
  	"version_profile_income" "enum__capabilities_v_version_profile_income",
  	"version_profile_complexity" "enum__capabilities_v_version_profile_complexity",
  	"version_profile_valuation_frequency" "enum__capabilities_v_version_profile_valuation_frequency",
  	"version_workflow_status" "enum__capabilities_v_version_workflow_status" DEFAULT 'draft',
  	"version_content_class" "enum__capabilities_v_version_content_class" DEFAULT 'illustrative',
  	"version_classification_confirmed_by_id" integer,
  	"version_classification_confirmed_at" timestamp(3) with time zone,
  	"version_author" varchar,
  	"version_review_at" timestamp(3) with time zone,
  	"version_created_by_id" integer,
  	"version_last_edited_by_id" integer,
  	"version_submitted_by_id" integer,
  	"version_submitted_at" timestamp(3) with time zone,
  	"version_approved_by_user_id" integer,
  	"version_approved_by" varchar,
  	"version_approved_at" timestamp(3) with time zone,
  	"version_approved_content_hash" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_legacy_key" varchar,
  	"version_legacy_status" "enum__capabilities_v_version_legacy_status",
  	"version_legacy_sample" boolean,
  	"version_legacy_updated_at" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__capabilities_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_capabilities_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"insights_id" integer
  );
  
  CREATE TABLE "legal_pages_sections_body" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "legal_pages_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar
  );
  
  CREATE TABLE "legal_pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" "enum_legal_pages_slug",
  	"title" varchar,
  	"summary" varchar,
  	"versioning_version_label" varchar,
  	"versioning_effective_date" timestamp(3) with time zone,
  	"versioning_change_note" varchar,
  	"versioning_legal_review_notes" varchar,
  	"workflow_status" "enum_legal_pages_workflow_status" DEFAULT 'draft',
  	"content_class" "enum_legal_pages_content_class" DEFAULT 'illustrative',
  	"classification_confirmed_by_id" integer,
  	"classification_confirmed_at" timestamp(3) with time zone,
  	"author" varchar,
  	"review_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"last_edited_by_id" integer,
  	"submitted_by_id" integer,
  	"submitted_at" timestamp(3) with time zone,
  	"approved_by_user_id" integer,
  	"approved_by" varchar,
  	"approved_at" timestamp(3) with time zone,
  	"approved_content_hash" varchar,
  	"published_at" timestamp(3) with time zone,
  	"legacy_key" varchar,
  	"legacy_status" "enum_legal_pages_legacy_status",
  	"legacy_sample" boolean,
  	"legacy_updated_at" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_legal_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_legal_pages_v_version_sections_body" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_legal_pages_v_version_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_legal_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" "enum__legal_pages_v_version_slug",
  	"version_title" varchar,
  	"version_summary" varchar,
  	"version_versioning_version_label" varchar,
  	"version_versioning_effective_date" timestamp(3) with time zone,
  	"version_versioning_change_note" varchar,
  	"version_versioning_legal_review_notes" varchar,
  	"version_workflow_status" "enum__legal_pages_v_version_workflow_status" DEFAULT 'draft',
  	"version_content_class" "enum__legal_pages_v_version_content_class" DEFAULT 'illustrative',
  	"version_classification_confirmed_by_id" integer,
  	"version_classification_confirmed_at" timestamp(3) with time zone,
  	"version_author" varchar,
  	"version_review_at" timestamp(3) with time zone,
  	"version_created_by_id" integer,
  	"version_last_edited_by_id" integer,
  	"version_submitted_by_id" integer,
  	"version_submitted_at" timestamp(3) with time zone,
  	"version_approved_by_user_id" integer,
  	"version_approved_by" varchar,
  	"version_approved_at" timestamp(3) with time zone,
  	"version_approved_content_hash" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_legacy_key" varchar,
  	"version_legacy_status" "enum__legal_pages_v_version_legacy_status",
  	"version_legacy_sample" boolean,
  	"version_legacy_updated_at" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__legal_pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"credit" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_wide_url" varchar,
  	"sizes_wide_width" numeric,
  	"sizes_wide_height" numeric,
  	"sizes_wide_mime_type" varchar,
  	"sizes_wide_filesize" numeric,
  	"sizes_wide_filename" varchar
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'editor' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"action" "enum_audit_log_action" NOT NULL,
  	"collection" varchar NOT NULL,
  	"document_id" varchar NOT NULL,
  	"title" varchar,
  	"summary" varchar NOT NULL,
  	"user_id" integer,
  	"user_email" varchar
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"insights_id" integer,
  	"nusantara_views_id" integer,
  	"market_state_id" integer,
  	"signals_id" integer,
  	"themes_id" integer,
  	"capabilities_id" integer,
  	"legal_pages_id" integer,
  	"media_id" integer,
  	"users_id" integer,
  	"audit_log_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_settings_licences" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"regulator" varchar,
  	"licence" varchar,
  	"reference" varchar,
  	"jurisdiction" varchar
  );
  
  CREATE TABLE "site_settings_offices" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"city" varchar,
  	"address" varchar,
  	"phone" varchar
  );
  
  CREATE TABLE "site_settings_leadership" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"role" varchar,
  	"biography" varchar
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"entity_legal_name" varchar,
  	"entity_registration_number" varchar,
  	"entity_registered_address" varchar,
  	"contact_general_email" varchar,
  	"contact_phone" varchar,
  	"_status" "enum_site_settings_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_site_settings_v_version_licences" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"regulator" varchar,
  	"licence" varchar,
  	"reference" varchar,
  	"jurisdiction" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_site_settings_v_version_offices" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"city" varchar,
  	"address" varchar,
  	"phone" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_site_settings_v_version_leadership" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"role" varchar,
  	"biography" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_site_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_entity_legal_name" varchar,
  	"version_entity_registration_number" varchar,
  	"version_entity_registered_address" varchar,
  	"version_contact_general_email" varchar,
  	"version_contact_phone" varchar,
  	"version__status" "enum__site_settings_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  ALTER TABLE "insights_executive_summary" ADD CONSTRAINT "insights_executive_summary_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_key_takeaways" ADD CONSTRAINT "insights_key_takeaways_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_blocks_heading" ADD CONSTRAINT "insights_blocks_heading_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_blocks_paragraph" ADD CONSTRAINT "insights_blocks_paragraph_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_blocks_list_items" ADD CONSTRAINT "insights_blocks_list_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights_blocks_list"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_blocks_list" ADD CONSTRAINT "insights_blocks_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_blocks_pullquote" ADD CONSTRAINT "insights_blocks_pullquote_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_blocks_layer_body" ADD CONSTRAINT "insights_blocks_layer_body_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights_blocks_layer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_blocks_layer" ADD CONSTRAINT "insights_blocks_layer_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_blocks_table" ADD CONSTRAINT "insights_blocks_table_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_blocks_comparison" ADD CONSTRAINT "insights_blocks_comparison_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_blocks_chart" ADD CONSTRAINT "insights_blocks_chart_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_blocks_scenario" ADD CONSTRAINT "insights_blocks_scenario_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_blocks_callout" ADD CONSTRAINT "insights_blocks_callout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_sources" ADD CONSTRAINT "insights_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_markets" ADD CONSTRAINT "insights_markets_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_asset_classes" ADD CONSTRAINT "insights_asset_classes_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_market_state_dimensions" ADD CONSTRAINT "insights_market_state_dimensions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_indicators" ADD CONSTRAINT "insights_indicators_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights" ADD CONSTRAINT "insights_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "insights" ADD CONSTRAINT "insights_classification_confirmed_by_id_users_id_fk" FOREIGN KEY ("classification_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "insights" ADD CONSTRAINT "insights_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "insights" ADD CONSTRAINT "insights_last_edited_by_id_users_id_fk" FOREIGN KEY ("last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "insights" ADD CONSTRAINT "insights_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "insights" ADD CONSTRAINT "insights_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "insights_texts" ADD CONSTRAINT "insights_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_rels" ADD CONSTRAINT "insights_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_rels" ADD CONSTRAINT "insights_rels_insights_fk" FOREIGN KEY ("insights_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_rels" ADD CONSTRAINT "insights_rels_themes_fk" FOREIGN KEY ("themes_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_rels" ADD CONSTRAINT "insights_rels_capabilities_fk" FOREIGN KEY ("capabilities_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_version_executive_summary" ADD CONSTRAINT "_insights_v_version_executive_summary_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_version_key_takeaways" ADD CONSTRAINT "_insights_v_version_key_takeaways_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_blocks_heading" ADD CONSTRAINT "_insights_v_blocks_heading_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_blocks_paragraph" ADD CONSTRAINT "_insights_v_blocks_paragraph_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_blocks_list_items" ADD CONSTRAINT "_insights_v_blocks_list_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v_blocks_list"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_blocks_list" ADD CONSTRAINT "_insights_v_blocks_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_blocks_pullquote" ADD CONSTRAINT "_insights_v_blocks_pullquote_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_blocks_layer_body" ADD CONSTRAINT "_insights_v_blocks_layer_body_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v_blocks_layer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_blocks_layer" ADD CONSTRAINT "_insights_v_blocks_layer_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_blocks_table" ADD CONSTRAINT "_insights_v_blocks_table_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_blocks_comparison" ADD CONSTRAINT "_insights_v_blocks_comparison_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_blocks_chart" ADD CONSTRAINT "_insights_v_blocks_chart_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_blocks_scenario" ADD CONSTRAINT "_insights_v_blocks_scenario_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_blocks_callout" ADD CONSTRAINT "_insights_v_blocks_callout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_version_sources" ADD CONSTRAINT "_insights_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_version_markets" ADD CONSTRAINT "_insights_v_version_markets_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_version_asset_classes" ADD CONSTRAINT "_insights_v_version_asset_classes_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_version_market_state_dimensions" ADD CONSTRAINT "_insights_v_version_market_state_dimensions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_version_indicators" ADD CONSTRAINT "_insights_v_version_indicators_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v" ADD CONSTRAINT "_insights_v_parent_id_insights_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."insights"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_insights_v" ADD CONSTRAINT "_insights_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_insights_v" ADD CONSTRAINT "_insights_v_version_classification_confirmed_by_id_users_id_fk" FOREIGN KEY ("version_classification_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_insights_v" ADD CONSTRAINT "_insights_v_version_created_by_id_users_id_fk" FOREIGN KEY ("version_created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_insights_v" ADD CONSTRAINT "_insights_v_version_last_edited_by_id_users_id_fk" FOREIGN KEY ("version_last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_insights_v" ADD CONSTRAINT "_insights_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_insights_v" ADD CONSTRAINT "_insights_v_version_approved_by_user_id_users_id_fk" FOREIGN KEY ("version_approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_insights_v_texts" ADD CONSTRAINT "_insights_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_rels" ADD CONSTRAINT "_insights_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_rels" ADD CONSTRAINT "_insights_v_rels_insights_fk" FOREIGN KEY ("insights_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_rels" ADD CONSTRAINT "_insights_v_rels_themes_fk" FOREIGN KEY ("themes_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_rels" ADD CONSTRAINT "_insights_v_rels_capabilities_fk" FOREIGN KEY ("capabilities_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "nusantara_views_stance_scale" ADD CONSTRAINT "nusantara_views_stance_scale_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."nusantara_views"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "nusantara_views_what_we_are_watching" ADD CONSTRAINT "nusantara_views_what_we_are_watching_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."nusantara_views"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "nusantara_views_related_markets" ADD CONSTRAINT "nusantara_views_related_markets_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."nusantara_views"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "nusantara_views_market_state_dimensions" ADD CONSTRAINT "nusantara_views_market_state_dimensions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."nusantara_views"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "nusantara_views" ADD CONSTRAINT "nusantara_views_related_insight_id_insights_id_fk" FOREIGN KEY ("related_insight_id") REFERENCES "public"."insights"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "nusantara_views" ADD CONSTRAINT "nusantara_views_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "nusantara_views" ADD CONSTRAINT "nusantara_views_classification_confirmed_by_id_users_id_fk" FOREIGN KEY ("classification_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "nusantara_views" ADD CONSTRAINT "nusantara_views_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "nusantara_views" ADD CONSTRAINT "nusantara_views_last_edited_by_id_users_id_fk" FOREIGN KEY ("last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "nusantara_views" ADD CONSTRAINT "nusantara_views_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "nusantara_views" ADD CONSTRAINT "nusantara_views_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_nusantara_views_v_version_stance_scale" ADD CONSTRAINT "_nusantara_views_v_version_stance_scale_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_nusantara_views_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_nusantara_views_v_version_what_we_are_watching" ADD CONSTRAINT "_nusantara_views_v_version_what_we_are_watching_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_nusantara_views_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_nusantara_views_v_version_related_markets" ADD CONSTRAINT "_nusantara_views_v_version_related_markets_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_nusantara_views_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_nusantara_views_v_version_market_state_dimensions" ADD CONSTRAINT "_nusantara_views_v_version_market_state_dimensions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_nusantara_views_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_nusantara_views_v" ADD CONSTRAINT "_nusantara_views_v_parent_id_nusantara_views_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."nusantara_views"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_nusantara_views_v" ADD CONSTRAINT "_nusantara_views_v_version_related_insight_id_insights_id_fk" FOREIGN KEY ("version_related_insight_id") REFERENCES "public"."insights"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_nusantara_views_v" ADD CONSTRAINT "_nusantara_views_v_version_theme_id_themes_id_fk" FOREIGN KEY ("version_theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_nusantara_views_v" ADD CONSTRAINT "_nusantara_views_v_version_classification_confirmed_by_id_users_id_fk" FOREIGN KEY ("version_classification_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_nusantara_views_v" ADD CONSTRAINT "_nusantara_views_v_version_created_by_id_users_id_fk" FOREIGN KEY ("version_created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_nusantara_views_v" ADD CONSTRAINT "_nusantara_views_v_version_last_edited_by_id_users_id_fk" FOREIGN KEY ("version_last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_nusantara_views_v" ADD CONSTRAINT "_nusantara_views_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_nusantara_views_v" ADD CONSTRAINT "_nusantara_views_v_version_approved_by_user_id_users_id_fk" FOREIGN KEY ("version_approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "market_state_dimensions_stance_scale" ADD CONSTRAINT "market_state_dimensions_stance_scale_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."market_state_dimensions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "market_state_dimensions_watch_items" ADD CONSTRAINT "market_state_dimensions_watch_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."market_state_dimensions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "market_state_dimensions" ADD CONSTRAINT "market_state_dimensions_related_insight_id_insights_id_fk" FOREIGN KEY ("related_insight_id") REFERENCES "public"."insights"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "market_state_dimensions" ADD CONSTRAINT "market_state_dimensions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."market_state"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "market_state" ADD CONSTRAINT "market_state_classification_confirmed_by_id_users_id_fk" FOREIGN KEY ("classification_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "market_state" ADD CONSTRAINT "market_state_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "market_state" ADD CONSTRAINT "market_state_last_edited_by_id_users_id_fk" FOREIGN KEY ("last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "market_state" ADD CONSTRAINT "market_state_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "market_state" ADD CONSTRAINT "market_state_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_market_state_v_version_dimensions_stance_scale" ADD CONSTRAINT "_market_state_v_version_dimensions_stance_scale_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_market_state_v_version_dimensions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_market_state_v_version_dimensions_watch_items" ADD CONSTRAINT "_market_state_v_version_dimensions_watch_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_market_state_v_version_dimensions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_markets_v" ADD CONSTRAINT "_markets_v_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_market_state_v_version_dimensions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_market_state_v_version_dimensions" ADD CONSTRAINT "_market_state_v_version_dimensions_related_insight_id_insights_id_fk" FOREIGN KEY ("related_insight_id") REFERENCES "public"."insights"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_market_state_v_version_dimensions" ADD CONSTRAINT "_market_state_v_version_dimensions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_market_state_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_market_state_v" ADD CONSTRAINT "_market_state_v_parent_id_market_state_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."market_state"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_market_state_v" ADD CONSTRAINT "_market_state_v_version_classification_confirmed_by_id_users_id_fk" FOREIGN KEY ("version_classification_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_market_state_v" ADD CONSTRAINT "_market_state_v_version_created_by_id_users_id_fk" FOREIGN KEY ("version_created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_market_state_v" ADD CONSTRAINT "_market_state_v_version_last_edited_by_id_users_id_fk" FOREIGN KEY ("version_last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_market_state_v" ADD CONSTRAINT "_market_state_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_market_state_v" ADD CONSTRAINT "_market_state_v_version_approved_by_user_id_users_id_fk" FOREIGN KEY ("version_approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "signals" ADD CONSTRAINT "signals_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "signals" ADD CONSTRAINT "signals_classification_confirmed_by_id_users_id_fk" FOREIGN KEY ("classification_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "signals" ADD CONSTRAINT "signals_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "signals" ADD CONSTRAINT "signals_last_edited_by_id_users_id_fk" FOREIGN KEY ("last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "signals" ADD CONSTRAINT "signals_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "signals" ADD CONSTRAINT "signals_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_signals_v" ADD CONSTRAINT "_signals_v_parent_id_signals_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."signals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_signals_v" ADD CONSTRAINT "_signals_v_version_insight_id_insights_id_fk" FOREIGN KEY ("version_insight_id") REFERENCES "public"."insights"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_signals_v" ADD CONSTRAINT "_signals_v_version_classification_confirmed_by_id_users_id_fk" FOREIGN KEY ("version_classification_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_signals_v" ADD CONSTRAINT "_signals_v_version_created_by_id_users_id_fk" FOREIGN KEY ("version_created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_signals_v" ADD CONSTRAINT "_signals_v_version_last_edited_by_id_users_id_fk" FOREIGN KEY ("version_last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_signals_v" ADD CONSTRAINT "_signals_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_signals_v" ADD CONSTRAINT "_signals_v_version_approved_by_user_id_users_id_fk" FOREIGN KEY ("version_approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "themes_instruments" ADD CONSTRAINT "themes_instruments_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "themes_indicators" ADD CONSTRAINT "themes_indicators_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "themes" ADD CONSTRAINT "themes_classification_confirmed_by_id_users_id_fk" FOREIGN KEY ("classification_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "themes" ADD CONSTRAINT "themes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "themes" ADD CONSTRAINT "themes_last_edited_by_id_users_id_fk" FOREIGN KEY ("last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "themes" ADD CONSTRAINT "themes_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "themes" ADD CONSTRAINT "themes_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "themes_rels" ADD CONSTRAINT "themes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "themes_rels" ADD CONSTRAINT "themes_rels_insights_fk" FOREIGN KEY ("insights_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_themes_v_version_instruments" ADD CONSTRAINT "_themes_v_version_instruments_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_themes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_themes_v_version_indicators" ADD CONSTRAINT "_themes_v_version_indicators_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_themes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_themes_v" ADD CONSTRAINT "_themes_v_parent_id_themes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_themes_v" ADD CONSTRAINT "_themes_v_version_classification_confirmed_by_id_users_id_fk" FOREIGN KEY ("version_classification_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_themes_v" ADD CONSTRAINT "_themes_v_version_created_by_id_users_id_fk" FOREIGN KEY ("version_created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_themes_v" ADD CONSTRAINT "_themes_v_version_last_edited_by_id_users_id_fk" FOREIGN KEY ("version_last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_themes_v" ADD CONSTRAINT "_themes_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_themes_v" ADD CONSTRAINT "_themes_v_version_approved_by_user_id_users_id_fk" FOREIGN KEY ("version_approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_themes_v_rels" ADD CONSTRAINT "_themes_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_themes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_themes_v_rels" ADD CONSTRAINT "_themes_v_rels_insights_fk" FOREIGN KEY ("insights_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "capabilities_opportunity_set" ADD CONSTRAINT "capabilities_opportunity_set_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "capabilities_risk_considerations" ADD CONSTRAINT "capabilities_risk_considerations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "capabilities_characteristics" ADD CONSTRAINT "capabilities_characteristics_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "capabilities_markets" ADD CONSTRAINT "capabilities_markets_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "capabilities_indicators" ADD CONSTRAINT "capabilities_indicators_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "capabilities" ADD CONSTRAINT "capabilities_classification_confirmed_by_id_users_id_fk" FOREIGN KEY ("classification_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "capabilities" ADD CONSTRAINT "capabilities_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "capabilities" ADD CONSTRAINT "capabilities_last_edited_by_id_users_id_fk" FOREIGN KEY ("last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "capabilities" ADD CONSTRAINT "capabilities_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "capabilities" ADD CONSTRAINT "capabilities_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "capabilities_rels" ADD CONSTRAINT "capabilities_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "capabilities_rels" ADD CONSTRAINT "capabilities_rels_insights_fk" FOREIGN KEY ("insights_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_capabilities_v_version_opportunity_set" ADD CONSTRAINT "_capabilities_v_version_opportunity_set_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_capabilities_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_capabilities_v_version_risk_considerations" ADD CONSTRAINT "_capabilities_v_version_risk_considerations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_capabilities_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_capabilities_v_version_characteristics" ADD CONSTRAINT "_capabilities_v_version_characteristics_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_capabilities_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_capabilities_v_version_markets" ADD CONSTRAINT "_capabilities_v_version_markets_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_capabilities_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_capabilities_v_version_indicators" ADD CONSTRAINT "_capabilities_v_version_indicators_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_capabilities_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_capabilities_v" ADD CONSTRAINT "_capabilities_v_parent_id_capabilities_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."capabilities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_capabilities_v" ADD CONSTRAINT "_capabilities_v_version_classification_confirmed_by_id_users_id_fk" FOREIGN KEY ("version_classification_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_capabilities_v" ADD CONSTRAINT "_capabilities_v_version_created_by_id_users_id_fk" FOREIGN KEY ("version_created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_capabilities_v" ADD CONSTRAINT "_capabilities_v_version_last_edited_by_id_users_id_fk" FOREIGN KEY ("version_last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_capabilities_v" ADD CONSTRAINT "_capabilities_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_capabilities_v" ADD CONSTRAINT "_capabilities_v_version_approved_by_user_id_users_id_fk" FOREIGN KEY ("version_approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_capabilities_v_rels" ADD CONSTRAINT "_capabilities_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_capabilities_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_capabilities_v_rels" ADD CONSTRAINT "_capabilities_v_rels_insights_fk" FOREIGN KEY ("insights_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "legal_pages_sections_body" ADD CONSTRAINT "legal_pages_sections_body_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."legal_pages_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "legal_pages_sections" ADD CONSTRAINT "legal_pages_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."legal_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "legal_pages" ADD CONSTRAINT "legal_pages_classification_confirmed_by_id_users_id_fk" FOREIGN KEY ("classification_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "legal_pages" ADD CONSTRAINT "legal_pages_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "legal_pages" ADD CONSTRAINT "legal_pages_last_edited_by_id_users_id_fk" FOREIGN KEY ("last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "legal_pages" ADD CONSTRAINT "legal_pages_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "legal_pages" ADD CONSTRAINT "legal_pages_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_legal_pages_v_version_sections_body" ADD CONSTRAINT "_legal_pages_v_version_sections_body_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_legal_pages_v_version_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_legal_pages_v_version_sections" ADD CONSTRAINT "_legal_pages_v_version_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_legal_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_legal_pages_v" ADD CONSTRAINT "_legal_pages_v_parent_id_legal_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."legal_pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_legal_pages_v" ADD CONSTRAINT "_legal_pages_v_version_classification_confirmed_by_id_users_id_fk" FOREIGN KEY ("version_classification_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_legal_pages_v" ADD CONSTRAINT "_legal_pages_v_version_created_by_id_users_id_fk" FOREIGN KEY ("version_created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_legal_pages_v" ADD CONSTRAINT "_legal_pages_v_version_last_edited_by_id_users_id_fk" FOREIGN KEY ("version_last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_legal_pages_v" ADD CONSTRAINT "_legal_pages_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_legal_pages_v" ADD CONSTRAINT "_legal_pages_v_version_approved_by_user_id_users_id_fk" FOREIGN KEY ("version_approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_insights_fk" FOREIGN KEY ("insights_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_nusantara_views_fk" FOREIGN KEY ("nusantara_views_id") REFERENCES "public"."nusantara_views"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_market_state_editions_fk" FOREIGN KEY ("market_state_id") REFERENCES "public"."market_state"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_signals_fk" FOREIGN KEY ("signals_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_themes_fk" FOREIGN KEY ("themes_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_capabilities_fk" FOREIGN KEY ("capabilities_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_pages_fk" FOREIGN KEY ("legal_pages_id") REFERENCES "public"."legal_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_log_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."audit_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_licences" ADD CONSTRAINT "site_settings_licences_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_offices" ADD CONSTRAINT "site_settings_offices_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_leadership" ADD CONSTRAINT "site_settings_leadership_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_settings_v_version_licences" ADD CONSTRAINT "_site_settings_v_version_licences_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_settings_v_version_offices" ADD CONSTRAINT "_site_settings_v_version_offices_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_settings_v_version_leadership" ADD CONSTRAINT "_site_settings_v_version_leadership_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "insights_executive_summary_order_idx" ON "insights_executive_summary" USING btree ("_order");
  CREATE INDEX "insights_executive_summary_parent_id_idx" ON "insights_executive_summary" USING btree ("_parent_id");
  CREATE INDEX "insights_key_takeaways_order_idx" ON "insights_key_takeaways" USING btree ("_order");
  CREATE INDEX "insights_key_takeaways_parent_id_idx" ON "insights_key_takeaways" USING btree ("_parent_id");
  CREATE INDEX "insights_blocks_heading_order_idx" ON "insights_blocks_heading" USING btree ("_order");
  CREATE INDEX "insights_blocks_heading_parent_id_idx" ON "insights_blocks_heading" USING btree ("_parent_id");
  CREATE INDEX "insights_blocks_heading_path_idx" ON "insights_blocks_heading" USING btree ("_path");
  CREATE INDEX "insights_blocks_paragraph_order_idx" ON "insights_blocks_paragraph" USING btree ("_order");
  CREATE INDEX "insights_blocks_paragraph_parent_id_idx" ON "insights_blocks_paragraph" USING btree ("_parent_id");
  CREATE INDEX "insights_blocks_paragraph_path_idx" ON "insights_blocks_paragraph" USING btree ("_path");
  CREATE INDEX "insights_blocks_list_items_order_idx" ON "insights_blocks_list_items" USING btree ("_order");
  CREATE INDEX "insights_blocks_list_items_parent_id_idx" ON "insights_blocks_list_items" USING btree ("_parent_id");
  CREATE INDEX "insights_blocks_list_order_idx" ON "insights_blocks_list" USING btree ("_order");
  CREATE INDEX "insights_blocks_list_parent_id_idx" ON "insights_blocks_list" USING btree ("_parent_id");
  CREATE INDEX "insights_blocks_list_path_idx" ON "insights_blocks_list" USING btree ("_path");
  CREATE INDEX "insights_blocks_pullquote_order_idx" ON "insights_blocks_pullquote" USING btree ("_order");
  CREATE INDEX "insights_blocks_pullquote_parent_id_idx" ON "insights_blocks_pullquote" USING btree ("_parent_id");
  CREATE INDEX "insights_blocks_pullquote_path_idx" ON "insights_blocks_pullquote" USING btree ("_path");
  CREATE INDEX "insights_blocks_layer_body_order_idx" ON "insights_blocks_layer_body" USING btree ("_order");
  CREATE INDEX "insights_blocks_layer_body_parent_id_idx" ON "insights_blocks_layer_body" USING btree ("_parent_id");
  CREATE INDEX "insights_blocks_layer_order_idx" ON "insights_blocks_layer" USING btree ("_order");
  CREATE INDEX "insights_blocks_layer_parent_id_idx" ON "insights_blocks_layer" USING btree ("_parent_id");
  CREATE INDEX "insights_blocks_layer_path_idx" ON "insights_blocks_layer" USING btree ("_path");
  CREATE INDEX "insights_blocks_table_order_idx" ON "insights_blocks_table" USING btree ("_order");
  CREATE INDEX "insights_blocks_table_parent_id_idx" ON "insights_blocks_table" USING btree ("_parent_id");
  CREATE INDEX "insights_blocks_table_path_idx" ON "insights_blocks_table" USING btree ("_path");
  CREATE INDEX "insights_blocks_comparison_order_idx" ON "insights_blocks_comparison" USING btree ("_order");
  CREATE INDEX "insights_blocks_comparison_parent_id_idx" ON "insights_blocks_comparison" USING btree ("_parent_id");
  CREATE INDEX "insights_blocks_comparison_path_idx" ON "insights_blocks_comparison" USING btree ("_path");
  CREATE INDEX "insights_blocks_chart_order_idx" ON "insights_blocks_chart" USING btree ("_order");
  CREATE INDEX "insights_blocks_chart_parent_id_idx" ON "insights_blocks_chart" USING btree ("_parent_id");
  CREATE INDEX "insights_blocks_chart_path_idx" ON "insights_blocks_chart" USING btree ("_path");
  CREATE INDEX "insights_blocks_scenario_order_idx" ON "insights_blocks_scenario" USING btree ("_order");
  CREATE INDEX "insights_blocks_scenario_parent_id_idx" ON "insights_blocks_scenario" USING btree ("_parent_id");
  CREATE INDEX "insights_blocks_scenario_path_idx" ON "insights_blocks_scenario" USING btree ("_path");
  CREATE INDEX "insights_blocks_callout_order_idx" ON "insights_blocks_callout" USING btree ("_order");
  CREATE INDEX "insights_blocks_callout_parent_id_idx" ON "insights_blocks_callout" USING btree ("_parent_id");
  CREATE INDEX "insights_blocks_callout_path_idx" ON "insights_blocks_callout" USING btree ("_path");
  CREATE INDEX "insights_sources_order_idx" ON "insights_sources" USING btree ("_order");
  CREATE INDEX "insights_sources_parent_id_idx" ON "insights_sources" USING btree ("_parent_id");
  CREATE INDEX "insights_markets_order_idx" ON "insights_markets" USING btree ("order");
  CREATE INDEX "insights_markets_parent_idx" ON "insights_markets" USING btree ("parent_id");
  CREATE INDEX "insights_asset_classes_order_idx" ON "insights_asset_classes" USING btree ("order");
  CREATE INDEX "insights_asset_classes_parent_idx" ON "insights_asset_classes" USING btree ("parent_id");
  CREATE INDEX "insights_market_state_dimensions_order_idx" ON "insights_market_state_dimensions" USING btree ("order");
  CREATE INDEX "insights_market_state_dimensions_parent_idx" ON "insights_market_state_dimensions" USING btree ("parent_id");
  CREATE INDEX "insights_indicators_order_idx" ON "insights_indicators" USING btree ("order");
  CREATE INDEX "insights_indicators_parent_idx" ON "insights_indicators" USING btree ("parent_id");
  CREATE UNIQUE INDEX "insights_slug_idx" ON "insights" USING btree ("slug");
  CREATE INDEX "insights_seo_seo_image_idx" ON "insights" USING btree ("seo_image_id");
  CREATE INDEX "insights_workflow_status_idx" ON "insights" USING btree ("workflow_status");
  CREATE INDEX "insights_content_class_idx" ON "insights" USING btree ("content_class");
  CREATE INDEX "insights_classification_confirmed_by_idx" ON "insights" USING btree ("classification_confirmed_by_id");
  CREATE INDEX "insights_created_by_idx" ON "insights" USING btree ("created_by_id");
  CREATE INDEX "insights_last_edited_by_idx" ON "insights" USING btree ("last_edited_by_id");
  CREATE INDEX "insights_submitted_by_idx" ON "insights" USING btree ("submitted_by_id");
  CREATE INDEX "insights_approved_by_user_idx" ON "insights" USING btree ("approved_by_user_id");
  CREATE INDEX "insights_legacy_legacy_key_idx" ON "insights" USING btree ("legacy_key");
  CREATE INDEX "insights_updated_at_idx" ON "insights" USING btree ("updated_at");
  CREATE INDEX "insights_created_at_idx" ON "insights" USING btree ("created_at");
  CREATE INDEX "insights__status_idx" ON "insights" USING btree ("_status");
  CREATE INDEX "insights_texts_order_parent" ON "insights_texts" USING btree ("order","parent_id");
  CREATE INDEX "insights_rels_order_idx" ON "insights_rels" USING btree ("order");
  CREATE INDEX "insights_rels_parent_idx" ON "insights_rels" USING btree ("parent_id");
  CREATE INDEX "insights_rels_path_idx" ON "insights_rels" USING btree ("path");
  CREATE INDEX "insights_rels_insights_id_idx" ON "insights_rels" USING btree ("insights_id");
  CREATE INDEX "insights_rels_themes_id_idx" ON "insights_rels" USING btree ("themes_id");
  CREATE INDEX "insights_rels_capabilities_id_idx" ON "insights_rels" USING btree ("capabilities_id");
  CREATE INDEX "_insights_v_version_executive_summary_order_idx" ON "_insights_v_version_executive_summary" USING btree ("_order");
  CREATE INDEX "_insights_v_version_executive_summary_parent_id_idx" ON "_insights_v_version_executive_summary" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_version_key_takeaways_order_idx" ON "_insights_v_version_key_takeaways" USING btree ("_order");
  CREATE INDEX "_insights_v_version_key_takeaways_parent_id_idx" ON "_insights_v_version_key_takeaways" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_blocks_heading_order_idx" ON "_insights_v_blocks_heading" USING btree ("_order");
  CREATE INDEX "_insights_v_blocks_heading_parent_id_idx" ON "_insights_v_blocks_heading" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_blocks_heading_path_idx" ON "_insights_v_blocks_heading" USING btree ("_path");
  CREATE INDEX "_insights_v_blocks_paragraph_order_idx" ON "_insights_v_blocks_paragraph" USING btree ("_order");
  CREATE INDEX "_insights_v_blocks_paragraph_parent_id_idx" ON "_insights_v_blocks_paragraph" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_blocks_paragraph_path_idx" ON "_insights_v_blocks_paragraph" USING btree ("_path");
  CREATE INDEX "_insights_v_blocks_list_items_order_idx" ON "_insights_v_blocks_list_items" USING btree ("_order");
  CREATE INDEX "_insights_v_blocks_list_items_parent_id_idx" ON "_insights_v_blocks_list_items" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_blocks_list_order_idx" ON "_insights_v_blocks_list" USING btree ("_order");
  CREATE INDEX "_insights_v_blocks_list_parent_id_idx" ON "_insights_v_blocks_list" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_blocks_list_path_idx" ON "_insights_v_blocks_list" USING btree ("_path");
  CREATE INDEX "_insights_v_blocks_pullquote_order_idx" ON "_insights_v_blocks_pullquote" USING btree ("_order");
  CREATE INDEX "_insights_v_blocks_pullquote_parent_id_idx" ON "_insights_v_blocks_pullquote" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_blocks_pullquote_path_idx" ON "_insights_v_blocks_pullquote" USING btree ("_path");
  CREATE INDEX "_insights_v_blocks_layer_body_order_idx" ON "_insights_v_blocks_layer_body" USING btree ("_order");
  CREATE INDEX "_insights_v_blocks_layer_body_parent_id_idx" ON "_insights_v_blocks_layer_body" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_blocks_layer_order_idx" ON "_insights_v_blocks_layer" USING btree ("_order");
  CREATE INDEX "_insights_v_blocks_layer_parent_id_idx" ON "_insights_v_blocks_layer" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_blocks_layer_path_idx" ON "_insights_v_blocks_layer" USING btree ("_path");
  CREATE INDEX "_insights_v_blocks_table_order_idx" ON "_insights_v_blocks_table" USING btree ("_order");
  CREATE INDEX "_insights_v_blocks_table_parent_id_idx" ON "_insights_v_blocks_table" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_blocks_table_path_idx" ON "_insights_v_blocks_table" USING btree ("_path");
  CREATE INDEX "_insights_v_blocks_comparison_order_idx" ON "_insights_v_blocks_comparison" USING btree ("_order");
  CREATE INDEX "_insights_v_blocks_comparison_parent_id_idx" ON "_insights_v_blocks_comparison" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_blocks_comparison_path_idx" ON "_insights_v_blocks_comparison" USING btree ("_path");
  CREATE INDEX "_insights_v_blocks_chart_order_idx" ON "_insights_v_blocks_chart" USING btree ("_order");
  CREATE INDEX "_insights_v_blocks_chart_parent_id_idx" ON "_insights_v_blocks_chart" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_blocks_chart_path_idx" ON "_insights_v_blocks_chart" USING btree ("_path");
  CREATE INDEX "_insights_v_blocks_scenario_order_idx" ON "_insights_v_blocks_scenario" USING btree ("_order");
  CREATE INDEX "_insights_v_blocks_scenario_parent_id_idx" ON "_insights_v_blocks_scenario" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_blocks_scenario_path_idx" ON "_insights_v_blocks_scenario" USING btree ("_path");
  CREATE INDEX "_insights_v_blocks_callout_order_idx" ON "_insights_v_blocks_callout" USING btree ("_order");
  CREATE INDEX "_insights_v_blocks_callout_parent_id_idx" ON "_insights_v_blocks_callout" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_blocks_callout_path_idx" ON "_insights_v_blocks_callout" USING btree ("_path");
  CREATE INDEX "_insights_v_version_sources_order_idx" ON "_insights_v_version_sources" USING btree ("_order");
  CREATE INDEX "_insights_v_version_sources_parent_id_idx" ON "_insights_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_version_markets_order_idx" ON "_insights_v_version_markets" USING btree ("order");
  CREATE INDEX "_insights_v_version_markets_parent_idx" ON "_insights_v_version_markets" USING btree ("parent_id");
  CREATE INDEX "_insights_v_version_asset_classes_order_idx" ON "_insights_v_version_asset_classes" USING btree ("order");
  CREATE INDEX "_insights_v_version_asset_classes_parent_idx" ON "_insights_v_version_asset_classes" USING btree ("parent_id");
  CREATE INDEX "_insights_v_version_market_state_dimensions_order_idx" ON "_insights_v_version_market_state_dimensions" USING btree ("order");
  CREATE INDEX "_insights_v_version_market_state_dimensions_parent_idx" ON "_insights_v_version_market_state_dimensions" USING btree ("parent_id");
  CREATE INDEX "_insights_v_version_indicators_order_idx" ON "_insights_v_version_indicators" USING btree ("order");
  CREATE INDEX "_insights_v_version_indicators_parent_idx" ON "_insights_v_version_indicators" USING btree ("parent_id");
  CREATE INDEX "_insights_v_parent_idx" ON "_insights_v" USING btree ("parent_id");
  CREATE INDEX "_insights_v_version_version_slug_idx" ON "_insights_v" USING btree ("version_slug");
  CREATE INDEX "_insights_v_version_seo_version_seo_image_idx" ON "_insights_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_insights_v_version_version_workflow_status_idx" ON "_insights_v" USING btree ("version_workflow_status");
  CREATE INDEX "_insights_v_version_version_content_class_idx" ON "_insights_v" USING btree ("version_content_class");
  CREATE INDEX "_insights_v_version_version_classification_confirmed_by_idx" ON "_insights_v" USING btree ("version_classification_confirmed_by_id");
  CREATE INDEX "_insights_v_version_version_created_by_idx" ON "_insights_v" USING btree ("version_created_by_id");
  CREATE INDEX "_insights_v_version_version_last_edited_by_idx" ON "_insights_v" USING btree ("version_last_edited_by_id");
  CREATE INDEX "_insights_v_version_version_submitted_by_idx" ON "_insights_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "_insights_v_version_version_approved_by_user_idx" ON "_insights_v" USING btree ("version_approved_by_user_id");
  CREATE INDEX "_insights_v_version_legacy_version_legacy_key_idx" ON "_insights_v" USING btree ("version_legacy_key");
  CREATE INDEX "_insights_v_version_version_updated_at_idx" ON "_insights_v" USING btree ("version_updated_at");
  CREATE INDEX "_insights_v_version_version_created_at_idx" ON "_insights_v" USING btree ("version_created_at");
  CREATE INDEX "_insights_v_version_version__status_idx" ON "_insights_v" USING btree ("version__status");
  CREATE INDEX "_insights_v_created_at_idx" ON "_insights_v" USING btree ("created_at");
  CREATE INDEX "_insights_v_updated_at_idx" ON "_insights_v" USING btree ("updated_at");
  CREATE INDEX "_insights_v_latest_idx" ON "_insights_v" USING btree ("latest");
  CREATE INDEX "_insights_v_texts_order_parent" ON "_insights_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_insights_v_rels_order_idx" ON "_insights_v_rels" USING btree ("order");
  CREATE INDEX "_insights_v_rels_parent_idx" ON "_insights_v_rels" USING btree ("parent_id");
  CREATE INDEX "_insights_v_rels_path_idx" ON "_insights_v_rels" USING btree ("path");
  CREATE INDEX "_insights_v_rels_insights_id_idx" ON "_insights_v_rels" USING btree ("insights_id");
  CREATE INDEX "_insights_v_rels_themes_id_idx" ON "_insights_v_rels" USING btree ("themes_id");
  CREATE INDEX "_insights_v_rels_capabilities_id_idx" ON "_insights_v_rels" USING btree ("capabilities_id");
  CREATE INDEX "nusantara_views_stance_scale_order_idx" ON "nusantara_views_stance_scale" USING btree ("_order");
  CREATE INDEX "nusantara_views_stance_scale_parent_id_idx" ON "nusantara_views_stance_scale" USING btree ("_parent_id");
  CREATE INDEX "nusantara_views_what_we_are_watching_order_idx" ON "nusantara_views_what_we_are_watching" USING btree ("_order");
  CREATE INDEX "nusantara_views_what_we_are_watching_parent_id_idx" ON "nusantara_views_what_we_are_watching" USING btree ("_parent_id");
  CREATE INDEX "nusantara_views_related_markets_order_idx" ON "nusantara_views_related_markets" USING btree ("order");
  CREATE INDEX "nusantara_views_related_markets_parent_idx" ON "nusantara_views_related_markets" USING btree ("parent_id");
  CREATE INDEX "nusantara_views_market_state_dimensions_order_idx" ON "nusantara_views_market_state_dimensions" USING btree ("order");
  CREATE INDEX "nusantara_views_market_state_dimensions_parent_idx" ON "nusantara_views_market_state_dimensions" USING btree ("parent_id");
  CREATE UNIQUE INDEX "nusantara_views_key_idx" ON "nusantara_views" USING btree ("key");
  CREATE INDEX "nusantara_views_related_insight_idx" ON "nusantara_views" USING btree ("related_insight_id");
  CREATE INDEX "nusantara_views_theme_idx" ON "nusantara_views" USING btree ("theme_id");
  CREATE INDEX "nusantara_views_workflow_status_idx" ON "nusantara_views" USING btree ("workflow_status");
  CREATE INDEX "nusantara_views_content_class_idx" ON "nusantara_views" USING btree ("content_class");
  CREATE INDEX "nusantara_views_classification_confirmed_by_idx" ON "nusantara_views" USING btree ("classification_confirmed_by_id");
  CREATE INDEX "nusantara_views_created_by_idx" ON "nusantara_views" USING btree ("created_by_id");
  CREATE INDEX "nusantara_views_last_edited_by_idx" ON "nusantara_views" USING btree ("last_edited_by_id");
  CREATE INDEX "nusantara_views_submitted_by_idx" ON "nusantara_views" USING btree ("submitted_by_id");
  CREATE INDEX "nusantara_views_approved_by_user_idx" ON "nusantara_views" USING btree ("approved_by_user_id");
  CREATE INDEX "nusantara_views_legacy_legacy_key_idx" ON "nusantara_views" USING btree ("legacy_key");
  CREATE INDEX "nusantara_views_updated_at_idx" ON "nusantara_views" USING btree ("updated_at");
  CREATE INDEX "nusantara_views_created_at_idx" ON "nusantara_views" USING btree ("created_at");
  CREATE INDEX "nusantara_views__status_idx" ON "nusantara_views" USING btree ("_status");
  CREATE INDEX "_nusantara_views_v_version_stance_scale_order_idx" ON "_nusantara_views_v_version_stance_scale" USING btree ("_order");
  CREATE INDEX "_nusantara_views_v_version_stance_scale_parent_id_idx" ON "_nusantara_views_v_version_stance_scale" USING btree ("_parent_id");
  CREATE INDEX "_nusantara_views_v_version_what_we_are_watching_order_idx" ON "_nusantara_views_v_version_what_we_are_watching" USING btree ("_order");
  CREATE INDEX "_nusantara_views_v_version_what_we_are_watching_parent_id_idx" ON "_nusantara_views_v_version_what_we_are_watching" USING btree ("_parent_id");
  CREATE INDEX "_nusantara_views_v_version_related_markets_order_idx" ON "_nusantara_views_v_version_related_markets" USING btree ("order");
  CREATE INDEX "_nusantara_views_v_version_related_markets_parent_idx" ON "_nusantara_views_v_version_related_markets" USING btree ("parent_id");
  CREATE INDEX "_nusantara_views_v_version_market_state_dimensions_order_idx" ON "_nusantara_views_v_version_market_state_dimensions" USING btree ("order");
  CREATE INDEX "_nusantara_views_v_version_market_state_dimensions_parent_idx" ON "_nusantara_views_v_version_market_state_dimensions" USING btree ("parent_id");
  CREATE INDEX "_nusantara_views_v_parent_idx" ON "_nusantara_views_v" USING btree ("parent_id");
  CREATE INDEX "_nusantara_views_v_version_version_key_idx" ON "_nusantara_views_v" USING btree ("version_key");
  CREATE INDEX "_nusantara_views_v_version_version_related_insight_idx" ON "_nusantara_views_v" USING btree ("version_related_insight_id");
  CREATE INDEX "_nusantara_views_v_version_version_theme_idx" ON "_nusantara_views_v" USING btree ("version_theme_id");
  CREATE INDEX "_nusantara_views_v_version_version_workflow_status_idx" ON "_nusantara_views_v" USING btree ("version_workflow_status");
  CREATE INDEX "_nusantara_views_v_version_version_content_class_idx" ON "_nusantara_views_v" USING btree ("version_content_class");
  CREATE INDEX "_nusantara_views_v_version_version_classification_confir_idx" ON "_nusantara_views_v" USING btree ("version_classification_confirmed_by_id");
  CREATE INDEX "_nusantara_views_v_version_version_created_by_idx" ON "_nusantara_views_v" USING btree ("version_created_by_id");
  CREATE INDEX "_nusantara_views_v_version_version_last_edited_by_idx" ON "_nusantara_views_v" USING btree ("version_last_edited_by_id");
  CREATE INDEX "_nusantara_views_v_version_version_submitted_by_idx" ON "_nusantara_views_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "_nusantara_views_v_version_version_approved_by_user_idx" ON "_nusantara_views_v" USING btree ("version_approved_by_user_id");
  CREATE INDEX "_nusantara_views_v_version_legacy_version_legacy_key_idx" ON "_nusantara_views_v" USING btree ("version_legacy_key");
  CREATE INDEX "_nusantara_views_v_version_version_updated_at_idx" ON "_nusantara_views_v" USING btree ("version_updated_at");
  CREATE INDEX "_nusantara_views_v_version_version_created_at_idx" ON "_nusantara_views_v" USING btree ("version_created_at");
  CREATE INDEX "_nusantara_views_v_version_version__status_idx" ON "_nusantara_views_v" USING btree ("version__status");
  CREATE INDEX "_nusantara_views_v_created_at_idx" ON "_nusantara_views_v" USING btree ("created_at");
  CREATE INDEX "_nusantara_views_v_updated_at_idx" ON "_nusantara_views_v" USING btree ("updated_at");
  CREATE INDEX "_nusantara_views_v_latest_idx" ON "_nusantara_views_v" USING btree ("latest");
  CREATE INDEX "market_state_dimensions_stance_scale_order_idx" ON "market_state_dimensions_stance_scale" USING btree ("_order");
  CREATE INDEX "market_state_dimensions_stance_scale_parent_id_idx" ON "market_state_dimensions_stance_scale" USING btree ("_parent_id");
  CREATE INDEX "market_state_dimensions_watch_items_order_idx" ON "market_state_dimensions_watch_items" USING btree ("_order");
  CREATE INDEX "market_state_dimensions_watch_items_parent_id_idx" ON "market_state_dimensions_watch_items" USING btree ("_parent_id");
  CREATE INDEX "market_state_dimensions_order_idx" ON "market_state_dimensions" USING btree ("_order");
  CREATE INDEX "market_state_dimensions_parent_id_idx" ON "market_state_dimensions" USING btree ("_parent_id");
  CREATE INDEX "market_state_dimensions_related_insight_idx" ON "market_state_dimensions" USING btree ("related_insight_id");
  CREATE UNIQUE INDEX "market_state_key_idx" ON "market_state" USING btree ("key");
  CREATE INDEX "market_state_workflow_status_idx" ON "market_state" USING btree ("workflow_status");
  CREATE INDEX "market_state_content_class_idx" ON "market_state" USING btree ("content_class");
  CREATE INDEX "market_state_classification_confirmed_by_idx" ON "market_state" USING btree ("classification_confirmed_by_id");
  CREATE INDEX "market_state_created_by_idx" ON "market_state" USING btree ("created_by_id");
  CREATE INDEX "market_state_last_edited_by_idx" ON "market_state" USING btree ("last_edited_by_id");
  CREATE INDEX "market_state_submitted_by_idx" ON "market_state" USING btree ("submitted_by_id");
  CREATE INDEX "market_state_approved_by_user_idx" ON "market_state" USING btree ("approved_by_user_id");
  CREATE INDEX "market_state_legacy_legacy_key_idx" ON "market_state" USING btree ("legacy_key");
  CREATE INDEX "market_state_updated_at_idx" ON "market_state" USING btree ("updated_at");
  CREATE INDEX "market_state_created_at_idx" ON "market_state" USING btree ("created_at");
  CREATE INDEX "market_state__status_idx" ON "market_state" USING btree ("_status");
  CREATE INDEX "_market_state_v_version_dimensions_stance_scale_order_idx" ON "_market_state_v_version_dimensions_stance_scale" USING btree ("_order");
  CREATE INDEX "_market_state_v_version_dimensions_stance_scale_parent_id_idx" ON "_market_state_v_version_dimensions_stance_scale" USING btree ("_parent_id");
  CREATE INDEX "_market_state_v_version_dimensions_watch_items_order_idx" ON "_market_state_v_version_dimensions_watch_items" USING btree ("_order");
  CREATE INDEX "_market_state_v_version_dimensions_watch_items_parent_id_idx" ON "_market_state_v_version_dimensions_watch_items" USING btree ("_parent_id");
  CREATE INDEX "_markets_v_order_idx" ON "_markets_v" USING btree ("order");
  CREATE INDEX "_markets_v_parent_idx" ON "_markets_v" USING btree ("parent_id");
  CREATE INDEX "_market_state_v_version_dimensions_order_idx" ON "_market_state_v_version_dimensions" USING btree ("_order");
  CREATE INDEX "_market_state_v_version_dimensions_parent_id_idx" ON "_market_state_v_version_dimensions" USING btree ("_parent_id");
  CREATE INDEX "_market_state_v_version_dimensions_related_insight_idx" ON "_market_state_v_version_dimensions" USING btree ("related_insight_id");
  CREATE INDEX "_market_state_v_parent_idx" ON "_market_state_v" USING btree ("parent_id");
  CREATE INDEX "_market_state_v_version_version_key_idx" ON "_market_state_v" USING btree ("version_key");
  CREATE INDEX "_market_state_v_version_version_workflow_status_idx" ON "_market_state_v" USING btree ("version_workflow_status");
  CREATE INDEX "_market_state_v_version_version_content_class_idx" ON "_market_state_v" USING btree ("version_content_class");
  CREATE INDEX "_market_state_v_version_version_classification_confirmed_idx" ON "_market_state_v" USING btree ("version_classification_confirmed_by_id");
  CREATE INDEX "_market_state_v_version_version_created_by_idx" ON "_market_state_v" USING btree ("version_created_by_id");
  CREATE INDEX "_market_state_v_version_version_last_edited_by_idx" ON "_market_state_v" USING btree ("version_last_edited_by_id");
  CREATE INDEX "_market_state_v_version_version_submitted_by_idx" ON "_market_state_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "_market_state_v_version_version_approved_by_user_idx" ON "_market_state_v" USING btree ("version_approved_by_user_id");
  CREATE INDEX "_market_state_v_version_legacy_version_legacy_key_idx" ON "_market_state_v" USING btree ("version_legacy_key");
  CREATE INDEX "_market_state_v_version_version_updated_at_idx" ON "_market_state_v" USING btree ("version_updated_at");
  CREATE INDEX "_market_state_v_version_version_created_at_idx" ON "_market_state_v" USING btree ("version_created_at");
  CREATE INDEX "_market_state_v_version_version__status_idx" ON "_market_state_v" USING btree ("version__status");
  CREATE INDEX "_market_state_v_created_at_idx" ON "_market_state_v" USING btree ("created_at");
  CREATE INDEX "_market_state_v_updated_at_idx" ON "_market_state_v" USING btree ("updated_at");
  CREATE INDEX "_market_state_v_latest_idx" ON "_market_state_v" USING btree ("latest");
  CREATE UNIQUE INDEX "signals_key_idx" ON "signals" USING btree ("key");
  CREATE INDEX "signals_insight_idx" ON "signals" USING btree ("insight_id");
  CREATE INDEX "signals_workflow_status_idx" ON "signals" USING btree ("workflow_status");
  CREATE INDEX "signals_content_class_idx" ON "signals" USING btree ("content_class");
  CREATE INDEX "signals_classification_confirmed_by_idx" ON "signals" USING btree ("classification_confirmed_by_id");
  CREATE INDEX "signals_created_by_idx" ON "signals" USING btree ("created_by_id");
  CREATE INDEX "signals_last_edited_by_idx" ON "signals" USING btree ("last_edited_by_id");
  CREATE INDEX "signals_submitted_by_idx" ON "signals" USING btree ("submitted_by_id");
  CREATE INDEX "signals_approved_by_user_idx" ON "signals" USING btree ("approved_by_user_id");
  CREATE INDEX "signals_legacy_legacy_key_idx" ON "signals" USING btree ("legacy_key");
  CREATE INDEX "signals_updated_at_idx" ON "signals" USING btree ("updated_at");
  CREATE INDEX "signals_created_at_idx" ON "signals" USING btree ("created_at");
  CREATE INDEX "signals__status_idx" ON "signals" USING btree ("_status");
  CREATE INDEX "_signals_v_parent_idx" ON "_signals_v" USING btree ("parent_id");
  CREATE INDEX "_signals_v_version_version_key_idx" ON "_signals_v" USING btree ("version_key");
  CREATE INDEX "_signals_v_version_version_insight_idx" ON "_signals_v" USING btree ("version_insight_id");
  CREATE INDEX "_signals_v_version_version_workflow_status_idx" ON "_signals_v" USING btree ("version_workflow_status");
  CREATE INDEX "_signals_v_version_version_content_class_idx" ON "_signals_v" USING btree ("version_content_class");
  CREATE INDEX "_signals_v_version_version_classification_confirmed_by_idx" ON "_signals_v" USING btree ("version_classification_confirmed_by_id");
  CREATE INDEX "_signals_v_version_version_created_by_idx" ON "_signals_v" USING btree ("version_created_by_id");
  CREATE INDEX "_signals_v_version_version_last_edited_by_idx" ON "_signals_v" USING btree ("version_last_edited_by_id");
  CREATE INDEX "_signals_v_version_version_submitted_by_idx" ON "_signals_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "_signals_v_version_version_approved_by_user_idx" ON "_signals_v" USING btree ("version_approved_by_user_id");
  CREATE INDEX "_signals_v_version_legacy_version_legacy_key_idx" ON "_signals_v" USING btree ("version_legacy_key");
  CREATE INDEX "_signals_v_version_version_updated_at_idx" ON "_signals_v" USING btree ("version_updated_at");
  CREATE INDEX "_signals_v_version_version_created_at_idx" ON "_signals_v" USING btree ("version_created_at");
  CREATE INDEX "_signals_v_version_version__status_idx" ON "_signals_v" USING btree ("version__status");
  CREATE INDEX "_signals_v_created_at_idx" ON "_signals_v" USING btree ("created_at");
  CREATE INDEX "_signals_v_updated_at_idx" ON "_signals_v" USING btree ("updated_at");
  CREATE INDEX "_signals_v_latest_idx" ON "_signals_v" USING btree ("latest");
  CREATE INDEX "themes_instruments_order_idx" ON "themes_instruments" USING btree ("order");
  CREATE INDEX "themes_instruments_parent_idx" ON "themes_instruments" USING btree ("parent_id");
  CREATE INDEX "themes_indicators_order_idx" ON "themes_indicators" USING btree ("order");
  CREATE INDEX "themes_indicators_parent_idx" ON "themes_indicators" USING btree ("parent_id");
  CREATE UNIQUE INDEX "themes_key_idx" ON "themes" USING btree ("key");
  CREATE INDEX "themes_workflow_status_idx" ON "themes" USING btree ("workflow_status");
  CREATE INDEX "themes_content_class_idx" ON "themes" USING btree ("content_class");
  CREATE INDEX "themes_classification_confirmed_by_idx" ON "themes" USING btree ("classification_confirmed_by_id");
  CREATE INDEX "themes_created_by_idx" ON "themes" USING btree ("created_by_id");
  CREATE INDEX "themes_last_edited_by_idx" ON "themes" USING btree ("last_edited_by_id");
  CREATE INDEX "themes_submitted_by_idx" ON "themes" USING btree ("submitted_by_id");
  CREATE INDEX "themes_approved_by_user_idx" ON "themes" USING btree ("approved_by_user_id");
  CREATE INDEX "themes_legacy_legacy_key_idx" ON "themes" USING btree ("legacy_key");
  CREATE INDEX "themes_updated_at_idx" ON "themes" USING btree ("updated_at");
  CREATE INDEX "themes_created_at_idx" ON "themes" USING btree ("created_at");
  CREATE INDEX "themes__status_idx" ON "themes" USING btree ("_status");
  CREATE INDEX "themes_rels_order_idx" ON "themes_rels" USING btree ("order");
  CREATE INDEX "themes_rels_parent_idx" ON "themes_rels" USING btree ("parent_id");
  CREATE INDEX "themes_rels_path_idx" ON "themes_rels" USING btree ("path");
  CREATE INDEX "themes_rels_insights_id_idx" ON "themes_rels" USING btree ("insights_id");
  CREATE INDEX "_themes_v_version_instruments_order_idx" ON "_themes_v_version_instruments" USING btree ("order");
  CREATE INDEX "_themes_v_version_instruments_parent_idx" ON "_themes_v_version_instruments" USING btree ("parent_id");
  CREATE INDEX "_themes_v_version_indicators_order_idx" ON "_themes_v_version_indicators" USING btree ("order");
  CREATE INDEX "_themes_v_version_indicators_parent_idx" ON "_themes_v_version_indicators" USING btree ("parent_id");
  CREATE INDEX "_themes_v_parent_idx" ON "_themes_v" USING btree ("parent_id");
  CREATE INDEX "_themes_v_version_version_key_idx" ON "_themes_v" USING btree ("version_key");
  CREATE INDEX "_themes_v_version_version_workflow_status_idx" ON "_themes_v" USING btree ("version_workflow_status");
  CREATE INDEX "_themes_v_version_version_content_class_idx" ON "_themes_v" USING btree ("version_content_class");
  CREATE INDEX "_themes_v_version_version_classification_confirmed_by_idx" ON "_themes_v" USING btree ("version_classification_confirmed_by_id");
  CREATE INDEX "_themes_v_version_version_created_by_idx" ON "_themes_v" USING btree ("version_created_by_id");
  CREATE INDEX "_themes_v_version_version_last_edited_by_idx" ON "_themes_v" USING btree ("version_last_edited_by_id");
  CREATE INDEX "_themes_v_version_version_submitted_by_idx" ON "_themes_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "_themes_v_version_version_approved_by_user_idx" ON "_themes_v" USING btree ("version_approved_by_user_id");
  CREATE INDEX "_themes_v_version_legacy_version_legacy_key_idx" ON "_themes_v" USING btree ("version_legacy_key");
  CREATE INDEX "_themes_v_version_version_updated_at_idx" ON "_themes_v" USING btree ("version_updated_at");
  CREATE INDEX "_themes_v_version_version_created_at_idx" ON "_themes_v" USING btree ("version_created_at");
  CREATE INDEX "_themes_v_version_version__status_idx" ON "_themes_v" USING btree ("version__status");
  CREATE INDEX "_themes_v_created_at_idx" ON "_themes_v" USING btree ("created_at");
  CREATE INDEX "_themes_v_updated_at_idx" ON "_themes_v" USING btree ("updated_at");
  CREATE INDEX "_themes_v_latest_idx" ON "_themes_v" USING btree ("latest");
  CREATE INDEX "_themes_v_rels_order_idx" ON "_themes_v_rels" USING btree ("order");
  CREATE INDEX "_themes_v_rels_parent_idx" ON "_themes_v_rels" USING btree ("parent_id");
  CREATE INDEX "_themes_v_rels_path_idx" ON "_themes_v_rels" USING btree ("path");
  CREATE INDEX "_themes_v_rels_insights_id_idx" ON "_themes_v_rels" USING btree ("insights_id");
  CREATE INDEX "capabilities_opportunity_set_order_idx" ON "capabilities_opportunity_set" USING btree ("_order");
  CREATE INDEX "capabilities_opportunity_set_parent_id_idx" ON "capabilities_opportunity_set" USING btree ("_parent_id");
  CREATE INDEX "capabilities_risk_considerations_order_idx" ON "capabilities_risk_considerations" USING btree ("_order");
  CREATE INDEX "capabilities_risk_considerations_parent_id_idx" ON "capabilities_risk_considerations" USING btree ("_parent_id");
  CREATE INDEX "capabilities_characteristics_order_idx" ON "capabilities_characteristics" USING btree ("_order");
  CREATE INDEX "capabilities_characteristics_parent_id_idx" ON "capabilities_characteristics" USING btree ("_parent_id");
  CREATE INDEX "capabilities_markets_order_idx" ON "capabilities_markets" USING btree ("order");
  CREATE INDEX "capabilities_markets_parent_idx" ON "capabilities_markets" USING btree ("parent_id");
  CREATE INDEX "capabilities_indicators_order_idx" ON "capabilities_indicators" USING btree ("order");
  CREATE INDEX "capabilities_indicators_parent_idx" ON "capabilities_indicators" USING btree ("parent_id");
  CREATE UNIQUE INDEX "capabilities_slug_idx" ON "capabilities" USING btree ("slug");
  CREATE INDEX "capabilities_workflow_status_idx" ON "capabilities" USING btree ("workflow_status");
  CREATE INDEX "capabilities_content_class_idx" ON "capabilities" USING btree ("content_class");
  CREATE INDEX "capabilities_classification_confirmed_by_idx" ON "capabilities" USING btree ("classification_confirmed_by_id");
  CREATE INDEX "capabilities_created_by_idx" ON "capabilities" USING btree ("created_by_id");
  CREATE INDEX "capabilities_last_edited_by_idx" ON "capabilities" USING btree ("last_edited_by_id");
  CREATE INDEX "capabilities_submitted_by_idx" ON "capabilities" USING btree ("submitted_by_id");
  CREATE INDEX "capabilities_approved_by_user_idx" ON "capabilities" USING btree ("approved_by_user_id");
  CREATE INDEX "capabilities_legacy_legacy_key_idx" ON "capabilities" USING btree ("legacy_key");
  CREATE INDEX "capabilities_updated_at_idx" ON "capabilities" USING btree ("updated_at");
  CREATE INDEX "capabilities_created_at_idx" ON "capabilities" USING btree ("created_at");
  CREATE INDEX "capabilities__status_idx" ON "capabilities" USING btree ("_status");
  CREATE INDEX "capabilities_rels_order_idx" ON "capabilities_rels" USING btree ("order");
  CREATE INDEX "capabilities_rels_parent_idx" ON "capabilities_rels" USING btree ("parent_id");
  CREATE INDEX "capabilities_rels_path_idx" ON "capabilities_rels" USING btree ("path");
  CREATE INDEX "capabilities_rels_insights_id_idx" ON "capabilities_rels" USING btree ("insights_id");
  CREATE INDEX "_capabilities_v_version_opportunity_set_order_idx" ON "_capabilities_v_version_opportunity_set" USING btree ("_order");
  CREATE INDEX "_capabilities_v_version_opportunity_set_parent_id_idx" ON "_capabilities_v_version_opportunity_set" USING btree ("_parent_id");
  CREATE INDEX "_capabilities_v_version_risk_considerations_order_idx" ON "_capabilities_v_version_risk_considerations" USING btree ("_order");
  CREATE INDEX "_capabilities_v_version_risk_considerations_parent_id_idx" ON "_capabilities_v_version_risk_considerations" USING btree ("_parent_id");
  CREATE INDEX "_capabilities_v_version_characteristics_order_idx" ON "_capabilities_v_version_characteristics" USING btree ("_order");
  CREATE INDEX "_capabilities_v_version_characteristics_parent_id_idx" ON "_capabilities_v_version_characteristics" USING btree ("_parent_id");
  CREATE INDEX "_capabilities_v_version_markets_order_idx" ON "_capabilities_v_version_markets" USING btree ("order");
  CREATE INDEX "_capabilities_v_version_markets_parent_idx" ON "_capabilities_v_version_markets" USING btree ("parent_id");
  CREATE INDEX "_capabilities_v_version_indicators_order_idx" ON "_capabilities_v_version_indicators" USING btree ("order");
  CREATE INDEX "_capabilities_v_version_indicators_parent_idx" ON "_capabilities_v_version_indicators" USING btree ("parent_id");
  CREATE INDEX "_capabilities_v_parent_idx" ON "_capabilities_v" USING btree ("parent_id");
  CREATE INDEX "_capabilities_v_version_version_slug_idx" ON "_capabilities_v" USING btree ("version_slug");
  CREATE INDEX "_capabilities_v_version_version_workflow_status_idx" ON "_capabilities_v" USING btree ("version_workflow_status");
  CREATE INDEX "_capabilities_v_version_version_content_class_idx" ON "_capabilities_v" USING btree ("version_content_class");
  CREATE INDEX "_capabilities_v_version_version_classification_confirmed_idx" ON "_capabilities_v" USING btree ("version_classification_confirmed_by_id");
  CREATE INDEX "_capabilities_v_version_version_created_by_idx" ON "_capabilities_v" USING btree ("version_created_by_id");
  CREATE INDEX "_capabilities_v_version_version_last_edited_by_idx" ON "_capabilities_v" USING btree ("version_last_edited_by_id");
  CREATE INDEX "_capabilities_v_version_version_submitted_by_idx" ON "_capabilities_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "_capabilities_v_version_version_approved_by_user_idx" ON "_capabilities_v" USING btree ("version_approved_by_user_id");
  CREATE INDEX "_capabilities_v_version_legacy_version_legacy_key_idx" ON "_capabilities_v" USING btree ("version_legacy_key");
  CREATE INDEX "_capabilities_v_version_version_updated_at_idx" ON "_capabilities_v" USING btree ("version_updated_at");
  CREATE INDEX "_capabilities_v_version_version_created_at_idx" ON "_capabilities_v" USING btree ("version_created_at");
  CREATE INDEX "_capabilities_v_version_version__status_idx" ON "_capabilities_v" USING btree ("version__status");
  CREATE INDEX "_capabilities_v_created_at_idx" ON "_capabilities_v" USING btree ("created_at");
  CREATE INDEX "_capabilities_v_updated_at_idx" ON "_capabilities_v" USING btree ("updated_at");
  CREATE INDEX "_capabilities_v_latest_idx" ON "_capabilities_v" USING btree ("latest");
  CREATE INDEX "_capabilities_v_rels_order_idx" ON "_capabilities_v_rels" USING btree ("order");
  CREATE INDEX "_capabilities_v_rels_parent_idx" ON "_capabilities_v_rels" USING btree ("parent_id");
  CREATE INDEX "_capabilities_v_rels_path_idx" ON "_capabilities_v_rels" USING btree ("path");
  CREATE INDEX "_capabilities_v_rels_insights_id_idx" ON "_capabilities_v_rels" USING btree ("insights_id");
  CREATE INDEX "legal_pages_sections_body_order_idx" ON "legal_pages_sections_body" USING btree ("_order");
  CREATE INDEX "legal_pages_sections_body_parent_id_idx" ON "legal_pages_sections_body" USING btree ("_parent_id");
  CREATE INDEX "legal_pages_sections_order_idx" ON "legal_pages_sections" USING btree ("_order");
  CREATE INDEX "legal_pages_sections_parent_id_idx" ON "legal_pages_sections" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "legal_pages_slug_idx" ON "legal_pages" USING btree ("slug");
  CREATE INDEX "legal_pages_workflow_status_idx" ON "legal_pages" USING btree ("workflow_status");
  CREATE INDEX "legal_pages_content_class_idx" ON "legal_pages" USING btree ("content_class");
  CREATE INDEX "legal_pages_classification_confirmed_by_idx" ON "legal_pages" USING btree ("classification_confirmed_by_id");
  CREATE INDEX "legal_pages_created_by_idx" ON "legal_pages" USING btree ("created_by_id");
  CREATE INDEX "legal_pages_last_edited_by_idx" ON "legal_pages" USING btree ("last_edited_by_id");
  CREATE INDEX "legal_pages_submitted_by_idx" ON "legal_pages" USING btree ("submitted_by_id");
  CREATE INDEX "legal_pages_approved_by_user_idx" ON "legal_pages" USING btree ("approved_by_user_id");
  CREATE INDEX "legal_pages_legacy_legacy_key_idx" ON "legal_pages" USING btree ("legacy_key");
  CREATE INDEX "legal_pages_updated_at_idx" ON "legal_pages" USING btree ("updated_at");
  CREATE INDEX "legal_pages_created_at_idx" ON "legal_pages" USING btree ("created_at");
  CREATE INDEX "legal_pages__status_idx" ON "legal_pages" USING btree ("_status");
  CREATE INDEX "_legal_pages_v_version_sections_body_order_idx" ON "_legal_pages_v_version_sections_body" USING btree ("_order");
  CREATE INDEX "_legal_pages_v_version_sections_body_parent_id_idx" ON "_legal_pages_v_version_sections_body" USING btree ("_parent_id");
  CREATE INDEX "_legal_pages_v_version_sections_order_idx" ON "_legal_pages_v_version_sections" USING btree ("_order");
  CREATE INDEX "_legal_pages_v_version_sections_parent_id_idx" ON "_legal_pages_v_version_sections" USING btree ("_parent_id");
  CREATE INDEX "_legal_pages_v_parent_idx" ON "_legal_pages_v" USING btree ("parent_id");
  CREATE INDEX "_legal_pages_v_version_version_slug_idx" ON "_legal_pages_v" USING btree ("version_slug");
  CREATE INDEX "_legal_pages_v_version_version_workflow_status_idx" ON "_legal_pages_v" USING btree ("version_workflow_status");
  CREATE INDEX "_legal_pages_v_version_version_content_class_idx" ON "_legal_pages_v" USING btree ("version_content_class");
  CREATE INDEX "_legal_pages_v_version_version_classification_confirmed__idx" ON "_legal_pages_v" USING btree ("version_classification_confirmed_by_id");
  CREATE INDEX "_legal_pages_v_version_version_created_by_idx" ON "_legal_pages_v" USING btree ("version_created_by_id");
  CREATE INDEX "_legal_pages_v_version_version_last_edited_by_idx" ON "_legal_pages_v" USING btree ("version_last_edited_by_id");
  CREATE INDEX "_legal_pages_v_version_version_submitted_by_idx" ON "_legal_pages_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "_legal_pages_v_version_version_approved_by_user_idx" ON "_legal_pages_v" USING btree ("version_approved_by_user_id");
  CREATE INDEX "_legal_pages_v_version_legacy_version_legacy_key_idx" ON "_legal_pages_v" USING btree ("version_legacy_key");
  CREATE INDEX "_legal_pages_v_version_version_updated_at_idx" ON "_legal_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_legal_pages_v_version_version_created_at_idx" ON "_legal_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_legal_pages_v_version_version__status_idx" ON "_legal_pages_v" USING btree ("version__status");
  CREATE INDEX "_legal_pages_v_created_at_idx" ON "_legal_pages_v" USING btree ("created_at");
  CREATE INDEX "_legal_pages_v_updated_at_idx" ON "_legal_pages_v" USING btree ("updated_at");
  CREATE INDEX "_legal_pages_v_latest_idx" ON "_legal_pages_v" USING btree ("latest");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_wide_sizes_wide_filename_idx" ON "media" USING btree ("sizes_wide_filename");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");
  CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");
  CREATE INDEX "audit_log_collection_idx" ON "audit_log" USING btree ("collection");
  CREATE INDEX "audit_log_document_id_idx" ON "audit_log" USING btree ("document_id");
  CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_insights_id_idx" ON "payload_locked_documents_rels" USING btree ("insights_id");
  CREATE INDEX "payload_locked_documents_rels_nusantara_views_id_idx" ON "payload_locked_documents_rels" USING btree ("nusantara_views_id");
  CREATE INDEX "payload_locked_documents_rels_market_state_id_idx" ON "payload_locked_documents_rels" USING btree ("market_state_id");
  CREATE INDEX "payload_locked_documents_rels_signals_id_idx" ON "payload_locked_documents_rels" USING btree ("signals_id");
  CREATE INDEX "payload_locked_documents_rels_themes_id_idx" ON "payload_locked_documents_rels" USING btree ("themes_id");
  CREATE INDEX "payload_locked_documents_rels_capabilities_id_idx" ON "payload_locked_documents_rels" USING btree ("capabilities_id");
  CREATE INDEX "payload_locked_documents_rels_legal_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("legal_pages_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_log_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "site_settings_licences_order_idx" ON "site_settings_licences" USING btree ("_order");
  CREATE INDEX "site_settings_licences_parent_id_idx" ON "site_settings_licences" USING btree ("_parent_id");
  CREATE INDEX "site_settings_offices_order_idx" ON "site_settings_offices" USING btree ("_order");
  CREATE INDEX "site_settings_offices_parent_id_idx" ON "site_settings_offices" USING btree ("_parent_id");
  CREATE INDEX "site_settings_leadership_order_idx" ON "site_settings_leadership" USING btree ("_order");
  CREATE INDEX "site_settings_leadership_parent_id_idx" ON "site_settings_leadership" USING btree ("_parent_id");
  CREATE INDEX "site_settings__status_idx" ON "site_settings" USING btree ("_status");
  CREATE INDEX "_site_settings_v_version_licences_order_idx" ON "_site_settings_v_version_licences" USING btree ("_order");
  CREATE INDEX "_site_settings_v_version_licences_parent_id_idx" ON "_site_settings_v_version_licences" USING btree ("_parent_id");
  CREATE INDEX "_site_settings_v_version_offices_order_idx" ON "_site_settings_v_version_offices" USING btree ("_order");
  CREATE INDEX "_site_settings_v_version_offices_parent_id_idx" ON "_site_settings_v_version_offices" USING btree ("_parent_id");
  CREATE INDEX "_site_settings_v_version_leadership_order_idx" ON "_site_settings_v_version_leadership" USING btree ("_order");
  CREATE INDEX "_site_settings_v_version_leadership_parent_id_idx" ON "_site_settings_v_version_leadership" USING btree ("_parent_id");
  CREATE INDEX "_site_settings_v_version_version__status_idx" ON "_site_settings_v" USING btree ("version__status");
  CREATE INDEX "_site_settings_v_created_at_idx" ON "_site_settings_v" USING btree ("created_at");
  CREATE INDEX "_site_settings_v_updated_at_idx" ON "_site_settings_v" USING btree ("updated_at");
  CREATE INDEX "_site_settings_v_latest_idx" ON "_site_settings_v" USING btree ("latest");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "insights_executive_summary" CASCADE;
  DROP TABLE "insights_key_takeaways" CASCADE;
  DROP TABLE "insights_blocks_heading" CASCADE;
  DROP TABLE "insights_blocks_paragraph" CASCADE;
  DROP TABLE "insights_blocks_list_items" CASCADE;
  DROP TABLE "insights_blocks_list" CASCADE;
  DROP TABLE "insights_blocks_pullquote" CASCADE;
  DROP TABLE "insights_blocks_layer_body" CASCADE;
  DROP TABLE "insights_blocks_layer" CASCADE;
  DROP TABLE "insights_blocks_table" CASCADE;
  DROP TABLE "insights_blocks_comparison" CASCADE;
  DROP TABLE "insights_blocks_chart" CASCADE;
  DROP TABLE "insights_blocks_scenario" CASCADE;
  DROP TABLE "insights_blocks_callout" CASCADE;
  DROP TABLE "insights_sources" CASCADE;
  DROP TABLE "insights_markets" CASCADE;
  DROP TABLE "insights_asset_classes" CASCADE;
  DROP TABLE "insights_market_state_dimensions" CASCADE;
  DROP TABLE "insights_indicators" CASCADE;
  DROP TABLE "insights" CASCADE;
  DROP TABLE "insights_texts" CASCADE;
  DROP TABLE "insights_rels" CASCADE;
  DROP TABLE "_insights_v_version_executive_summary" CASCADE;
  DROP TABLE "_insights_v_version_key_takeaways" CASCADE;
  DROP TABLE "_insights_v_blocks_heading" CASCADE;
  DROP TABLE "_insights_v_blocks_paragraph" CASCADE;
  DROP TABLE "_insights_v_blocks_list_items" CASCADE;
  DROP TABLE "_insights_v_blocks_list" CASCADE;
  DROP TABLE "_insights_v_blocks_pullquote" CASCADE;
  DROP TABLE "_insights_v_blocks_layer_body" CASCADE;
  DROP TABLE "_insights_v_blocks_layer" CASCADE;
  DROP TABLE "_insights_v_blocks_table" CASCADE;
  DROP TABLE "_insights_v_blocks_comparison" CASCADE;
  DROP TABLE "_insights_v_blocks_chart" CASCADE;
  DROP TABLE "_insights_v_blocks_scenario" CASCADE;
  DROP TABLE "_insights_v_blocks_callout" CASCADE;
  DROP TABLE "_insights_v_version_sources" CASCADE;
  DROP TABLE "_insights_v_version_markets" CASCADE;
  DROP TABLE "_insights_v_version_asset_classes" CASCADE;
  DROP TABLE "_insights_v_version_market_state_dimensions" CASCADE;
  DROP TABLE "_insights_v_version_indicators" CASCADE;
  DROP TABLE "_insights_v" CASCADE;
  DROP TABLE "_insights_v_texts" CASCADE;
  DROP TABLE "_insights_v_rels" CASCADE;
  DROP TABLE "nusantara_views_stance_scale" CASCADE;
  DROP TABLE "nusantara_views_what_we_are_watching" CASCADE;
  DROP TABLE "nusantara_views_related_markets" CASCADE;
  DROP TABLE "nusantara_views_market_state_dimensions" CASCADE;
  DROP TABLE "nusantara_views" CASCADE;
  DROP TABLE "_nusantara_views_v_version_stance_scale" CASCADE;
  DROP TABLE "_nusantara_views_v_version_what_we_are_watching" CASCADE;
  DROP TABLE "_nusantara_views_v_version_related_markets" CASCADE;
  DROP TABLE "_nusantara_views_v_version_market_state_dimensions" CASCADE;
  DROP TABLE "_nusantara_views_v" CASCADE;
  DROP TABLE "market_state_dimensions_stance_scale" CASCADE;
  DROP TABLE "market_state_dimensions_watch_items" CASCADE;
  DROP TABLE "market_state_dimensions" CASCADE;
  DROP TABLE "market_state" CASCADE;
  DROP TABLE "_market_state_v_version_dimensions_stance_scale" CASCADE;
  DROP TABLE "_market_state_v_version_dimensions_watch_items" CASCADE;
  DROP TABLE "_markets_v" CASCADE;
  DROP TABLE "_market_state_v_version_dimensions" CASCADE;
  DROP TABLE "_market_state_v" CASCADE;
  DROP TABLE "signals" CASCADE;
  DROP TABLE "_signals_v" CASCADE;
  DROP TABLE "themes_instruments" CASCADE;
  DROP TABLE "themes_indicators" CASCADE;
  DROP TABLE "themes" CASCADE;
  DROP TABLE "themes_rels" CASCADE;
  DROP TABLE "_themes_v_version_instruments" CASCADE;
  DROP TABLE "_themes_v_version_indicators" CASCADE;
  DROP TABLE "_themes_v" CASCADE;
  DROP TABLE "_themes_v_rels" CASCADE;
  DROP TABLE "capabilities_opportunity_set" CASCADE;
  DROP TABLE "capabilities_risk_considerations" CASCADE;
  DROP TABLE "capabilities_characteristics" CASCADE;
  DROP TABLE "capabilities_markets" CASCADE;
  DROP TABLE "capabilities_indicators" CASCADE;
  DROP TABLE "capabilities" CASCADE;
  DROP TABLE "capabilities_rels" CASCADE;
  DROP TABLE "_capabilities_v_version_opportunity_set" CASCADE;
  DROP TABLE "_capabilities_v_version_risk_considerations" CASCADE;
  DROP TABLE "_capabilities_v_version_characteristics" CASCADE;
  DROP TABLE "_capabilities_v_version_markets" CASCADE;
  DROP TABLE "_capabilities_v_version_indicators" CASCADE;
  DROP TABLE "_capabilities_v" CASCADE;
  DROP TABLE "_capabilities_v_rels" CASCADE;
  DROP TABLE "legal_pages_sections_body" CASCADE;
  DROP TABLE "legal_pages_sections" CASCADE;
  DROP TABLE "legal_pages" CASCADE;
  DROP TABLE "_legal_pages_v_version_sections_body" CASCADE;
  DROP TABLE "_legal_pages_v_version_sections" CASCADE;
  DROP TABLE "_legal_pages_v" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "audit_log" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "site_settings_licences" CASCADE;
  DROP TABLE "site_settings_offices" CASCADE;
  DROP TABLE "site_settings_leadership" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TABLE "_site_settings_v_version_licences" CASCADE;
  DROP TABLE "_site_settings_v_version_offices" CASCADE;
  DROP TABLE "_site_settings_v_version_leadership" CASCADE;
  DROP TABLE "_site_settings_v" CASCADE;
  DROP TYPE "public"."markets";
  DROP TYPE "public"."enum_insights_blocks_layer_layer";
  DROP TYPE "public"."enum_insights_blocks_table_layer";
  DROP TYPE "public"."enum_insights_blocks_chart_kind";
  DROP TYPE "public"."enum_insights_markets";
  DROP TYPE "public"."enum_insights_asset_classes";
  DROP TYPE "public"."enum_insights_market_state_dimensions";
  DROP TYPE "public"."enum_insights_indicators";
  DROP TYPE "public"."enum_insights_category";
  DROP TYPE "public"."enum_insights_hero_motif";
  DROP TYPE "public"."enum_insights_workflow_status";
  DROP TYPE "public"."enum_insights_content_class";
  DROP TYPE "public"."enum_insights_legacy_status";
  DROP TYPE "public"."enum_insights_status";
  DROP TYPE "public"."enum__insights_v_blocks_layer_layer";
  DROP TYPE "public"."enum__insights_v_blocks_table_layer";
  DROP TYPE "public"."enum__insights_v_blocks_chart_kind";
  DROP TYPE "public"."enum__insights_v_version_markets";
  DROP TYPE "public"."enum__insights_v_version_asset_classes";
  DROP TYPE "public"."enum__insights_v_version_market_state_dimensions";
  DROP TYPE "public"."enum__insights_v_version_indicators";
  DROP TYPE "public"."enum__insights_v_version_category";
  DROP TYPE "public"."enum__insights_v_version_hero_motif";
  DROP TYPE "public"."enum__insights_v_version_workflow_status";
  DROP TYPE "public"."enum__insights_v_version_content_class";
  DROP TYPE "public"."enum__insights_v_version_legacy_status";
  DROP TYPE "public"."enum__insights_v_version_status";
  DROP TYPE "public"."enum_nusantara_views_related_markets";
  DROP TYPE "public"."enum_nusantara_views_market_state_dimensions";
  DROP TYPE "public"."enum_nusantara_views_subject_kind";
  DROP TYPE "public"."enum_nusantara_views_subject_instrument";
  DROP TYPE "public"."enum_nusantara_views_subject_asset_class";
  DROP TYPE "public"."enum_nusantara_views_subject_indicator";
  DROP TYPE "public"."enum_nusantara_views_workflow_status";
  DROP TYPE "public"."enum_nusantara_views_content_class";
  DROP TYPE "public"."enum_nusantara_views_legacy_status";
  DROP TYPE "public"."enum_nusantara_views_status";
  DROP TYPE "public"."enum__nusantara_views_v_version_related_markets";
  DROP TYPE "public"."enum__nusantara_views_v_version_market_state_dimensions";
  DROP TYPE "public"."enum__nusantara_views_v_version_subject_kind";
  DROP TYPE "public"."enum__nusantara_views_v_version_subject_instrument";
  DROP TYPE "public"."enum__nusantara_views_v_version_subject_asset_class";
  DROP TYPE "public"."enum__nusantara_views_v_version_subject_indicator";
  DROP TYPE "public"."enum__nusantara_views_v_version_workflow_status";
  DROP TYPE "public"."enum__nusantara_views_v_version_content_class";
  DROP TYPE "public"."enum__nusantara_views_v_version_legacy_status";
  DROP TYPE "public"."enum__nusantara_views_v_version_status";
  DROP TYPE "public"."enum_market_state_dimensions_dimension";
  DROP TYPE "public"."enum_market_state_dimensions_dimension_status";
  DROP TYPE "public"."enum_market_state_workflow_status";
  DROP TYPE "public"."enum_market_state_content_class";
  DROP TYPE "public"."enum_market_state_legacy_status";
  DROP TYPE "public"."enum_market_state_status";
  DROP TYPE "public"."enum__market_state_v_version_dimensions_dimension";
  DROP TYPE "public"."enum__market_state_v_version_dimensions_dimension_status";
  DROP TYPE "public"."enum__market_state_v_version_workflow_status";
  DROP TYPE "public"."enum__market_state_v_version_content_class";
  DROP TYPE "public"."enum__market_state_v_version_legacy_status";
  DROP TYPE "public"."enum__market_state_v_version_status";
  DROP TYPE "public"."enum_signals_instrument";
  DROP TYPE "public"."enum_signals_workflow_status";
  DROP TYPE "public"."enum_signals_content_class";
  DROP TYPE "public"."enum_signals_legacy_status";
  DROP TYPE "public"."enum_signals_status";
  DROP TYPE "public"."enum__signals_v_version_instrument";
  DROP TYPE "public"."enum__signals_v_version_workflow_status";
  DROP TYPE "public"."enum__signals_v_version_content_class";
  DROP TYPE "public"."enum__signals_v_version_legacy_status";
  DROP TYPE "public"."enum__signals_v_version_status";
  DROP TYPE "public"."enum_themes_instruments";
  DROP TYPE "public"."enum_themes_indicators";
  DROP TYPE "public"."enum_themes_workflow_status";
  DROP TYPE "public"."enum_themes_content_class";
  DROP TYPE "public"."enum_themes_legacy_status";
  DROP TYPE "public"."enum_themes_status";
  DROP TYPE "public"."enum__themes_v_version_instruments";
  DROP TYPE "public"."enum__themes_v_version_indicators";
  DROP TYPE "public"."enum__themes_v_version_workflow_status";
  DROP TYPE "public"."enum__themes_v_version_content_class";
  DROP TYPE "public"."enum__themes_v_version_legacy_status";
  DROP TYPE "public"."enum__themes_v_version_status";
  DROP TYPE "public"."enum_capabilities_markets";
  DROP TYPE "public"."enum_capabilities_indicators";
  DROP TYPE "public"."enum_capabilities_capability_status";
  DROP TYPE "public"."enum_capabilities_stage";
  DROP TYPE "public"."enum_capabilities_profile_liquidity";
  DROP TYPE "public"."enum_capabilities_profile_income";
  DROP TYPE "public"."enum_capabilities_profile_complexity";
  DROP TYPE "public"."enum_capabilities_profile_valuation_frequency";
  DROP TYPE "public"."enum_capabilities_workflow_status";
  DROP TYPE "public"."enum_capabilities_content_class";
  DROP TYPE "public"."enum_capabilities_legacy_status";
  DROP TYPE "public"."enum_capabilities_status";
  DROP TYPE "public"."enum__capabilities_v_version_markets";
  DROP TYPE "public"."enum__capabilities_v_version_indicators";
  DROP TYPE "public"."enum__capabilities_v_version_capability_status";
  DROP TYPE "public"."enum__capabilities_v_version_stage";
  DROP TYPE "public"."enum__capabilities_v_version_profile_liquidity";
  DROP TYPE "public"."enum__capabilities_v_version_profile_income";
  DROP TYPE "public"."enum__capabilities_v_version_profile_complexity";
  DROP TYPE "public"."enum__capabilities_v_version_profile_valuation_frequency";
  DROP TYPE "public"."enum__capabilities_v_version_workflow_status";
  DROP TYPE "public"."enum__capabilities_v_version_content_class";
  DROP TYPE "public"."enum__capabilities_v_version_legacy_status";
  DROP TYPE "public"."enum__capabilities_v_version_status";
  DROP TYPE "public"."enum_legal_pages_slug";
  DROP TYPE "public"."enum_legal_pages_workflow_status";
  DROP TYPE "public"."enum_legal_pages_content_class";
  DROP TYPE "public"."enum_legal_pages_legacy_status";
  DROP TYPE "public"."enum_legal_pages_status";
  DROP TYPE "public"."enum__legal_pages_v_version_slug";
  DROP TYPE "public"."enum__legal_pages_v_version_workflow_status";
  DROP TYPE "public"."enum__legal_pages_v_version_content_class";
  DROP TYPE "public"."enum__legal_pages_v_version_legacy_status";
  DROP TYPE "public"."enum__legal_pages_v_version_status";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_audit_log_action";
  DROP TYPE "public"."enum_site_settings_status";
  DROP TYPE "public"."enum__site_settings_v_version_status";`)
}
