@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo This folder is not a git repository.
  exit /b 1
)

for /f "delims=" %%B in ('git symbolic-ref --short refs/remotes/origin/HEAD 2^>nul') do set "REMOTE_HEAD=%%B"
if not defined REMOTE_HEAD set "REMOTE_HEAD=origin/main"
for /f "tokens=2 delims=/" %%B in ("%REMOTE_HEAD%") do set "BRANCH=%%B"

for /f "delims=" %%S in ('git status --porcelain') do set "DIRTY=1"
if defined DIRTY (
  echo Warning: You have local changes. Commit or stash them before updating.
  exit /b 1
)

echo Fetching updates from origin...
git fetch origin
if errorlevel 1 exit /b 1

for /f "delims=" %%F in ('git diff --name-only HEAD %REMOTE_HEAD%') do (
  if not defined CHANGES set "CHANGES=1"
  echo Updated file: %%F
)

if not defined CHANGES (
  echo Already up to date with %REMOTE_HEAD%.
  exit /b 0
)

echo Pulling latest changes from %REMOTE_HEAD%...
git pull --ff-only origin %BRANCH%
if errorlevel 1 exit /b 1

echo Update complete.
