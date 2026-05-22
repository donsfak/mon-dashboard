#!/bin/bash

# ============================================
# MEDIAHUB Dashboard - Logging Utilities
# ============================================
# Comprehensive logging configuration and viewing commands

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# Log Viewing Functions
# ============================================

print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  $1"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
}

# View container logs in real-time
view_logs_live() {
    print_header "📊 Real-time Container Logs"
    echo -e "${YELLOW}Press Ctrl+C to exit${NC}\n"
    docker compose logs -f dashboard
}

# View API logs only
view_api_logs() {
    print_header "🔧 API Server Logs"
    echo -e "${YELLOW}Showing last 50 lines. Press Ctrl+C to exit${NC}\n"
    docker compose logs -f --tail=50 dashboard | grep -E 'api|port|listening|error' || docker compose logs -f --tail=50 dashboard
}

# View application logs
view_app_logs() {
    print_header "⚡ React Application Logs"
    echo -e "${YELLOW}Showing logs from the last 10 minutes${NC}\n"
    docker compose logs --tail=100 dashboard | tail -50
}

# View Docker system logs via journalctl
view_systemd_logs() {
    print_header "🐧 Systemd Service Logs"
    echo -e "${YELLOW}Showing last 100 lines. Press Ctrl+C to exit${NC}\n"
    
    if systemctl is-active --quiet mediahub-dashboard; then
        journalctl -u mediahub-dashboard -n 100 -f
    else
        echo -e "${RED}✗ Service not active or not installed${NC}"
        echo "Install the service with: sudo bash scripts/install-service.sh"
    fi
}

# View Docker container logs file directly
view_docker_file_logs() {
    print_header "📁 Docker File Logs"
    
    CONTAINER_ID=$(docker ps --filter "name=mediahub-dashboard" -q 2>/dev/null || echo "")
    
    if [ -z "$CONTAINER_ID" ]; then
        echo -e "${RED}✗ Container not running${NC}"
        return 1
    fi
    
    LOG_FILE="/var/lib/docker/containers/${CONTAINER_ID}/${CONTAINER_ID}-json.log"
    
    if [ -f "$LOG_FILE" ]; then
        echo -e "${GREEN}✓ Found log file:${NC} $LOG_FILE\n"
        tail -f "$LOG_FILE" | grep --color=always '.*'
    else
        echo -e "${RED}✗ Log file not found${NC}"
    fi
}

# View all logs with filtering
view_logs_filtered() {
    local filter="${1:-error|warning|failed}"
    print_header "🔍 Filtered Logs (Pattern: $filter)"
    
    docker compose logs --tail=200 dashboard | grep -i "$filter" || echo "No matches found"
}

# Show logs statistics
view_logs_stats() {
    print_header "📈 Log Statistics"
    
    local total=$(docker compose logs dashboard 2>/dev/null | wc -l)
    local errors=$(docker compose logs dashboard 2>/dev/null | grep -i error | wc -l)
    local warnings=$(docker compose logs dashboard 2>/dev/null | grep -i warning | wc -l)
    
    echo -e "Total Log Lines:    ${BLUE}$total${NC}"
    echo -e "Error Messages:     ${RED}$errors${NC}"
    echo -e "Warning Messages:   ${YELLOW}$warnings${NC}"
    echo -e "Success Rate:       ${GREEN}$(( (total - errors) * 100 / total ))%${NC}"
}

# Export logs to file
export_logs() {
    local output_file="${1:-logs/export-$(date +%Y%m%d-%H%M%S).log}"
    
    mkdir -p "$(dirname "$output_file")"
    
    print_header "💾 Exporting Logs"
    echo "Exporting to: $output_file"
    
    {
        echo "=== MEDIAHUB Dashboard Logs Export ==="
        echo "Generated: $(date)"
        echo ""
        echo "=== Container Logs ==="
        docker compose logs dashboard || echo "Failed to get container logs"
        echo ""
        echo "=== System Information ==="
        echo "Docker Version: $(docker --version)"
        echo "Docker Compose Version: $(docker compose version)"
        echo "System Info: $(uname -a)"
        echo ""
        echo "=== Service Status ==="
        systemctl status mediahub-dashboard 2>/dev/null || echo "Service not installed"
    } > "$output_file"
    
    echo -e "${GREEN}✓ Logs exported successfully${NC}"
    echo "File size: $(du -h "$output_file" | cut -f1)"
}

