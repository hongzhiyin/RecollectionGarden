param([string]$Source, [string]$Destination)
$ErrorActionPreference = 'Stop'
Compress-Archive -LiteralPath $Source -DestinationPath $Destination -CompressionLevel Optimal
