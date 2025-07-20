@echo off
REM Setup script for Guard Management Module (Windows)
REM This script ensures the correct Node.js version and installs dependencies

echo 🛡️  Guard Management Module Setup
echo ==================================

REM Check if nvm is available
nvm version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ nvm not found. Please install nvm-windows first:
    echo    https://github.com/coreybutler/nvm-windows
    pause
    exit /b 1
)

echo ✅ nvm found

REM Check if .nvmrc exists
if not exist ".nvmrc" (
    echo ❌ .nvmrc file not found in current directory
    pause
    exit /b 1
)

REM Read Node.js version from .nvmrc
set /p NODE_VERSION=<.nvmrc
echo 📋 Required Node.js version: %NODE_VERSION%

REM Install and use the correct Node.js version
echo 🔄 Setting up Node.js %NODE_VERSION%...
nvm install %NODE_VERSION%
nvm use %NODE_VERSION%

REM Verify Node.js version
for /f "tokens=*" %%i in ('node --version') do set CURRENT_VERSION=%%i
echo ✅ Active Node.js version: %CURRENT_VERSION%

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Run type checking
echo 🔍 Running type check...
npm run type-check

REM Run tests to ensure everything works
echo 🧪 Running tests...
npm run test

REM Build the module
echo 🏗️  Building module...
npm run build

echo.
echo 🎉 Setup complete! You can now:
echo    npm run dev      # Start development server
echo    npm run test     # Run tests
echo    npm run test:ui  # Run tests with UI
echo.
echo 📝 Remember to always use 'nvm use' when switching to this project!
pause
