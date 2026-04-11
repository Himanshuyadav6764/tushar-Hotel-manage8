Add-Type -AssemblyName System.Drawing

$outDir = "e:\ccc\Hotel-manage8\frontend\public\logos"
if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir }

function Create-Logo {
    param($text, $colorHex, $path, $fontSize)
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
    $color = [System.Drawing.ColorTranslator]::FromHtml($colorHex)
    $brush = New-Object System.Drawing.SolidBrush($color)
    $bmpTmp = New-Object System.Drawing.Bitmap(1, 1)
    $gTmp = [System.Drawing.Graphics]::FromImage($bmpTmp)
    $size = $gTmp.MeasureString($text, $font)
    $gTmp.Dispose(); $bmpTmp.Dispose()
    $width = [int]$size.Width + 20
    $height = [int]$size.Height + 20
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    $g.DrawString($text, $font, $brush, 10, 10)
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $font.Dispose(); $brush.Dispose(); $g.Dispose(); $bmp.Dispose()
}

Create-Logo -text "SWIGGY" -colorHex "#FC8019" -path "$outDir\swiggy.png" -fontSize 46
Create-Logo -text "zomato" -colorHex "#E23744" -path "$outDir\zomato.png" -fontSize 55
Create-Logo -text "blinkit" -colorHex "#85aa22" -path "$outDir\blinkit.png" -fontSize 55
Create-Logo -text "Uber" -colorHex "#000000" -path "$outDir\uber.png" -fontSize 48
Create-Logo -text "OYO" -colorHex "#ED1C24" -path "$outDir\oyo.png" -fontSize 50
Create-Logo -text "airbnb" -colorHex "#FF5A5F" -path "$outDir\airbnb.png" -fontSize 48
