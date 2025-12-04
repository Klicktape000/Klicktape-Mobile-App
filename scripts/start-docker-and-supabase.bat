@echo off
echo 🐳 Starting Docker and Supabase Setup...
echo.

echo Step 1: Checking if Docker Desktop is running...
docker ps >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Docker is already running!
    goto :supabase
)

echo ❌ Docker is not running. Starting Docker Desktop...
echo.
echo Please start Docker Desktop manually:
echo 1. Press Windows key and search "Docker Desktop"
echo 2. Click on Docker Desktop to launch it
echo 3. Wait for the whale icon in system tray
echo 4. Wait until it shows "Docker Desktop is running"
echo.
echo Press any key after Docker Desktop is running...
pause

:check_docker
echo Checking Docker status...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker is still not ready. Please wait a bit more and try again.
    echo Press any key to check again...
    pause
    goto :check_docker
)

echo ✅ Docker is now running!

:supabase
echo.
echo Step 2: Starting Supabase local development...
echo This may take a few minutes on first run...
echo.

npx supabase start
if %errorlevel% neq 0 (
    echo ❌ Supabase failed to start. Checking status...
    npx supabase status
    echo.
    echo If you see errors, try:
    echo   npx supabase stop
    echo   npx supabase start
    goto :end
)

echo.
echo ✅ Supabase is starting! Checking status...
npx supabase status

echo.
echo 🎉 Setup complete! Your local development environment is ready.
echo.
echo Supabase Studio: http://localhost:54323
echo API URL: http://localhost:54321
echo Database: postgresql://postgres:postgres@localhost:54322/postgres
echo.
echo You can now connect Augment tools to your local Supabase instance!

:end
echo.
echo Press any key to exit...
pause
