#!/bin/sh
# This script patches the auth_server's API to remove
# home_folder_id and inbox_folder_id usage and fix folder creation.

FILE="/auth_server_app/auth_server/db/api.py"

if [ ! -f "$FILE" ]; then
    echo "Error: $FILE not found."
    exit 1
fi

echo "Patching $FILE to fix user and folder creation..."

# Use Python to replace the entire create_user implementation
python3 << 'PYTHON_SCRIPT'
import re
import textwrap

file_path = "/auth_server_app/auth_server/db/api.py"

with open(file_path, 'r') as f:
    content = f.read()

new_create_user = textwrap.dedent('''
    def create_user(
        session: Session,
        username: str,
        email: str,
        password: str,
        first_name: str | None = None,
        last_name: str | None = None,
        is_superuser: bool = True,
        is_active: bool = True,
        role_names: list[str] | None = None) -> schema.User:
        """Creates a user"""

        if role_names is None:
            role_names = []

        user_id = uuid.uuid4()
        home_id = uuid.uuid4()
        inbox_id = uuid.uuid4()

        session.execute(text("SET CONSTRAINTS ALL DEFERRED"))
        session.execute(text("ALTER TABLE users DISABLE TRIGGER ensure_user_special_folders_after_insert"))

        def _create_folder(folder_id: uuid.UUID, title: str):
            session.execute(text("""
                INSERT INTO nodes (id, title, ctype, lang, parent_id, created_at, updated_at, created_by)
                VALUES (:folder_id, :title, 'folder', :lang, NULL, now(), now(), :user_id)
            """), {
                'folder_id': str(folder_id),
                'title': title,
                'lang': 'xxx',
                'user_id': str(user_id),
            })
            session.execute(text("""
                INSERT INTO folders (node_id) VALUES (:folder_id)
            """), {'folder_id': str(folder_id)})

        _create_folder(inbox_id, constants.INBOX_TITLE)
        _create_folder(home_id, constants.HOME_TITLE)

        db_user = orm.User(
            id=user_id,
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            is_superuser=is_superuser,
            is_active=is_active,
            password=pbkdf2_sha256.hash(password),
        )

        session.add(db_user)
        session.flush()

        session.execute(text("""
            INSERT INTO special_folders (id, owner_type, owner_id, folder_type, folder_id, created_at, updated_at)
            VALUES 
            (:home_sf_id, 'user', :user_id, 'home', :home_id, now(), now()),
            (:inbox_sf_id, 'user', :user_id, 'inbox', :inbox_id, now(), now())
        """), {
            'home_sf_id': str(uuid.uuid4()),
            'inbox_sf_id': str(uuid.uuid4()),
            'user_id': str(user_id),
            'home_id': str(home_id),
            'inbox_id': str(inbox_id)
        })
        session.flush()

        # Create ownership records for home and inbox folders
        session.execute(text("""
            INSERT INTO ownerships (owner_type, owner_id, resource_type, resource_id)
            VALUES 
            ('user', :user_id, 'node', :home_id),
            ('user', :user_id, 'node', :inbox_id)
            ON CONFLICT (resource_type, resource_id) DO UPDATE SET
                owner_type = EXCLUDED.owner_type,
                owner_id = EXCLUDED.owner_id
        """), {
            'user_id': str(user_id),
            'home_id': str(home_id),
            'inbox_id': str(inbox_id)
        })
        session.flush()

        session.execute(text("ALTER TABLE users ENABLE TRIGGER ensure_user_special_folders_after_insert"))

        stmt = select(orm.Role).where(orm.Role.name.in_(role_names))
        roles = session.execute(stmt).scalars().all()
        db_user.roles = roles

        setattr(db_user, "home_folder_id", home_id)
        setattr(db_user, "inbox_folder_id", inbox_id)

        session.commit()

        return schema.User.model_validate(db_user)
''')

pattern = r"def create_user\((?:.|\n)*?return schema\.User\.model_validate\(db_user\)\n"
content, count = re.subn(pattern, new_create_user + "\n", content)

if count == 0:
    raise RuntimeError("Failed to replace create_user function")

with open(file_path, 'w') as f:
    f.write(content)

print("Fixed auth server API")
PYTHON_SCRIPT

# Relax schema validation for optional special folder IDs
python3 << 'PYTHON_SCRIPT'
import re
schema_path = "/auth_server_app/auth_server/schema.py"

with open(schema_path, "r") as f:
    schema_content = f.read()

schema_content, count1 = re.subn(
    r"home_folder_id:\s*UUID(?!\s*\|)",
    "home_folder_id: UUID | None = None",
    schema_content,
    count=1,
)
schema_content, count2 = re.subn(
    r"inbox_folder_id:\s*UUID(?!\s*\|)",
    "inbox_folder_id: UUID | None = None",
    schema_content,
    count=1,
)

with open(schema_path, "w") as f:
    f.write(schema_content)

print("Updated auth server schema")
PYTHON_SCRIPT

echo "Fixed auth server API"

