# Penflow

🎯 **Visualize Your Security Testing & Analysis Journey**

Penflow is a mind-mapping platform designed specifically for cybersecurity professionals. it helps you visualize, track, and share your security testing methodologies while maintaining complete control over your sensitive data.

<img width="1903" height="969" alt="image" src="https://github.com/user-attachments/assets/4d965956-9ef4-4acd-87c1-dc8c65610bf9" />
<img width="1915" height="971" alt="image" src="https://github.com/user-attachments/assets/00016f13-33f7-4cdb-995e-1b77cf54ad47" />
<img width="1902" height="971" alt="image" src="https://github.com/user-attachments/assets/3985e045-33ee-40dc-9d3d-7b78399541c6" />
<img width="1088" height="844" alt="image" src="https://github.com/user-attachments/assets/92d2163f-c2e3-4d03-bbaf-4a0bd8ba05b2" />

## 🚀 Key Features

### Core Capabilities
- 🗺️ **Interactive Mind Maps**: Create and navigate complex security testing workflows with an intuitive visual interface
- 🤖 **AI-Powered Assistance**: Generate node suggestions and expand your methodology with integrated AI capabilities
- 📋 **Command Templates**: Save and reuse CLI commands with variable substitution
- 📊 **Progress Tracking**: Visualize testing progress and methodology coverage

### Security & Privacy
- 🔐 **Self-Hosted Option**: Run entirely on your infrastructure
- 🔒 **Encrypted Exports**: AES-256-GCM encryption for secure sharing of Projects & Templates
- 🔏 **Authentication/Authorization**: Token-based authentication withresource-level access control
- 🤖 **AI Privacy**: Only non-sensitive data (node titles/descriptions) shared with AI - no commands or sensitive details

### Import/Export
- 📥 **Template Import**: Load methodologies from GitHub or private repositories
- 📤 **Multiple Export Formats**: CSV and encrypted formats
- 🔄 **Legacy Migration**: Import from previous Penflow versions
- 📦 **Bulk Operations**: Export multiple projects or templates at once

## 🏗️ Architecture

- **Frontend**: React 19 + TypeScript + Vite
  - TailwindCSS for styling
  - XYFlow for mind map visualization
  - Zustand for state management

- **Backend**: FastAPI (Python 3.12)
  - Neo4j graph database for storing relationships
  - Redis

## 🚀 Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ and pnpm (for development)
- Python 3.12+ (for backend development)

### Quick Start with Docker

1. Clone the repository:
```bash
git clone https://github.com/rb-x/penflow.git
cd penflow
```

2. Make the run script executable:
```bash
chmod +x run.sh
```

3. Start the development environment:
```bash
./run.sh dev
```

This will automatically:
- Check for Docker and Docker Compose
- Create `.env.development` with secure defaults (Neo4j password: `password`)
- To enable the AI feature, press CTRL+C. Then, add your [Gemini API Key](https://aistudio.google.com/apikey) in your .env file & restart the application by running `./run.sh dev`
- Start all services (Frontend, Backend, Neo4j, Redis)
- Display service URLs

4. Access the application:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Neo4j Browser: http://localhost:7474
- Redis Commander: http://localhost:8081



### Other Commands

```bash
./run.sh prod   # Start production environment (with nginx)
./run.sh stop   # Stop all containers
./run.sh clean  # Stop and remove all containers and volumes
```

### Development Setup

#### Option 1: Using Docker (Recommended)
```bash
./run.sh dev
```
This starts all services with hot-reload enabled. Perfect for full-stack development.

#### Option 2: Manual Development Setup

If you prefer running services individually without Docker:

**Frontend Development**
```bash
cd frontend
pnpm install
pnpm dev          # Runs on http://localhost:5173
```

**Backend Development**
```bash
cd backend
pipenv install --dev
pipenv shell
python main.py    # Runs on http://localhost:8000
```

**Note**: For manual setup, you'll need Neo4j and Redis running locally:
- Neo4j: Download from [neo4j.com](https://neo4j.com/download/)
- Redis: `brew install redis` (macOS) or `apt install redis` (Linux)

## 📁 Project Structure

```
penflow/
├── frontend/           # React TypeScript application
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── pages/      # Route pages
│   │   ├── services/   # API services
│   │   └── store/      # State management
│   └── package.json
├── backend/            # FastAPI application
│   ├── api/           # API endpoints
│   ├── crud/          # Database operations
│   ├── models/        # Data models
│   ├── schemas/       # Pydantic schemas
│   └── services/      # Business logic
└── docker-compose.*.yml
```

## 🔧 Configuration

The `run.sh` script handles all environment configuration automatically:

- **Development** (`./run.sh dev`): Creates `.env.development` with secure defaults
- **Production** (`./run.sh prod`): Creates `.env.production` with strong passwords

To add AI features, simply edit the generated `.env.development` or `.env.production` file and add your `GOOGLE_API_KEY`.

### Production Deployment

For production deployment:

1. Run the production setup:
```bash
./run.sh prod
```

This will:
- Check for existing `.env.production` file
- Generate secure passwords and secrets if needed
- Prompt you to update CORS origins for your domain
- Run security checklist before starting
- Start all services behind nginx proxy

2. On first run, update `.env.production`:
- Set your domain in `BACKEND_CORS_ORIGINS`
- Add your `GOOGLE_API_KEY` for AI features (optional)
- Review all generated passwords

3. Create your first user (registration is disabled by default for security):

```bash
# Create admin user via CLI (inside backend container)
docker exec -it penflow-backend python create_user.py create admin admin@yourcompany.com

# Or using docker-compose:
docker-compose exec backend python create_user.py create admin admin@yourcompany.com

# The script will output:
# User created successfully:
# Username: admin
# Password: <secure-random-password>
# Email: admin@yourcompany.com
```

4. Additional production steps:

 ⚠️ Security Notice: We absolutely don't recommend exposing Penflow to the internet. If you must:
  1. Whitelist trusted IP addresses through your WAF or firewall
  2. Registration is disabled by default - only manual user creation via SSH

- Set up SSL/TLS certificates (Let's Encrypt recommended)
- Set up monitoring and logging
- Implement regular security updates

## 📚 Documentation

🚧 Documentation is currently being updated for the new full-stack architecture

## 🎯 Use Cases

Penflow is perfect for:
- **Penetration Testers**: Track methodology and findings
- **Security Analysts**: Document investigation workflows
- **Incident Responders**: Map out response procedures
- **Security Teams**: Share knowledge and methodologies
- **Researchers**: Organize and visualize attack paths

## 🛡️ Security

Penflow is designed with security in mind:
- **Privacy-First AI**: AI features only access node titles and descriptions - never sensitive data like findings or variables
- **Encrypted Exports**: Secure sharing with AES-256-GCM encryption
- **Zero Telemetry**: No tracking or data collection
- **Open Source**: Full transparency and community-driven security


Created with ❤️ in 🇫🇷 by [Riadh BOUCHAHOUA (rb-x)](https://github.com/rb-x/) & [Ludovic COULON (LasCC)](https://github.com/LasCC/)

---

**Join the Penflow community and revolutionize your security testing workflow!**

[Website-legacy](https://penflow.sh) | [Documentation-legacy](https://docs.penflow.sh) | [Templates-legacy](https://github.com/rb-x/penflow-templates)
