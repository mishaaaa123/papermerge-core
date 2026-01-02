#!/bin/sh
# This script adds @property methods to auth_server's User ORM model
# to compute home_folder_id and inbox_folder_id from special_folders table
# instead of querying non-existent columns.

FILE="/auth_server_app/auth_server/db/orm.py"

if [ ! -f "$FILE" ]; then
    echo "Error: $FILE not found."
    exit 1
fi

echo "Adding @property methods to User model for home_folder_id and inbox_folder_id..."

# Use Python to add the properties
python3 << 'PYTHON_SCRIPT'
file_path = "/auth_server_app/auth_server/db/orm.py"

with open(file_path, 'r') as f:
    content = f.read()

# Check if properties already exist
if '@property' in content and 'def home_folder_id' in content:
    print("Properties already exist, skipping...")
    exit(0)

# Find the end of the User class (before __mapper_args__)
# We'll add the properties before __mapper_args__
properties_code = '''
    @property
    def home_folder_id(self):
        """
        Get the home folder ID for this user from special_folders table.
        This property provides backward compatibility with code that expects
        home_folder_id to be a column on the User model.
        """
        from sqlalchemy import select, and_
        from auth_server.db.engine import Session
        
        # Query special_folders table directly
        with Session() as session:
            stmt = select(
                session.query("special_folders.folder_id")
                .where(
                    and_(
                        session.query("special_folders.owner_type") == "user",
                        session.query("special_folders.owner_id") == self.id,
                        session.query("special_folders.folder_type") == "home"
                    )
                )
                .limit(1)
            )
            result = session.execute(stmt).scalar_one_or_none()
            return result

    @property
    def inbox_folder_id(self):
        """
        Get the inbox folder ID for this user from special_folders table.
        This property provides backward compatibility with code that expects
        inbox_folder_id to be a column on the User model.
        """
        from sqlalchemy import select, and_
        from auth_server.db.engine import Session
        
        # Query special_folders table directly
        with Session() as session:
            stmt = select(
                session.query("special_folders.folder_id")
                .where(
                    and_(
                        session.query("special_folders.owner_type") == "user",
                        session.query("special_folders.owner_id") == self.id,
                        session.query("special_folders.folder_type") == "inbox"
                    )
                )
                .limit(1)
            )
            result = session.execute(stmt).scalar_one_or_none()
            return result

'''

# Use raw SQL queries with object's session
properties_code = '''
    @property
    def home_folder_id(self):
        """
        Get the home folder ID for this user from special_folders table.
        This property provides backward compatibility with code that expects
        home_folder_id to be a column on the User model.
        """
        from sqlalchemy import text
        from sqlalchemy.orm import object_session
        
        # Use the session from the object's context
        session = object_session(self)
        if session is None:
            return None
        
        # Query special_folders table directly using raw SQL
        result = session.execute(
            text("""
                SELECT folder_id 
                FROM special_folders 
                WHERE owner_type = 'user' 
                  AND owner_id = :user_id 
                  AND folder_type = 'home'
                LIMIT 1
            """),
            {"user_id": str(self.id)}
        ).scalar_one_or_none()
        return result

    @property
    def inbox_folder_id(self):
        """
        Get the inbox folder ID for this user from special_folders table.
        This property provides backward compatibility with code that expects
        inbox_folder_id to be a column on the User model.
        """
        from sqlalchemy import text
        from sqlalchemy.orm import object_session
        
        # Use the session from the object's context
        session = object_session(self)
        if session is None:
            return None
        
        # Query special_folders table directly using raw SQL
        result = session.execute(
            text("""
                SELECT folder_id 
                FROM special_folders 
                WHERE owner_type = 'user' 
                  AND owner_id = :user_id 
                  AND folder_type = 'inbox'
                LIMIT 1
            """),
            {"user_id": str(self.id)}
        ).scalar_one_or_none()
        return result

'''

# Find where to insert (before __mapper_args__)
if '__mapper_args__' in content:
    # Insert before __mapper_args__
    insertion_point = content.find('    __mapper_args__')
    new_content = content[:insertion_point] + properties_code + '\n' + content[insertion_point:]
else:
    # If no __mapper_args__, add at the end of the class
    # Find the last method/attribute before the class ends
    # Look for the last relationship or mapped_column
    lines = content.split('\n')
    insertion_idx = len(lines)
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].strip().startswith('__mapper_args__') or lines[i].strip() == '':
            insertion_idx = i
            break
    
    lines.insert(insertion_idx, properties_code)
    new_content = '\n'.join(lines)

with open(file_path, 'w') as f:
    f.write(new_content)

print("Added @property methods to User model")
PYTHON_SCRIPT

echo "Fixed auth server User properties"

