@echo off
echo Checking Docker installation...
echo.

echo 1. Checking if Docker is installed:
docker --version
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed or not in PATH
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

echo.
echo 2. Checking if Docker daemon is running:
docker ps
if %errorlevel% neq 0 (
    echo ERROR: Docker daemon is not running
    echo Please start Docker Desktop and try again
    pause
    exit /b 1
)

echo.
echo SUCCESS: Docker is properly installed and running!
echo You can now use Supabase local development and Augment tools.
pause
