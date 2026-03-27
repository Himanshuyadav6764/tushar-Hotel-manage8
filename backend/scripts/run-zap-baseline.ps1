param(
    [string]$TargetUrl = $env:ZAP_TARGET_URL
)

function Resolve-DockerCli {
    $cmd = Get-Command docker -ErrorAction SilentlyContinue
    if ($cmd) {
        return "docker"
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

if ([string]::IsNullOrWhiteSpace($TargetUrl)) {
    $TargetUrl = "http://host.docker.internal:5000"
}

${dockerCli} = Resolve-DockerCli
if ([string]::IsNullOrWhiteSpace($dockerCli)) {
    Write-Error "Docker is not installed or not available in PATH. Install/start Docker Desktop first."
    exit 1
}

$reportDir = Join-Path (Get-Location) "security-reports"
if (-not (Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir | Out-Null
}

Write-Host "Running OWASP ZAP baseline scan against: $TargetUrl"
Write-Host "Reports will be written to: $reportDir"

$dockerArgs = @(
    "run", "--rm",
    "-v", "${reportDir}:/zap/wrk",
    "ghcr.io/zaproxy/zaproxy:stable",
    "zap-baseline.py",
    "-t", $TargetUrl,
    "-r", "zap-baseline-report.html",
    "-J", "zap-baseline-report.json",
    "-w", "zap-baseline-report.md",
    "-I"
)

& $dockerCli @dockerArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "OWASP ZAP baseline scan failed. Ensure Docker Desktop is running."
    if ($LASTEXITCODE -eq $null -or $LASTEXITCODE -eq 0) {
        exit 1
    }
    exit $LASTEXITCODE
}

Write-Host "OWASP ZAP baseline scan completed successfully."
