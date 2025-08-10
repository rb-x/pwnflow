#!/usr/bin/env python3
"""
User management CLI tool
"""

import asyncio
import secrets
import sys
from neo4j import AsyncSession
from db.database import get_driver, close_driver
from crud import user as user_crud
from schemas.user import UserCreate, UserUpdate
from core.security import get_password_hash


async def create_user(username: str, email: str, password: str = None):
    """Create a user"""
    if not password:
        password = secrets.token_urlsafe(16)
    
    driver = get_driver()
    
    try:
        async with driver.session() as session:
            # Check if user already exists
            existing_user = await user_crud.get_user_by_username(session, username=username)
            if existing_user:
                print(f"Error: User '{username}' already exists")
                return False
            
            # Create user
            new_user = UserCreate(
                username=username,
                email=email,
                password=password
            )
            
            await user_crud.create_user(session, user_in=new_user)
            print(f"User created successfully:")
            print(f"Username: {username}")
            print(f"Password: {password}")
            print(f"Email: {email}")
            return True
            
    except Exception as e:
        print(f"Error creating user: {e}")
        return False
    finally:
        await close_driver()


async def reset_user_password(username: str, new_password: str = None):
    """Reset user password"""
    if not new_password:
        new_password = secrets.token_urlsafe(16)
    
    driver = get_driver()
    
    try:
        async with driver.session() as session:
            # Get user
            user = await user_crud.get_user_by_username(session, username=username)
            if not user:
                print(f"Error: User '{username}' not found")
                return False
            
            # Update password
            user_update = UserUpdate(password=new_password)
            updated_user = await user_crud.update_user(session, user_id=user.id, user_update=user_update)
            
            if updated_user:
                print(f"Password reset successfully for user '{username}':")
                print(f"New password: {new_password}")
                return True
            else:
                print(f"Error: Failed to update password for user '{username}'")
                return False
                
    except Exception as e:
        print(f"Error resetting password: {e}")
        return False
    finally:
        await close_driver()


async def list_users():
    """List all users"""
    driver = get_driver()
    
    try:
        async with driver.session() as session:
            result = await session.run("MATCH (u:User) RETURN u.username, u.email, u.id, u.is_active")
            users = []
            async for record in result:
                users.append({
                    'username': record['u.username'],
                    'email': record['u.email'],
                    'id': record['u.id'],
                    'is_active': record['u.is_active']
                })
            
            if users:
                print(f"Found {len(users)} users:")
                for user in users:
                    status = "active" if user['is_active'] else "inactive"
                    print(f"  - {user['username']} ({user['email']}) - {status}")
            else:
                print("No users found")
                
    except Exception as e:
        print(f"Error listing users: {e}")
    finally:
        await close_driver()


def main():
    """Main CLI interface"""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python create_user.py create <username> <email> [password]")
        print("  python create_user.py reset <username> [new_password]")
        print("  python create_user.py list")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "create":
        if len(sys.argv) < 4:
            print("Usage: python create_user.py create <username> <email> [password]")
            sys.exit(1)
        
        username = sys.argv[2]
        email = sys.argv[3]
        password = sys.argv[4] if len(sys.argv) > 4 else None
        
        asyncio.run(create_user(username, email, password))
        
    elif command == "reset":
        if len(sys.argv) < 3:
            print("Usage: python create_user.py reset <username> [new_password]")
            sys.exit(1)
        
        username = sys.argv[2]
        new_password = sys.argv[3] if len(sys.argv) > 3 else None
        
        asyncio.run(reset_user_password(username, new_password))
        
    elif command == "list":
        asyncio.run(list_users())
        
    else:
        print(f"Unknown command: {command}")
        print("Available commands: create, reset, list")
        sys.exit(1)


if __name__ == "__main__":
    main()