#!/usr/bin/env python3
"""
Fix all relative imports to absolute imports for Docker compatibility
"""
import os
import re

def fix_imports_in_file(filepath):
    """Fix relative imports in a single file"""
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Replace relative imports with absolute imports
    # Pattern: from ..module import something -> from module import something
    # Pattern: from ...module import something -> from module import something
    content = re.sub(r'from \.\.\.(\w+)', r'from \1', content)
    content = re.sub(r'from \.\.(\w+)', r'from \1', content)
    content = re.sub(r'from \.(\w+)', r'from \1', content)
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"Fixed imports in {filepath}")

# Walk through all Python files
for root, dirs, files in os.walk('.'):
    # Skip __pycache__ directories
    dirs[:] = [d for d in dirs if d != '__pycache__']
    
    for file in files:
        if file.endswith('.py') and file != 'fix_imports.py':
            filepath = os.path.join(root, file)
            fix_imports_in_file(filepath)

print("Done fixing imports!")