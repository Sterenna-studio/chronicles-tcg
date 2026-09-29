#!/usr/bin/env python3
"""
Utility script to append new title unlock codes to the secret codes module.

This script provides a simple command‑line interface for adding new
one‑time title codes to the `SECRET_CODES` object defined in
`modules/secretCodes.js`.  Each new code will point to `_mkTitleExec`
for the provided title identifier.  Example usage:

    python add_secret_code.py MYCODE123 apprenti

This will append the following entry just above the closing brace of
`SECRET_CODES`:

    'MYCODE123': { key:'ct_apprenti', oneTime:true, label:'🏆 Titre', exec: _mkTitleExec('apprenti') },

If the supplied code already exists in the object, the script will
refuse to add a duplicate.  The script assumes it is run from the
project root so that relative paths resolve correctly.
"""
import sys
import os

def main():
    if len(sys.argv) != 3:
        print("Usage: python add_secret_code.py <CODE> <TITLE_ID>")
        sys.exit(1)
    code = sys.argv[1].strip().upper()
    title_id = sys.argv[2].strip()
    # Define the path to the module file relative to this script
    module_path = os.path.join(os.path.dirname(__file__), 'modules', 'secretCodes.js')
    if not os.path.isfile(module_path):
        print(f"Error: Could not find module file at {module_path}")
        sys.exit(1)
    with open(module_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    # Check if code already exists
    code_key = f"'{code}'"
    if any(code_key in line for line in lines):
        print(f"The code {code} already exists in {module_path}. Aborting.")
        sys.exit(1)
    # Find insertion index: locate the line with the closing brace of SECRET_CODES
    insert_idx = None
    for i, line in enumerate(lines):
        # naive approach: closing brace of SECRET_CODES object is the first
        # standalone line containing `};` after the definitions
        if line.strip() == '};':
            insert_idx = i
            break
    if insert_idx is None:
        print("Error: Could not find the end of the SECRET_CODES object.\n"
              "Ensure that modules/secretCodes.js has not been drastically modified.")
        sys.exit(1)
    # Construct new entry string
    new_entry = (f"  '{code}': {{ key:'ct_{title_id}', oneTime:true, label:'🏆 Titre', "
                 f"exec: _mkTitleExec('{title_id}') }},\n")
    # Insert the new entry before the closing brace line
    lines.insert(insert_idx, new_entry)
    # Write back to file
    with open(module_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f"Added code {code} with title id {title_id} to SECRET_CODES.")

if __name__ == '__main__':
    main()