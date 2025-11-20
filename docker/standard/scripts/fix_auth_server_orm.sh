#!/bin/sh
# This script patches the auth_server's ORM model to remove
# home_folder_id and inbox_folder_id which were removed from the main DB.

FILE="/auth_server_app/auth_server/db/orm.py"

if [ ! -f "$FILE" ]; then
    echo "Error: $FILE not found."
    exit 1
fi

echo "Patching $FILE to remove home_folder_id and inbox_folder_id..."

# Use Python to properly remove the problematic lines and clean up orphaned lines
python3 << 'PYTHON_SCRIPT'
file_path = "/auth_server_app/auth_server/db/orm.py"

with open(file_path, 'r') as f:
    lines = f.readlines()

# Find lines containing home_folder_id or inbox_folder_id
filtered_lines = []
skip_until_field = False
i = 0

while i < len(lines):
    line = lines[i]
    
    # Check if this line starts a home_folder_id or inbox_folder_id definition
    if 'home_folder_id: Mapped[UUID]' in line or 'inbox_folder_id: Mapped[UUID]' in line:
        # Skip this line and all following lines until we hit the next field definition
        i += 1
        # Skip until we find a line that starts a new field (starts with spaces followed by a word and colon)
        while i < len(lines):
            stripped = lines[i].strip()
            # Stop when we hit a new field definition or class end
            if (stripped and not stripped.startswith(('nullable=', 'back_populates=', 'viewonly=', 'cascade=', 'ForeignKey', 'primaryjoin=', ')'))) or stripped.startswith(('created_at', 'date_joined', 'updated_at', 'roles', 'groups', '__mapper')):
                break
            i += 1
        continue
    
    # Check if this is the home_folder or inbox_folder relationship
    if 'home_folder: Mapped["Folder"]' in line or 'inbox_folder: Mapped["Folder"]' in line:
        # Skip this line and all following lines until we hit the next field definition
        i += 1
        while i < len(lines):
            stripped = lines[i].strip()
            if (stripped and not stripped.startswith(('nullable=', 'back_populates=', 'viewonly=', 'cascade=', 'ForeignKey', 'primaryjoin=', ')'))) or stripped.startswith(('created_at', 'date_joined', 'updated_at', 'roles', 'groups', '__mapper')):
                break
            i += 1
        continue
    
    # Remove orphaned parameter lines (lines that are just parameters without a parent definition)
    stripped = line.strip()
    if stripped in ('nullable=True,', 'back_populates="user",', 'viewonly=True,', 'cascade="delete",'):
        # Check if previous non-empty line is a valid definition
        prev_valid = False
        for j in range(len(filtered_lines) - 1, -1, -1):
            if filtered_lines[j].strip():
                prev_valid = any(keyword in filtered_lines[j] for keyword in [': Mapped', '= mapped_column', '= relationship'])
                break
        if not prev_valid:
            # This is an orphaned line, skip it
            i += 1
            continue
    
    # Remove orphaned closing parens
    if stripped == ')' and filtered_lines and filtered_lines[-1].strip() == ')':
        i += 1
        continue
    
    filtered_lines.append(line)
    i += 1

# Write back
with open(file_path, 'w') as f:
    f.writelines(filtered_lines)

print("Fixed auth server ORM model")
PYTHON_SCRIPT

echo "Fixed auth server ORM model"

