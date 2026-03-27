param(
    [switch]$InstallIfMissing
)

$ErrorActionPreference = 'Stop'

function Get-DockerCliPath {
    $cmd = Get-Command docker -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $candidates = @(
        "C:/Program Files/Docker/Docker/resources/bin/docker.exe",
        "C:/Program Files/Docker/Docker/Docker/resources/bin/docker.exe"
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return $null
}

function Test-DockerAvailable {
    try {
        $dockerCli = Get-DockerCliPath
        if ([string]::IsNullOrWhiteSpace($dockerCli)) {
            return $false
        }

        $null = & $dockerCli --version 2>$null
        if ($LASTEXITCODE -ne 0) {
            return $false
        }

        $null = & $dockerCli info 2>$null
        if ($LASTEXITCODE -ne 0) {
            return $false
        }

        return $true
    } catch {
        return $false
    }
}

function Install-DockerDesktop {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "Installing Docker Desktop via winget..."
        winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements --silent
        return
    }

    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Host "Installing Docker Desktop via choco..."
        choco install docker-desktop -y
        return
    }

    throw "Neither winget nor choco is available. Install Docker Desktop manually from https://www.docker.com/products/docker-desktop/"
}

if (Test-DockerAvailable) {
    Write-Host "Docker already available."
    $dockerCli = Get-DockerCliPath
    & $dockerCli --version
    exit 0
}

Write-Warning "Docker CLI is unavailable in PATH or Docker daemon is not running."

if (-not $InstallIfMissing) {
    Write-Host "Run with -InstallIfMissing to auto-install Docker Desktop."
    Write-Host "If Docker is installed already, start Docker Desktop and retry."
    exit 1
}

try {
    Install-DockerDesktop
} catch {
    Write-Error $_
    exit 1
}

Write-Host "Installation command executed. Verifying docker availability..."

if (Test-DockerAvailable) {
    Write-Host "Docker installed and available."
    $dockerCli = Get-DockerCliPath
    & $dockerCli --version
    exit 0
}

Write-Warning "Docker installation appears incomplete in current shell."
Write-Host "Please restart terminal/VS Code and start Docker Desktop, then run: npm run security:zap:baseline"
exit 1
