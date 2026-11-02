$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://localhost:8000/')
$listener.Start()
Write-Host 'Игра доступна: http://localhost:8000'
Write-Host 'Чтобы остановить сервер, нажми Ctrl+C.'

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
      $file = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
      if (-not $file.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $file -PathType Leaf)) {
        $context.Response.StatusCode = 404
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('Файл не найден')
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $extension = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
        $contentType = switch ($extension) {
          '.html' { 'text/html; charset=utf-8' }
          '.css'  { 'text/css; charset=utf-8' }
          '.js'   { 'text/javascript; charset=utf-8' }
          '.mjs'  { 'text/javascript; charset=utf-8' }
          default { 'application/octet-stream' }
        }
        $context.Response.ContentType = $contentType
        $context.Response.Headers.Add('Cache-Control', 'no-store')
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    } catch {
      $context.Response.StatusCode = 500
    } finally {
      $context.Response.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
