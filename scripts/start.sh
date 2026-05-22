#!/bin/bash

# ============================================
# MEDIAHUB Dashboard - Quick Start Script
# ============================================
# Start the dashboard locally for development or testing

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/mnt/Data/mon-dashboard"
ENV_FILE="$PROJECT_DIR/.env"

# ============================================
# Helper Functions
# ============================================

print_header() {
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  $1"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

cleanup() {
    print_header "Cleaning Up"
    print_info "Stopping containers..."
    cd "$PROJECT_DIR"
    docker compose down --remove-orphans || true
    print_success "Cleanup complete"
}

trap cleanup EXIT

# ============================================
# Main Start Function
# ============================================

main() {
    print_header "MEDIAHUB Dashboard - Quick Start"
    
    # Check if Docker is running
    if ! docker info &>/dev/null; then
        print_error "Docker daemon is not running"
        echo "Start Docker Desktop or the Docker service and try again"
        exit 1
    fi
    print_success "Docker is running"
    
    # Check project directory
    if [ ! -d "$PROJECT_DIR" ]; then
        print_error "Project directory not found: $PROJECT_DIR"
        exit 1
    fi
    print_success "Project directory found"
    
    # Check .env file
    if [ ! -f "$ENV_FILE" ]; then
        print_warning ".env file not found, creating from template..."
        cd "$PROJECT_DIR"
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success ".env file created"
        else
            print_error ".env.example not found"
            exit 1
        fi
    else
        print_success ".env file found"
    fi
    
    # Show current configuration
    print_header "Configuration"
    print_info "Dashboard Port: $(grep DASHBOARD_PORT= "$ENV_FILE" | cut -d= -f2 || echo '3000')"
    print_info "API Port: $(grep API_PORT= "$ENV_FILE" | cut -d= -f2 || echo '3001')"
    
    # Check for Tailscale API key
    if grep -q "TAILSCALE_API_KEY=tskey_$" "$ENV_FILE"; then
        print_warning "Tailscale API key not configured"
        print_info "To use real Tailscale data, configure in .env file"
    else
        print_success "Tailscale API key appears to be configured"
    fi
    
    # Pull latest images
    print_header "Pulling Latest Images"
    cd "$PROJECT_DIR"
    print_info "Downloading latest images..."
    docker compose pull || print_warning "Could not pull images (may use local versions)"
    
    # Build if needed
    print_header "Building Application"
    print_info "Building Docker images..."
    if docker compose build --progress=plain 2>&1 | grep -v "^#"; then
        print_success "Build completed successfully"
    else
        print_warning "Build completed with warnings"
    fi
    
    # Start containers
    print_header "Starting Containers"
    print_info "Starting dashboard containers..."
    docker compose up --abort-on-container-exit
}

# Run main function
main "$@"
