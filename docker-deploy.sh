#!/bin/bash

echo "=== Football Field Booking - Docker Deployment ==="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "Please logout and login again for Docker permissions to take effect"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker-compose --version)"

# Create directories
mkdir -p logs uploads

# Stop existing containers
echo "Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

# Pull latest images
echo "Pulling latest images..."
docker-compose -f docker-compose.prod.yml pull

# Build and start services
echo "Building and starting services..."
docker-compose -f docker-compose.prod.yml up -d --build

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 15

# Check service status
echo "Service status:"
docker-compose -f docker-compose.prod.yml ps

# Test health endpoint
echo "Testing health endpoint..."
sleep 5
curl -f http://localhost/health || echo "Health check failed"

echo "=== Deployment completed! ==="
echo ""
echo "Services available at:"
echo "- Frontend/API: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
echo "- Health check: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)/health"
echo "- Direct API: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)/api/health"
echo ""
echo "Useful commands:"
echo "- View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "- Restart: docker-compose -f docker-compose.prod.yml restart"
echo "- Stop: docker-compose -f docker-compose.prod.yml down"
echo "- Rebuild: docker-compose -f docker-compose.prod.yml up -d --build"
