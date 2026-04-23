from sqlalchemy import text


def ensure_compat_schema(engine) -> None:
    statements = [
        "ALTER TABLE groups ADD COLUMN IF NOT EXISTS subscription_mode VARCHAR DEFAULT 'open' NOT NULL",
        "ALTER TABLE groups ADD COLUMN IF NOT EXISTS allow_member_invites BOOLEAN DEFAULT FALSE NOT NULL",
        "ALTER TABLE groups ADD COLUMN IF NOT EXISTS max_members INTEGER NULL",
        "ALTER TABLE groups ADD COLUMN IF NOT EXISTS partition_slot INTEGER DEFAULT 0 NOT NULL",
        "ALTER TABLE groups ADD COLUMN IF NOT EXISTS replica_group VARCHAR DEFAULT 'primary' NOT NULL",
        "ALTER TABLE group_members ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'member' NOT NULL",
        "ALTER TABLE group_members ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'active' NOT NULL",
        "ALTER TABLE group_members ADD COLUMN IF NOT EXISTS invited_by INTEGER NULL",
        "ALTER TABLE group_members ADD COLUMN IF NOT EXISTS approved_by INTEGER NULL",
        "ALTER TABLE group_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW()",
        "ALTER TABLE group_members ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ NULL",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name VARCHAR NULL",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_path VARCHAR NULL",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_size INTEGER NULL",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_type VARCHAR NULL",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_checksum VARCHAR NULL",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS storage_provider VARCHAR NULL",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel_id INTEGER NULL",
        (
            "CREATE TABLE IF NOT EXISTS group_message_receipts ("
            "id SERIAL PRIMARY KEY, "
            "message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE, "
            "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
            "delivered_at TIMESTAMPTZ NULL, "
            "read_at TIMESTAMPTZ NULL, "
            "created_at TIMESTAMPTZ DEFAULT NOW(), "
            "CONSTRAINT uq_group_message_receipt UNIQUE (message_id, user_id))"
        ),
        "ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS file_checksum VARCHAR NULL",
        "ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS storage_provider VARCHAR NULL",
        (
            "CREATE TABLE IF NOT EXISTS direct_message_receipts ("
            "id SERIAL PRIMARY KEY, "
            "message_id INTEGER NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE, "
            "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
            "delivered_at TIMESTAMPTZ NULL, "
            "read_at TIMESTAMPTZ NULL, "
            "created_at TIMESTAMPTZ DEFAULT NOW(), "
            "CONSTRAINT uq_dm_receipt UNIQUE (message_id, user_id))"
        ),
        (
            "CREATE TABLE IF NOT EXISTS group_channels ("
            "id SERIAL PRIMARY KEY, "
            "group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE, "
            "name VARCHAR NOT NULL, "
            "description VARCHAR NULL, "
            "created_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL, "
            "is_default BOOLEAN DEFAULT FALSE NOT NULL, "
            "partition_slot INTEGER DEFAULT 0 NOT NULL, "
            "replica_group VARCHAR DEFAULT 'primary' NOT NULL, "
            "created_at TIMESTAMPTZ DEFAULT NOW(), "
            "CONSTRAINT uq_group_channel_name UNIQUE (group_id, name))"
        ),
        (
            "CREATE TABLE IF NOT EXISTS group_contacts ("
            "id SERIAL PRIMARY KEY, "
            "group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE, "
            "owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
            "contact_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
            "created_at TIMESTAMPTZ DEFAULT NOW(), "
            "CONSTRAINT uq_group_contact UNIQUE (group_id, owner_user_id, contact_user_id))"
        ),
    ]
    with engine.begin() as connection:
        for stmt in statements:
            connection.execute(text(stmt))
        connection.execute(
            text(
                "DO $$ BEGIN "
                "IF NOT EXISTS ("
                "SELECT 1 FROM information_schema.table_constraints "
                "WHERE constraint_name = 'fk_messages_channel_id' AND table_name = 'messages'"
                ") THEN "
                "ALTER TABLE messages "
                "ADD CONSTRAINT fk_messages_channel_id "
                "FOREIGN KEY (channel_id) REFERENCES group_channels(id) ON DELETE SET NULL; "
                "END IF; "
                "END $$;"
            )
        )
