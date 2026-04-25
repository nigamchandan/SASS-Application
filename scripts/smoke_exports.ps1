# Smoke test all CSV export endpoints (Customers, Invoices, Payments, Expenses, WhatsApp)
$ErrorActionPreference = 'Stop'
$BASE = 'http://localhost:5000/api'

function Hit {
    param([string]$method, [string]$path, $body, [string]$token)
    $headers = @{ 'Content-Type' = 'application/json' }
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    $url = "$BASE$path"
    $params = @{ Uri = $url; Method = $method; Headers = $headers; UseBasicParsing = $true }
    if ($body) { $params.Body = ($body | ConvertTo-Json -Depth 10) }
    try {
        $resp = Invoke-WebRequest @params
        if ($resp.Content) { return $resp.Content | ConvertFrom-Json }
        return $null
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $msg = $_.ErrorDetails.Message
        Write-Host "  HTTP $code  $msg" -ForegroundColor Yellow
        throw
    }
}

function HitBlob {
    param([string]$path, [string]$token)
    $headers = @{ 'Authorization' = "Bearer $token" }
    $url = "$BASE$path"
    $resp = Invoke-WebRequest -Uri $url -Headers $headers -Method GET -UseBasicParsing
    return $resp
}

$stamp = (Get-Date -Format 'yyyyMMddHHmmss')
$email = "exports_$stamp@biz.test"
$pwd   = 'Secret123!'

Write-Host "1) Register $email" -ForegroundColor Cyan
$reg = Hit POST '/auth/register' @{ name = 'Export Tester'; email = $email; password = $pwd }
$tok = $reg.data.token
if (-not $tok) { throw 'No token returned' }

Write-Host "2) Seed minimal data" -ForegroundColor Cyan
$cust = Hit -method POST -path '/customers' -body @{ name = 'Export Customer Inc.'; phone = '+91 9876543210'; email = "buyer_$stamp@example.com"; gstNumber = '22AAAAA0000A1Z5'; address = 'Mumbai' } -token $tok
$cid = $cust.data.customer.id
$inv = Hit -method POST -path '/invoices' -body @{
    customerId = $cid
    items      = @(@{ itemName = 'Consulting'; quantity = 2; price = 1500; tax = 18 })
    notes      = 'thanks for your order'
} -token $tok
$iid = $inv.data.invoice.id
$null = Hit -method POST -path "/invoices/$iid/payments" -body @{ amount = 1000; method = 'UPI'; note = 'partial' } -token $tok
$null = Hit -method POST -path '/expenses' -body @{ title = 'Internet'; category = 'Utilities'; amount = 999; date = (Get-Date -Format 'yyyy-MM-dd'); description = 'broadband' } -token $tok
$null = Hit -method POST -path "/invoices/$iid/whatsapp/send-invoice" -body @{} -token $tok
$null = Hit -method POST -path "/invoices/$iid/whatsapp/send-reminder" -body @{} -token $tok

$endpoints = @(
    @{ name = 'Customers'; path = '/customers/export.csv'; expectHeader = 'Name,Phone,Email,GST' },
    @{ name = 'Invoices';  path = '/invoices/export.csv';  expectHeader = 'Invoice #,Issue Date' },
    @{ name = 'Payments';  path = '/payments/export.csv';  expectHeader = 'Date,Invoice #' },
    @{ name = 'Expenses';  path = '/expenses/export.csv';  expectHeader = 'Date,Title,Category' },
    @{ name = 'WhatsApp';  path = '/whatsapp/export.csv';  expectHeader = 'Sent At,Kind,Status' }
)

Write-Host "3) Hit each export endpoint and validate" -ForegroundColor Cyan
foreach ($e in $endpoints) {
    Write-Host ("   - {0}" -f $e.name) -NoNewline
    $resp = HitBlob $e.path $tok
    $ct = $resp.Headers['Content-Type']
    $cd = $resp.Headers['Content-Disposition']
    $bytes = if ($resp.Content -is [byte[]]) { $resp.Content.Length } else { [System.Text.Encoding]::UTF8.GetByteCount([string]$resp.Content) }
    $body = if ($resp.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($resp.Content) } else { [string]$resp.Content }
    # strip BOM if present
    if ($body.Length -gt 0 -and [int][char]$body[0] -eq 65279) { $body = $body.Substring(1) }
    $firstLine = ($body -split "`n")[0].Trim()
    $hasHeader = $firstLine.StartsWith($e.expectHeader)
    $rows = ($body -split "`n").Where({ $_.Trim() -ne '' }).Count
    if (-not $hasHeader) {
        Write-Host "  FAIL: header mismatch. got: $firstLine" -ForegroundColor Red
        throw 'header mismatch'
    }
    Write-Host (" OK  status={0} ct={1} bytes={2} rows={3} cd={4}" -f $resp.StatusCode, $ct, $bytes, $rows, $cd) -ForegroundColor Green
}

Write-Host "4) Ensure tenant isolation: register a second user, expect empty rows" -ForegroundColor Cyan
$email2 = "exports_b_$stamp@biz.test"
$reg2 = Hit POST '/auth/register' @{ name = 'Other'; email = $email2; password = $pwd }
$tok2 = $reg2.data.token
foreach ($e in $endpoints) {
    $resp = HitBlob $e.path $tok2
    $body = if ($resp.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($resp.Content) } else { [string]$resp.Content }
    if ($body.Length -gt 0 -and [int][char]$body[0] -eq 65279) { $body = $body.Substring(1) }
    $rows = ($body -split "`n").Where({ $_.Trim() -ne '' }).Count
    # only header line should be present
    if ($rows -ne 1) {
        Write-Host ("  FAIL: tenant {0} sees {1} rows in {2}" -f $email2, $rows, $e.name) -ForegroundColor Red
        throw 'tenant isolation failed'
    }
    Write-Host ("   - {0} OK (rows={1} header only)" -f $e.name, $rows) -ForegroundColor Green
}

Write-Host "5) Filtered export (status=PAID on invoices) returns header only when no PAID invoices" -ForegroundColor Cyan
$resp = HitBlob '/invoices/export.csv?status=PAID' $tok
$body = if ($resp.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($resp.Content) } else { [string]$resp.Content }
if ($body.Length -gt 0 -and [int][char]$body[0] -eq 65279) { $body = $body.Substring(1) }
$rows = ($body -split "`n").Where({ $_.Trim() -ne '' }).Count
if ($rows -ne 1) { throw 'expected only header for status=PAID filter' }
Write-Host "   PAID-only filter rows=$rows OK" -ForegroundColor Green

Write-Host "ALL EXPORT SMOKE TESTS PASSED" -ForegroundColor Green