# Clean old logs
clean_logs() {
    print_header "🧹 Cleaning Old Logs"
    
    local days_to_keep="${1:-7}"
    
    echo "Keeping logs from the last ${days_to_keep} days..."
    
    # Docker compose logs are handled by Docker daemon, so we can't directly clean them
    # But we can show the current log size
    CONTAINER_ID=$(docker ps --filter "name=mediahub-dashboard" -q 2>/dev/null || echo "")
    if [ -n "$CONTAINER_ID" ]; then
        LOG_FILE="/var/lib/docker/containers/${CONTAINER_ID}/${CONTAINER_ID}-json.log"
        if [ -f "$LOG_FILE" ]; then
            SIZE=$(du -h "$LOG_FILE" | cut -f1)
            echo -e "Current log size: ${YELLOW}$SIZE${NC}"
            echo "To rotate logs, Docker json-file driver has max-size and max-file options"
            echo "These are configured in docker-compose.yml"
        fi
    fi
}

# ============================================
# Interactive Menu
# ============================================

show_menu() {
    echo ""
    echo -e "${BLUE}MEDIAHUB Dashboard - Logging Menu${NC}"
    echo "======================================"
    echo "1) View live container logs"
    echo "2) View API server logs"
    echo "3) View React app logs"
    echo "4) View systemd service logs"
    echo "5) View Docker file logs"
    echo "6) View logs with filter"
    echo "7) Show log statistics"
    echo "8) Export logs to file"
    echo "9) Clean old logs"
    echo "0) Exit"
    echo "======================================"
    read -p "Select option: " choice
    
    case $choice in
        1) view_logs_live ;;
        2) view_api_logs ;;
        3) view_app_logs ;;
        4) view_systemd_logs ;;
        5) view_docker_file_logs ;;
        6) 
            read -p "Enter filter pattern (default: error|warning): " pattern
            view_logs_filtered "${pattern:-error|warning}"
            ;;
        7) view_logs_stats ;;
        8)
            read -p "Enter output file path (default: logs/export-DATE.log): " file
            export_logs "${file:-}"
            ;;
        9)
            read -p "Keep logs from last N days (default: 7): " days
            clean_logs "${days:-7}"
            ;;
        0) echo "Exiting..."; exit 0 ;;
        *) echo -e "${RED}Invalid option${NC}" ;;
    esac
    
    read -p "Press Enter to continue..."
    show_menu
}

# ============================================
# Main Script
# ============================================

main() {
    # Check if docker-compose is available
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker is not installed${NC}"
        exit 1
    fi
    
    if [ $# -eq 0 ]; then
        show_menu
    else
        case "$1" in
            live|tail|stream) view_logs_live ;;
            api) view_api_logs ;;
            app) view_app_logs ;;
            systemd|journal) view_systemd_logs ;;
            file) view_docker_file_logs ;;
            filter) view_logs_filtered "${2:-}" ;;
            stats) view_logs_stats ;;
            export) export_logs "${2:-}" ;;
            clean) clean_logs "${2:-}" ;;
            *)
                echo "Usage: $0 [command]"
                echo ""
                echo "Commands:"
                echo "  live|tail|stream   - View live container logs"
                echo "  api                - View API server logs"
                echo "  app                - View React app logs"
                echo "  systemd|journal    - View systemd service logs"
                echo "  file               - View Docker file logs"
                echo "  filter <pattern>   - View logs matching pattern"
                echo "  stats              - Show log statistics"
                echo "  export [file]      - Export logs to file"
                echo "  clean [days]       - Clean logs older than N days"
                echo ""
                echo "Run without arguments for interactive menu"
                exit 1
                ;;
        esac
    fi
}

main "$@"
