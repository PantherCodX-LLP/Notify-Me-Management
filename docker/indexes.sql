-- Indexes that make the dashboard's heavy aggregates fast on the local snapshot.
-- Unique names avoid colliding with indexes already present in the dump.
-- Run with `mysql --force` so pre-existing/duplicate indexes don't abort the rest.

ALTER TABLE variant_stock_notifications ADD INDEX ix_vsn_fun_user (fun_type, user_id);
ALTER TABLE variant_stock_notifications ADD INDEX ix_vsn_user_sent (user_id, is_sent);
ALTER TABLE variant_stock_notifications ADD INDEX ix_vsn_created (created_at);
ALTER TABLE variant_stock_notifications ADD INDEX ix_vsn_sent (is_sent);
ALTER TABLE variant_stock_notifications ADD INDEX ix_vsn_type (type);

ALTER TABLE charges ADD INDEX ix_charges_user_status (user_id, status);
ALTER TABLE preorder_notification_logs ADD INDEX ix_pnl_user_created (user_id, created_at);
ALTER TABLE preorder_offers ADD INDEX ix_po_user (user_id);
ALTER TABLE bis_analytics_daily ADD INDEX ix_bad_user (user_id);
ALTER TABLE bis_analytics_products ADD INDEX ix_bap_user (user_id);
ALTER TABLE shopify_usage_base_charges ADD INDEX ix_subc_user (user_id);
ALTER TABLE users ADD INDEX ix_users_deleted_plan (deleted_at, plan_id);
