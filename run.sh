#!/bin/bash

# Penflow Docker Runner Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to show usage
usage() {
    echo "Usage: $0 [dev|prod|stop|clean]"
    echo ""
    echo "Commands:"
    echo "  dev    - Run in development mode (ports exposed)"
    echo "  prod   - Run in production mode (through nginx)"
    echo "  stop   - Stop all containers"
    echo "  clean  - Stop and remove all containers and volumes"
    echo ""
    echo "Examples:"
    echo "  $0 dev     # Start development environment"
    echo "  $0 prod    # Start production environment"
    echo "  $0 stop    # Stop running containers"
    echo "  $0 clean   # Clean everything"
}

# Check if docker and docker-compose are installed
check_requirements() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi

    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    else
        print_error "Docker Compose is not installed"
        exit 1
    fi
}

# Main logic
check_requirements

case "$1" in
    dev)
        print_info "Starting development environment..."

        # Load environment variables from .env.development if it exists
        if [ -f "./.env.development" ]; then
            # Export only valid environment variables (skip comments and empty lines)
            set -a
            source ./.env.development
            set +a
        else
            print_warning "No .env.development file found"
            print_info "Creating .env.development file with secure defaults..."

            # Generate secure values for development
            JWT_SECRET=$(openssl rand -hex 32)
            NEO4J_PASS="password"

            cat > ./.env.development << EOF
# Development Environment Variables
# Auto-generated on $(date)

# API Configuration
API_V1_STR=/api/v1
PROJECT_NAME=Penflow

# Security - Auto-generated for development
SECRET_KEY=$JWT_SECRET
ALGORITHM=HS256
# 8 days token expiration
ACCESS_TOKEN_EXPIRE_MINUTES=11520

# Database - Auto-generated password
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=$NEO4J_PASS
NEO4J_DATABASE=neo4j
# Neo4j Docker Auth (format: username/password)
NEO4J_AUTH=neo4j/$NEO4J_PASS

# Redis
REDIS_URL=redis://localhost:6379

# CORS - Allow all origins for development
BACKEND_CORS_ORIGINS='["*"]'

# Registration Control
ENABLE_REGISTRATION=false

# AI Settings (optional - add your key if using AI features)
GOOGLE_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
EOF
            print_info "Created .env.development with secure values"
            echo ""
            print_success "Development environment initialized!"
            print_info "Credentials have been saved to .env.development"
            echo ""
        fi

        print_info "Services will be available at:"
        echo "  - Frontend: http://localhost:5173"
        echo "  - Backend: http://localhost:8000"
        echo "  - Neo4j: http://localhost:7474"
        echo "  - Redis Commander: http://localhost:8081"

        # Load environment variables for docker-compose substitution
        if [ -f "./.env.development" ]; then
            export $(grep -E '^NEO4J_AUTH=' ./.env.development | xargs)
        fi

        $DOCKER_COMPOSE -f docker-compose.dev.yml up --build
        ;;

    prod)
        print_info "Checking production environment..."

        # Check if .env.production exists
        if [ ! -f "./.env.production" ]; then
            print_warning "No .env.production file found"
            print_info "Creating .env.production file with secure defaults..."

            # Generate secure values
            JWT_SECRET=$(openssl rand -hex 32)
            NEO4J_PASS="password"

            print_info "Generated secure JWT secret: $(echo "$JWT_SECRET" | cut -c1-10)..."
            print_info "Generated Neo4j password: $(echo "$NEO4J_PASS" | cut -c1-5)..."

            cat > ./.env.production << EOF
# Production Environment Variables
# Auto-generated on $(date)

# API Configuration
API_V1_STR=/api/v1
PROJECT_NAME=Penflow

# Security - Auto-generated secure values
SECRET_KEY=$JWT_SECRET
ALGORITHM=HS256
# 8 days token expiration
ACCESS_TOKEN_EXPIRE_MINUTES=11520

# Database - Auto-generated secure password
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=$NEO4J_PASS
NEO4J_DATABASE=neo4j
# Neo4j Docker Auth (format: username/password)
NEO4J_AUTH=neo4j/$NEO4J_PASS

# Redis
REDIS_URL=redis://redis:6379

# CORS (update with your domain)
BACKEND_CORS_ORIGINS='["https://yourdomain.com", "https://www.yourdomain.com"]'

# Registration Control (disabled by default for security)
ENABLE_REGISTRATION=false

# Frontend Configuration (optional - defaults work for most cases)
# FRONTEND_API_URL=/api/v1  # Use relative URL (recommended)
# FRONTEND_API_URL=https://api.yourdomain.com/api/v1  # Or absolute URL

# AI Settings (optional - add your key if using AI features)
GOOGLE_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
EOF
            print_info "Created .env.production with secure values"
            echo ""
            print_success "Production environment initialized"
            print_warning "IMPORTANT: Update BACKEND_CORS_ORIGINS with your actual domain in .env.production"
            echo ""
            print_info "All credentials have been securely saved to .env.production"
            print_info "To view the Neo4j password, check the .env.production file"
            print_info "After updating the domain, run this command again"
            exit 1
        fi

        # Additional security checks
        print_info "Security checklist:"
        echo -n "  ✓ Checking for environment file... "
        if [ -f "./.env.production" ]; then
            echo -e "${GREEN}Found${NC}"
        else
            echo -e "${RED}Missing${NC}"
            exit 1
        fi

        # Prompt for confirmation
        print_warning "Running in PRODUCTION mode!"
        echo "Please confirm you have:"
        echo "  1. Changed the default Neo4j password"
        echo "  2. Set a secure SECRET_KEY (not the default)"
        echo "  3. Updated CORS origins for your domain"
        echo "  4. Reviewed all environment variables"
        echo ""
        read -p "Have you completed all security steps? (yes/N) " -r
        echo
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            print_info "Production startup cancelled"
            exit 0
        fi

        print_info "Starting production environment with nginx..."
        print_info "All services available through: http://localhost"
        echo "  - Frontend: http://localhost"
        echo "  - API: http://localhost/api/v1"
        echo "  - WebSocket: ws://localhost/ws"
        echo ""
        print_warning "FIRST RUN SETUP:"
        echo "After containers start, create your first user with:"
        echo "  docker exec -it penflow-backend python create_user.py create admin admin@yourcompany.com"
        echo ""

        # Load environment variables for docker-compose substitution
        if [ -f "./.env.production" ]; then
            export $(grep -E '^NEO4J_AUTH=' ./.env.production | xargs)
        fi

        $DOCKER_COMPOSE -f docker-compose.prod.yml up --build
        ;;

    stop)
        print_info "Stopping all containers..."
        $DOCKER_COMPOSE -f docker-compose.dev.yml down
        $DOCKER_COMPOSE -f docker-compose.prod.yml down
        print_info "All containers stopped"
        ;;

    clean)
        print_warning "This will remove all containers and volumes!"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Cleaning up..."
            $DOCKER_COMPOSE -f docker-compose.dev.yml down -v
            $DOCKER_COMPOSE -f docker-compose.prod.yml down -v
            print_info "Cleanup complete"
        else
            print_info "Cleanup cancelled"
        fi
        ;;

    *)
        usage
        exit 1
        ;;
esac
