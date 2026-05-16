$files = Get-ChildItem -Path src -Recurse -Filter *.tsx
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $original = $content
    
    $content = $content -replace 'rounded-\[32px\]', 'rounded-xl'
    $content = $content -replace 'rounded-3xl', 'rounded-xl'
    $content = $content -replace 'rounded-2xl', 'rounded-xl'
    $content = $content -replace 'rounded-\[16px\]', 'rounded-xl'
    $content = $content -replace 'rounded-\[20px\]', 'rounded-xl'
    $content = $content -replace 'rounded-\[24px\]', 'rounded-xl'
    
    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Updated $($file.FullName)"
    }
}
