#!/bin/bash

# ============================================
# MEDIAHUB Dashboard - Installation Script
# ============================================
# One-command installation and configuration

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
SERVICE_FILE="mediahub-dashboard.service"
SERVICE_PATH="/etc/systemd/system/$SERVICE_FILE"
ENV_FILE="$PROJECT_DIR/.env"
ENV_EXAMPLE="$PROJECT_DIR/.env.example"

# ============================================
# Helper Functions
# ============================================

print_header() {
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  $1"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════╝${NC}"
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

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root (use: sudo bash scripts/install-service.sh)"
        exit 1
    fi
}

check_requirements() {
    print_header "Checking Requirements"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        echo "Install Docker from: https://docs.docker.com/engine/install/"
        exit 1
    fi
    print_success "Docker is installed ($(docker --version))"
    
    # Check Docker Compose
    if ! command -v docker compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    print_success "Docker Compose is installed ($(docker compose version | head -n1))"
    
    # Check systemd
    if ! command -v systemctl &> /dev/null; then
        print_error "systemd is not available"
        exit 1
    fi
    print_success "systemd is available"
    
    # Check project directory
    if [ ! -d "$PROJECT_DIR" ]; then
        print_error "Project directory not found: $PROJECT_DIR"
        exit 1
    fi
    print_success "Project directory found"
}

setup_environment() {
    print_header "Setting Up Environment Variables"
    
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$ENV_EXAMPLE" ]; then
            print_info "Creating .env file from .env.example..."
            cp "$ENV_EXAMPLE" "$ENV_FILE"
            print_success ".env file created"
        else
            print_error ".env.example not found"
            exit 1
        fi
    else
        print_warning ".env file already exists, skipping..."
    fi
    
    # Check for important environment variables
    if ! grep -q "TAILSCALE_API_KEY=tskey_" "$ENV_FILE"; then
        print_warning "TAILSCALE_API_KEY not configured"
        echo ""
        echo "To configure Tailscale:"
        echo "1. Get your API key from: https://login.tailscale.com/admin/settings/keys"
        echo "2. Edit: $ENV_FILE"
        echo "3. Set: TAILSCALE_API_KEY=tskey_your_key_here"
        echo "4. Set: TAILSCALE_TAILNET=your-email@example.com"
        echo ""
    fi
}

install_service() {
    print_header "Installing Systemd Service"
    
    # Copy service file
    print_info "Copying service file to /etc/systemd/system/..."
    cp "$PROJECT_DIR/$SERVICE_FILE" "$SERVICE_PATH"
    
    # Set permissions
    chmod 644 "$SERVICE_PATH"
    print_success "Service file installed"
    
    # Reload systemd
    print_info "Reloading systemd daemon..."
    systemctl daemon-reload
    print_success "Systemd reloaded"
    
    # Enable the service
    print_info "Enabling service for auto-start..."
    systemctl enable "$SERVICE_FILE"
    print_success "Service enabled for auto-start"
}

build_image() {
    print_header "Building Docker Image"
    
    print_info "Building dashboard image (this may take several minutes)..."
    cd "$PROJECT_DIR"
    
    if docker compose build --progress=plain 2>&1; then
        print_success "Docker image built successfully"
    else
        print_error "Failed to build Docker image"
        exit 1
    fi
}

test_connectivity() {
    print_header "Testing Connectivity"
    
    print_info "Checking Docker socket access..."
    if [ -S /var/run/docker.sock ]; then
        print_success "Docker socket is accessible"
    else
        print_error "Docker socket not found or not accessible"
    fi
    
    print_info "Checking network connectivity..."
    if ping -c 1 8.8.8.8 &> /dev/null; then
        print_success "Network is reachable"
    else
        print_warning "Network may be unreachable (but can still continue)"
    fi
}

start_service() {
    print_header "Starting Dashboard Service"
    
    print_info "Starting mediahub-dashboard service..."
    if systemctl start "$SERVICE_FILE"; then
        print_success "Service started successfully"
    else
        print_error "Failed to start service"
        echo ""
        echo "To check errors, run:"
        echo "  journalctl -u $SERVICE_FILE -n 50"
        exit 1
    fi
    
    # Wait a moment for service to be ready
    sleep 3
    
    # Check status
    if systemctl is-active --quiet "$SERVICE_FILE"; then
        print_success "Service is running"
    else
        print_error "Service is not running"
        exit 1
    fi
}

show_status() {
    print_header "Service Status"
    
    systemctl status "$SERVICE_FILE" --no-pager || true
    
    echo ""
    print_info "Container status:"
    docker compose -f "$PROJECT_DIR/docker-compose.yml" ps || true
}

show_next_steps() {
    print_header "Installation Complete! 🎉"
    
    echo ""
    echo "Next Steps:"
    echo "==========="
    echo ""
    echo "1. Configure Tailscale API (if not already done):"
    echo "   - Edit: $ENV_FILE"
    echo "   - Get key from: https://login.tailscale.com/admin/settings/keys"
    echo ""
    echo "2. Access the Dashboard:"
    echo "   - Frontend: http://localhost:3000"
    echo "   - API: http://localhost:3001/api/health"
    echo ""
    echo "3. View Logs:"
    echo "   - Live logs: bash scripts/logs.sh live"
    echo "   - Interactive menu: bash scripts/logs.sh"
    echo "   - Systemd logs: journalctl -u $SERVICE_FILE -f"
    echo ""
    echo "4. Manage the Service:"
    echo "   - Start: sudo systemctl start mediahub-dashboard"
    echo "   - Stop: sudo systemctl stop mediahub-dashboard"
    echo "   - Restart: sudo systemctl restart mediahub-dashboard"
    echo "   - Status: sudo systemctl status mediahub-dashboard"
    echo "   - Disable auto-start: sudo systemctl disable mediahub-dashboard"
    echo ""
    echo "5. Monitor Container:"
    echo "   - List containers: docker ps"
    echo "   - Container logs: docker compose -f $PROJECT_DIR/docker-compose.yml logs -f"
    echo ""
}

# ============================================
# Main Installation Flow
# ============================================

main() {
    print_header "MEDIAHUB Dashboard Installation"
    
    check_root
    check_requirements
    setup_environment
    test_connectivity
    build_image
    install_service
    start_service
    show_status
    show_next_steps
    
    print_success "Installation completed successfully!"
}

# Run main function
main "$@"
